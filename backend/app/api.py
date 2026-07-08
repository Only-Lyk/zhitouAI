from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse
from typing import List, Optional
from . import data_service, ai_service
from .models import MarketIndex, StockBasic, AIDiagnosisResult, AIRecommendation, ChatRequest
import json

router = APIRouter()


@router.get("/api/market/indices", response_model=List[MarketIndex])
async def market_indices():
    """大盘指数"""
    data = data_service.get_market_indices()
    return data


@router.get("/api/stock/quote")
async def stock_quote(code: str = Query(..., description="股票代码")):
    """股票行情"""
    return data_service.get_stock_quote(code)


@router.get("/api/stock/kline")
async def stock_kline(code: str = Query(...), period: str = Query("daily"), days: int = Query(120)):
    """K线数据"""
    return data_service.get_kline_data(code, period, days)


@router.get("/api/stock/indicators")
async def stock_indicators(code: str = Query(...)):
    """技术指标"""
    klines = data_service.get_kline_data(code, days=60)
    return data_service.calculate_indicators(klines)


@router.get("/api/stock/search")
async def search_stocks(keyword: str = Query(..., min_length=1)):
    """搜索股票"""
    return data_service.search_stocks(keyword)


@router.get("/api/market/sectors")
async def hot_sectors():
    """热点板块"""
    return data_service.get_hot_sectors()


@router.get("/api/ai/diagnose")
async def ai_diagnose(code: str = Query(...)):
    """AI诊断（非流式）"""
    result = await ai_service.diagnose_stock(code)
    return result


@router.get("/api/ai/diagnose/stream")
async def ai_diagnose_stream(code: str = Query(...)):
    """AI诊断（流式SSE）"""
    async def event_generator():
        async for chunk in ai_service.diagnose_stock_stream(code):
            yield f"data: {json.dumps({'chunk': chunk}, ensure_ascii=False)}\n\n"
        yield "data: [DONE]\n\n"
    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/api/ai/recommendations")
async def ai_recommendations():
    """AI每日推荐"""
    return await ai_service.get_daily_recommendations()


@router.post("/api/ai/chat")
async def ai_chat(req: ChatRequest):
    """AI问答（流式SSE）"""
    async def event_generator():
        async for chunk in ai_service.chat_about_stock(req.message, [h.model_dump() for h in req.history]):
            yield f"data: {json.dumps({'chunk': chunk}, ensure_ascii=False)}\n\n"
        yield "data: [DONE]\n\n"
    return StreamingResponse(event_generator(), media_type="text/event-stream")
