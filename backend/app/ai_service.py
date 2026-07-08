import os
import json
from typing import List, Dict, Any, AsyncGenerator
from datetime import datetime
from .data_service import get_stock_quote, get_kline_data, calculate_indicators


async def diagnose_stock(code: str) -> Dict[str, Any]:
    """生成AI诊断报告（非流式）"""
    quote = get_stock_quote(code)
    klines = get_kline_data(code, days=60)
    indicators = calculate_indicators(klines)

    # 本地规则评分系统（当AI不可用时兜底）
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
    """流式AI诊断输出"""
    result = await diagnose_stock(code)

    # 模拟流式输出
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
            import asyncio
            await asyncio.sleep(0.008)


async def get_daily_recommendations() -> List[Dict[str, Any]]:
    """每日AI选股推荐"""
    # 实际部署时从热点板块或自选池中筛选
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
    # 实际部署时接入LLM
    response = f"我收到了您的问题：{message}\n\n在实际部署环境中，这里会调用大语言模型（如DeepSeek/豆包）进行深度分析。当前为演示模式，展示了系统的问答交互能力。\n\n您可以问我：\n1. 某只股票的技术分析\n2. 市场热点解读\n3. 投资策略建议\n4. 财务指标含义"
    for char in response:
        yield char
        import asyncio
        await asyncio.sleep(0.01)
