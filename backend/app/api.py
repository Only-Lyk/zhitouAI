from fastapi import APIRouter, Query, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from typing import List, Optional
from . import data_service, ai_service
from .models import (
    MarketIndex, StockBasic, AIDiagnosisResult, AIRecommendation, ChatRequest,
    UserRegister, UserLogin, UserResponse, CreditInfo, TransactionRecord,
    AdminSetting, AdminSettingsUpdate, AdminUserList, AdminTransactionList,
)
from .auth import (
    get_current_user, get_current_admin, hash_password, verify_password,
    create_access_token, get_password_hash,
)
from .db import get_db
from . import credit_service, admin_service
import json
import traceback

router = APIRouter()


# ========== Auth ==========

@router.post("/api/auth/register", response_model=UserResponse)
async def register(req: UserRegister):
    with get_db() as db:
        cursor = db.execute("SELECT id FROM users WHERE username = ?", (req.username,))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="用户名已存在")
        cursor = db.execute("SELECT id FROM users WHERE email = ?", (req.email,))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="邮箱已注册")

        db.execute(
            "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
            (req.username, req.email, get_password_hash(req.password)),
        )
        db.commit()
        cursor = db.execute("SELECT * FROM users WHERE username = ?", (req.username,))
        user = dict(cursor.fetchone())

    # 新用户送初始积分
    init_credits = int(credit_service.get_setting("register_gift_credits", "50"))
    if init_credits > 0:
        credit_service.recharge_credits(
            user["id"], init_credits, "新用户注册赠送"
        )

    return {"id": user["id"], "username": user["username"], "email": user["email"], "is_admin": user["is_admin"]}


@router.post("/api/auth/login")
async def login(req: UserLogin):
    with get_db() as db:
        cursor = db.execute("SELECT * FROM users WHERE username = ?", (req.username,))
        user = cursor.fetchone()
        if not user or not verify_password(req.password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="用户名或密码错误")

    token = create_access_token({"sub": str(user["id"]), "username": user["username"], "is_admin": user["is_admin"]})
    credits = credit_service.get_user_credits(user["id"])
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "username": user["username"],
            "email": user["email"],
            "is_admin": user["is_admin"],
        },
        "credits": credits,
    }


@router.get("/api/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "id": current_user["id"],
        "username": current_user["username"],
        "email": current_user["email"],
        "is_admin": current_user["is_admin"],
    }


@router.get("/api/auth/credits")
async def get_credits(current_user: dict = Depends(get_current_user)):
    return credit_service.get_user_credits(current_user["id"])


@router.get("/api/auth/transactions")
async def get_my_transactions(
    page: int = Query(1), page_size: int = Query(20),
    current_user: dict = Depends(get_current_user)
):
    offset = (page - 1) * page_size
    with get_db() as db:
        cursor = db.execute(
            "SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
            (current_user["id"], page_size, offset),
        )
        transactions = [dict(row) for row in cursor.fetchall()]
        cursor = db.execute("SELECT COUNT(*) as total FROM transactions WHERE user_id = ?", (current_user["id"],))
        total = cursor.fetchone()["total"]
    return {"transactions": transactions, "total": total, "page": page, "page_size": page_size}


# ========== Market ==========

@router.get("/api/market/indices", response_model=List[MarketIndex])
async def market_indices():
    return data_service.get_market_indices()


@router.get("/api/stock/quote")
async def stock_quote(code: str = Query(..., description="股票代码")):
    return data_service.get_stock_quote(code)


@router.get("/api/stock/kline")
async def stock_kline(code: str = Query(...), period: str = Query("daily"), days: int = Query(120)):
    return data_service.get_kline_data(code, period, days)


@router.get("/api/stock/indicators")
async def stock_indicators(code: str = Query(...), period: str = Query("daily")):
    klines = data_service.get_kline_data(code, period, days=60)
    return data_service.calculate_indicators(klines)


@router.get("/api/stock/search")
async def search_stocks(keyword: str = Query(..., min_length=1)):
    return data_service.search_stocks(keyword)


@router.get("/api/market/sectors")
async def hot_sectors():
    return data_service.get_hot_sectors()


# ========== AI (with credit check) ==========

def _check_ai_credit(user_id: int, action: str, description: str) -> None:
    cost = credit_service.get_ai_cost(action)
    if cost <= 0:
        return
    ok = credit_service.consume_credits(user_id, cost, description)
    if not ok:
        raise HTTPException(
            status_code=402,
            detail=f"积分不足，{description}需要消耗 {cost} 积分，请充值后再试。"
        )


@router.get("/api/ai/diagnose")
async def ai_diagnose(
    code: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    _check_ai_credit(current_user["id"], "diagnose", f"AI诊断 {code}")
    result = await ai_service.diagnose_stock(code)
    return result


@router.get("/api/ai/diagnose/stream")
async def ai_diagnose_stream(
    code: str = Query(...),
    current_user: dict = Depends(get_current_user)
):
    cost = credit_service.get_ai_cost("diagnose")
    if cost > 0:
        ok = credit_service.consume_credits(current_user["id"], cost, f"AI诊断 {code}")
        if not ok:
            async def error_gen():
                yield f"data: {json.dumps({'chunk': f'积分不足，AI诊断需要消耗 {cost} 积分，请充值后再试。'}, ensure_ascii=False)}\n\n"
                yield "data: [DONE]\n\n"
            return StreamingResponse(error_gen(), media_type="text/event-stream")

    async def event_generator():
        async for chunk in ai_service.diagnose_stock_stream(code):
            yield f"data: {json.dumps({'chunk': chunk}, ensure_ascii=False)}\n\n"
        yield "data: [DONE]\n\n"
    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/api/ai/recommendations")
async def ai_recommendations(current_user: dict = Depends(get_current_user)):
    _check_ai_credit(current_user["id"], "recommendation", "AI每日推荐")
    return await ai_service.get_daily_recommendations()


@router.post("/api/ai/chat")
async def ai_chat(
    req: ChatRequest,
    current_user: dict = Depends(get_current_user)
):
    cost = credit_service.get_ai_cost("chat")
    if cost > 0:
        ok = credit_service.consume_credits(current_user["id"], cost, f"AI问答: {req.message[:20]}...")
        if not ok:
            async def error_gen():
                yield f"data: {json.dumps({'chunk': f'积分不足，AI问答需要消耗 {cost} 积分，请充值后再试。'}, ensure_ascii=False)}\n\n"
                yield "data: [DONE]\n\n"
            return StreamingResponse(error_gen(), media_type="text/event-stream")

    async def event_generator():
        async for chunk in ai_service.chat_about_stock(req.message, [h.model_dump() for h in req.history]):
            yield f"data: {json.dumps({'chunk': chunk}, ensure_ascii=False)}\n\n"
        yield "data: [DONE]\n\n"
    return StreamingResponse(event_generator(), media_type="text/event-stream")


# ========== Admin ==========

@router.get("/api/admin/settings")
async def admin_get_settings(current_user: dict = Depends(get_current_admin)):
    data = admin_service.get_all_settings()
    # API Key 掩码处理：只显示前4位和后4位
    key = data.get("llm_api_key", "")
    if len(key) > 12:
        data["llm_api_key"] = key[:4] + "****" + key[-4:]
    elif key:
        data["llm_api_key"] = "****"
    return data


@router.post("/api/admin/settings")
async def admin_update_settings(
    settings: AdminSettingsUpdate,
    current_user: dict = Depends(get_current_admin)
):
    old_settings = admin_service.get_all_settings()
    for key, value in settings.settings.items():
        # 如果 API Key 是掩码格式，保留原值
        if key == "llm_api_key" and "****" in str(value):
            continue
        admin_service.update_setting(key, str(value))
    return {"success": True}


@router.get("/api/admin/users")
async def admin_users(
    page: int = Query(1), page_size: int = Query(20),
    current_user: dict = Depends(get_current_admin)
):
    return admin_service.get_all_users(page, page_size)


@router.get("/api/admin/transactions")
async def admin_transactions(
    page: int = Query(1), page_size: int = Query(50),
    current_user: dict = Depends(get_current_admin)
):
    return admin_service.get_all_transactions(page, page_size)


@router.post("/api/admin/recharge")
async def admin_recharge(
    user_id: int = Query(...),
    amount: int = Query(...),
    description: str = Query("管理员充值"),
    current_user: dict = Depends(get_current_admin)
):
    if amount <= 0:
        raise HTTPException(status_code=400, detail="充值金额必须大于0")
    admin_service.admin_recharge(user_id, amount, description)
    return {"success": True, "message": f"已为用户 {user_id} 充值 {amount} 积分"}
