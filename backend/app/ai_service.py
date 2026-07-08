import json
import asyncio
import httpx
from typing import List, Dict, Any, AsyncGenerator
from datetime import datetime
from .data_service import get_stock_quote, get_kline_data, calculate_indicators
from .admin_service import get_all_settings


def _get_llm_config() -> Dict[str, str]:
    """从数据库动态读取 LLM 配置"""
    settings = get_all_settings()
    return {
        "api_key": settings.get("llm_api_key", ""),
        "base_url": settings.get("llm_base_url", "https://api.deepseek.com"),
        "model": settings.get("llm_model", "deepseek-chat"),
    }


def _llm_enabled() -> bool:
    return bool(_get_llm_config()["api_key"])

DIAGNOSE_PROMPT = """你是一位拥有20年经验的资深量化分析师。请基于以下股票数据，进行专业技术分析，输出以下格式的报告：

【综合评分】0-100分
【信号判断】强烈关注/值得关注/中性观望/谨慎回避
【趋势判断】
【技术解读】
【关键价位】支撑位和压力位的推算
【操作建议】
【风险提示】

注意：
1. 评分必须基于客观技术指标，不要主观臆断
2. 如果RSI>70要提示超买风险，RSI<30提示超卖机会
3. MACD金叉/死叉、均线多头排列/空头排列要重点说明
4. 最后必须加上"以上分析仅供参考，不构成投资建议"

数据如下："""

CHAT_PROMPT = """你是一位资深股票分析师，擅长技术分析和基本面分析。请基于你的专业知识回答用户的问题。
注意：
1. 回答要专业、客观、有理有据
2. 涉及具体股票时，要结合技术面和基本面分析
3. 最后要提醒"以上分析仅供参考，不构成投资建议"
4. 如果用户问的问题与股票无关，也可以友好回答

用户问题："""


REC_SYSTEM = """你是一位拥有20年经验的资深量化分析师。请基于客观数据，对候选股票给出简明、专业、可操作的解读。"""

def _resolve_default_model_config() -> Dict[str, Any]:
    from .admin_service import get_models_config
    models = get_models_config().get("models", [])
    if not models:
        return None
    return next((m for m in models if m.get("default")), models[0])


def _score_stock(s: Dict[str, Any]) -> int:
    score = 50
    cp = s.get("change_pct") or 0
    if cp > 5:
        score += 15
    elif cp > 2:
        score += 8
    elif cp > 0:
        score += 3
    elif cp < -3:
        score -= 10
    pe = s.get("pe")
    if pe and pe > 0:
        if pe < 15:
            score += 10
        elif pe < 30:
            score += 5
        elif pe > 60:
            score -= 8
    mc = s.get("market_cap") or 0
    if mc > 1000:
        score += 5
    elif mc < 50:
        score -= 5
    to = s.get("turnover") or 0
    if to > 3:
        score += 3
    return max(0, min(100, score))


def _signal_from_score(score: int) -> str:
    if score >= 75:
        return "强烈关注"
    if score >= 60:
        return "值得关注"
    if score >= 40:
        return "中性观望"
    return "谨慎回避"


def _risk_from_score(score: int) -> str:
    if score >= 75:
        return "低"
    if score >= 60:
        return "中"
    if score >= 40:
        return "中"
    return "高"


def _default_reason(s: Dict[str, Any], score: int) -> str:
    cp = s.get("change_pct") or 0
    pe = s.get("pe")
    parts = []
    if cp > 0:
        parts.append(f"当日上涨{cp:.2f}%")
    elif cp < 0:
        parts.append(f"当日下跌{abs(cp):.2f}%")
    if pe:
        parts.append(f"PE {pe:.1f}")
    parts.append(f"综合评分 {score}")
    return "；".join(parts) + "。"


def _build_rec_prompt(stocks: List[Dict[str, Any]]) -> str:
    lines = "\n".join(
        f"{s['code']} {s['name']} 涨跌幅={s.get('change_pct')} PE={s.get('pe')} "
        f"总市值(亿)={s.get('market_cap')} 换手率={s.get('turnover')}"
        for s in stocks
    )
    return (
        "以下是今日A股量化初筛出的候选（已按综合评分排序）：\n"
        f"{lines}\n\n"
        "请为每只股票输出一句简明AI解读（不超过45字）、信号（强烈关注/值得关注/中性观望/谨慎回避）、"
        "风险等级（低/中/高）。严格只输出JSON数组，不要任何额外文字：\n"
        '[{"code":"600519","reason":"...","signal":"值得关注","risk_level":"中"}]'
    )


def _parse_rec_json(text: str) -> Dict[str, Dict[str, str]]:
    if not text:
        return {}
    t = text.strip()
    if "```" in t:
        t = t.split("```")[1]
        if t.startswith("json"):
            t = t[4:]
    start = t.find("[")
    end = t.rfind("]")
    if start == -1 or end == -1:
        return {}
    try:
        arr = json.loads(t[start:end + 1])
    except Exception:
        return {}
    out: Dict[str, Dict[str, str]] = {}
    for item in arr:
        code = item.get("code")
        if code:
            out[code] = {
                "reason": item.get("reason", ""),
                "signal": item.get("signal", ""),
                "risk_level": item.get("risk_level", ""),
            }
    return out


def _rows_to_recs(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [
        {
            "code": r["code"],
            "name": r["name"],
            "price": r["price"],
            "change_pct": r["change_pct"],
            "score": r["score"],
            "signal": r["signal"],
            "reason": r["reason"],
            "risk_level": r["risk_level"],
        }
        for r in rows
    ]


async def _call_llm_once(system: str, user: str, model_config: Dict[str, Any]) -> str:
    """调用外部 LLM（非流式），返回完整文本"""
    if not model_config.get("api_key"):
        return ""
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": user})
    payload = {
        "model": model_config.get("model_id", model_config.get("id", "deepseek-chat")),
        "messages": messages,
        "stream": False,
        "temperature": 0.7,
        "max_tokens": 1500,
    }
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {model_config['api_key']}",
    }
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                f"{model_config['base_url']}/v1/chat/completions",
                headers=headers,
                json=payload,
            )
            if resp.status_code != 200:
                return ""
            data = resp.json()
            return data.get("choices", [{}])[0].get("message", {}).get("content", "")
    except Exception as e:
        print(f"LLM once call error: {e}")
        return ""


async def _call_llm_stream(system: str, user: str, model_config: Dict[str, Any]) -> AsyncGenerator[str, None]:
    """调用外部 LLM API（SSE 流式），同时返回 token usage"""
    if not model_config.get("api_key"):
        yield "【系统提示】当前模型未配置 API Key。\n"
        yield "请进入「管理后台 → LLM配置」填写 API Key、Base URL 和 Model。\n\n"
        return

    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": user})

    payload = {
        "model": model_config.get("model_id", model_config.get("id", "deepseek-chat")),
        "messages": messages,
        "stream": True,
        "stream_options": {"include_usage": True},
        "temperature": 0.7,
        "max_tokens": 2048,
    }

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {model_config['api_key']}",
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream(
                "POST",
                f"{model_config['base_url']}/v1/chat/completions",
                headers=headers,
                json=payload,
            ) as response:
                if response.status_code != 200:
                    text = await response.aread()
                    yield f"【API错误】状态码 {response.status_code}：{text.decode()[:200]}\n"
                    return

                async for line in response.aiter_lines():
                    if not line or not line.startswith("data: "):
                        continue
                    data = line[6:]
                    if data == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data)
                        # 标准流式 chunk 输出内容
                        delta = chunk.get("choices", [{}])[0].get("delta", {})
                        content = delta.get("content", "")
                        if content:
                            yield content
                        # 部分 provider 在最后一个 chunk 返回 usage
                        usage = chunk.get("usage")
                        if usage:
                            prompt_tokens = usage.get("prompt_tokens", 0)
                            completion_tokens = usage.get("completion_tokens", 0)
                            total_tokens = usage.get("total_tokens", prompt_tokens + completion_tokens)
                            if total_tokens > 0:
                                yield f"\n__TOKENS__:{total_tokens}__"
                    except json.JSONDecodeError:
                        continue
    except Exception as e:
        yield f"\n【请求异常】{str(e)}\n"



async def diagnose_stock(code: str) -> Dict[str, Any]:
    """生成AI诊断报告（非流式）"""
    quote = get_stock_quote(code)
    klines = get_kline_data(code, "daily", days=60)
    indicators = calculate_indicators(klines)

    score = 50
    signals = []

    if indicators.get("ma5") and indicators.get("ma20"):
        if indicators["ma5"] > indicators["ma20"]:
            score += 10
            signals.append("MA5上穿MA20，短期趋势向上")
        else:
            score -= 10
            signals.append("MA5低于MA20，短期承压")

    if indicators.get("macd_hist"):
        if indicators["macd_hist"] > 0:
            score += 8
            signals.append("MACD红柱，多头动能")
        else:
            score -= 8
            signals.append("MACD绿柱，空头动能")

    if indicators.get("rsi14"):
        rsi = indicators["rsi14"]
        if rsi > 70:
            score -= 10
            signals.append(f"RSI={rsi}，进入超买区")
        elif rsi < 30:
            score += 10
            signals.append(f"RSI={rsi}，进入超卖区")
        else:
            signals.append(f"RSI={rsi}，处于中性区域")

    if quote.get("pe") and quote["pe"] < 20:
        score += 5
        signals.append("PE较低，估值合理")

    score = max(0, min(100, score))

    latest = klines[-1] if klines else {}
    support = indicators.get("boll_down", latest.get("low", quote["price"]) * 0.95)
    pressure = indicators.get("boll_up", latest.get("high", quote["price"]) * 1.05)

    if score >= 75:
        signal = "强烈关注"
        trend = "上升趋势"
        risk = "低"
        suggestion = "技术指标积极，可考虑逢低布局"
    elif score >= 60:
        signal = "值得关注"
        trend = "震荡上行"
        risk = "中"
        suggestion = "趋势向好，但需关注量能配合"
    elif score >= 40:
        signal = "中性观望"
        trend = "震荡整理"
        risk = "中"
        suggestion = "方向不明，建议观望等待信号"
    else:
        signal = "谨慎回避"
        trend = "下行风险"
        risk = "高"
        suggestion = "技术指标偏弱，注意控制风险"

    return {
        "code": code,
        "name": quote["name"],
        "score": score,
        "signal": signal,
        "trend": trend,
        "support": round(support, 2),
        "pressure": round(pressure, 2),
        "risk_level": risk,
        "reason": "；".join(signals),
        "suggestion": suggestion,
        "indicators": indicators,
        "generated_at": datetime.now().isoformat(),
    }


async def _stream_rule_based(code: str) -> AsyncGenerator[str, None]:
    """本地规则诊断的逐字流式输出（LLM不可用时的兜底）"""
    result = await diagnose_stock(code)
    sections = [
        f"正在分析 {result['name']}({code})...\n\n",
        f"【综合评分】{result['score']}/100\n",
        f"【信号判断】{result['signal']}\n",
        f"【趋势判断】{result['trend']}\n\n",
        f"【技术解读】\n{result['reason']}\n\n",
        f"【关键价位】\n支撑位：{result['support']} 元\n压力位：{result['pressure']} 元\n\n",
        f"【操作建议】\n{result['suggestion']}\n\n",
        f"【风险提示】\n当前风险等级：{result['risk_level']}。",
        " 股票投资有风险，以上分析仅供参考，不构成投资建议。",
    ]
    for section in sections:
        for char in section:
            yield char
            await asyncio.sleep(0.008)


async def diagnose_stock_stream(code: str, model_config: Dict[str, Any] = None) -> AsyncGenerator[str, None]:
    """流式AI诊断输出（优先LLM，兜底本地规则）"""
    from .admin_service import get_models_config

    if model_config is None:
        models = get_models_config().get("models", [])
        model_config = next((m for m in models if m.get("default")), models[0] if models else None)

    if not model_config or not model_config.get("api_key"):
        async for chunk in _stream_rule_based(code):
            yield chunk
        return

    quote = get_stock_quote(code)
    klines = get_kline_data(code, "daily", days=60)
    indicators = calculate_indicators(klines)

    user_prompt = DIAGNOSE_PROMPT + f"""
股票代码：{code}
股票名称：{quote.get('name', 'Unknown')}
当前价格：{quote.get('price', 'N/A')} 元
涨跌幅：{quote.get('change_pct', 'N/A')}%
市盈率PE：{quote.get('pe', 'N/A')}
市净率PB：{quote.get('pb', 'N/A')}

技术指标：
MA5：{indicators.get('ma5', 'N/A')}
MA10：{indicators.get('ma10', 'N/A')}
MA20：{indicators.get('ma20', 'N/A')}
MA60：{indicators.get('ma60', 'N/A')}
MACD柱状：{indicators.get('macd_hist', 'N/A')}
RSI(14)：{indicators.get('rsi14', 'N/A')}
布林上轨：{indicators.get('boll_up', 'N/A')}
布林下轨：{indicators.get('boll_down', 'N/A')}
"""

    buffer = ""
    async for chunk in _call_llm_stream("", user_prompt, model_config):
        buffer += chunk
        yield chunk
    # 若 LLM 未返回有效内容，回退到本地规则诊断，避免空输出
    if not buffer.strip():
        async for chunk in _stream_rule_based(code):
            yield chunk



async def get_daily_recommendations() -> List[Dict[str, Any]]:
    """每日AI选股：全市场扫描 + 量化打分 + LLM解读，结果按日缓存到数据库。"""
    from . import db
    from datetime import date as _date

    today = _date.today().isoformat()
    cached = db.get_recommendation_history(today)
    if cached:
        return _rows_to_recs(cached)

    stocks = get_all_a_shares()
    candidates = []
    for s in stocks:
        name = s.get("name", "")
        if not name or "ST" in name or name.startswith("*"):
            continue
        mc = s.get("market_cap") or 0
        pe = s.get("pe")
        if mc < 30:
            continue
        if pe is None or pe <= 0:
            continue
        if (s.get("change_pct") or 0) <= -5:
            continue
        score = _score_stock(s)
        candidates.append((score, s))

    candidates.sort(key=lambda x: x[0], reverse=True)
    top = candidates[:12]

    model_config = _resolve_default_model_config()
    reasons: Dict[str, Dict[str, str]] = {}
    if model_config and model_config.get("api_key") and top:
        prompt = _build_rec_prompt([s for _, s in top])
        text = await _call_llm_once(REC_SYSTEM, prompt, model_config)
        reasons = _parse_rec_json(text)

    recommendations = []
    for score, s in top:
        code = s["code"]
        name = s["name"]
        info = reasons.get(code, {})
        reason = info.get("reason") or _default_reason(s, score)
        signal = info.get("signal") or _signal_from_score(score)
        risk = info.get("risk_level") or _risk_from_score(score)
        recommendations.append({
            "code": code,
            "name": name,
            "price": s.get("price"),
            "change_pct": s.get("change_pct"),
            "score": score,
            "signal": signal,
            "reason": reason,
            "risk_level": risk,
            "metrics": {
                "pe": s.get("pe"),
                "market_cap": s.get("market_cap"),
                "turnover": s.get("turnover"),
            },
        })

    # 落库，供"昨日推荐对比"使用
    db.save_recommendation_history(today, recommendations)
    return recommendations


async def chat_about_stock(message: str, history: List[Dict[str, Any]], model_config: Dict[str, Any] = None) -> AsyncGenerator[str, None]:
    """AI股票问答（流式）"""
    from .admin_service import get_models_config

    if model_config is None:
        models = get_models_config().get("models", [])
        model_config = next((m for m in models if m.get("default")), models[0] if models else None)

    if not model_config or not model_config.get("api_key"):
        response = f"我收到了您的问题：{message}\n\n在实际部署环境中，这里会调用大语言模型（如DeepSeek/豆包）进行深度分析。当前未配置 LLM_API_KEY，使用模拟模式。\n\n您可以问我：\n1. 某只股票的技术分析\n2. 市场热点解读\n3. 投资策略建议\n4. 财务指标含义"
        for char in response:
            yield char
            await asyncio.sleep(0.01)
        return

    user_prompt = CHAT_PROMPT + message
    async for chunk in _call_llm_stream("", user_prompt, model_config):
        yield chunk

