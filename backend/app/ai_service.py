import os
import json
import asyncio
import httpx
from typing import List, Dict, Any, AsyncGenerator
from datetime import datetime
from .data_service import get_stock_quote, get_kline_data, calculate_indicators

# ---- LLM 配置 ----
LLM_API_KEY = os.environ.get("LLM_API_KEY", "")
LLM_BASE_URL = os.environ.get("LLM_BASE_URL", "https://api.deepseek.com")
LLM_MODEL = os.environ.get("LLM_MODEL", "deepseek-chat")
LLM_ENABLED = bool(LLM_API_KEY)

DEFAULT_HEADERS = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {LLM_API_KEY}",
}

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


async def _call_llm_stream(system: str, user: str) -> AsyncGenerator[str, None]:
    """调用外部 LLM API（SSE 流式）"""
    if not LLM_ENABLED:
        # 未配置 API Key，返回提示
        yield "【系统提示】当前未配置 LLM API Key，使用模拟数据模式。\n"
        yield "请在服务器环境变量中设置 LLM_API_KEY、LLM_BASE_URL 和 LLM_MODEL。\n\n"
        return

    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": user})

    payload = {
        "model": LLM_MODEL,
        "messages": messages,
        "stream": True,
        "temperature": 0.7,
        "max_tokens": 2048,
    }

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream(
                "POST",
                f"{LLM_BASE_URL}/v1/chat/completions",
                headers=DEFAULT_HEADERS,
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
                        delta = chunk.get("choices", [{}])[0].get("delta", {})
                        content = delta.get("content", "")
                        if content:
                            yield content
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


async def diagnose_stock_stream(code: str) -> AsyncGenerator[str, None]:
    """流式AI诊断输出（优先LLM，兜底本地规则）"""
    if not LLM_ENABLED:
        # 模拟流式输出
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

    async for chunk in _call_llm_stream("", user_prompt):
        yield chunk


async def get_daily_recommendations() -> List[Dict[str, Any]]:
    """每日AI选股推荐"""
    watchlist = ["600519", "000858", "002594", "300750", "000333", "600036", "601318", "600276"]
    recommendations = []
    for code in watchlist[:6]:
        diag = await diagnose_stock(code)
        quote = get_stock_quote(code)
        recommendations.append({
            "code": code,
            "name": quote["name"],
            "price": quote["price"],
            "change_pct": quote["change_pct"],
            "score": diag["score"],
            "signal": diag["signal"],
            "reason": diag["reason"].split("。")[0] + "。" if diag["reason"] else "",
            "risk_level": diag["risk_level"],
        })
    recommendations.sort(key=lambda x: x["score"], reverse=True)
    return recommendations


async def chat_about_stock(message: str, history: List[Dict[str, Any]]) -> AsyncGenerator[str, None]:
    """AI股票问答（流式）"""
    if not LLM_ENABLED:
        response = f"我收到了您的问题：{message}\n\n在实际部署环境中，这里会调用大语言模型（如DeepSeek/豆包）进行深度分析。当前未配置 LLM_API_KEY，使用模拟模式。\n\n您可以问我：\n1. 某只股票的技术分析\n2. 市场热点解读\n3. 投资策略建议\n4. 财务指标含义"
        for char in response:
            yield char
            await asyncio.sleep(0.01)
        return

    user_prompt = CHAT_PROMPT + message
    async for chunk in _call_llm_stream("", user_prompt):
        yield chunk
