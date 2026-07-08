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
    get_current_user, get_current_admin, verify_password,
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

    return {"id": user["id"], "username": user["username"], "email": user["email"], "is_admin": user["is_admin"], "default_model": user.get("default_model")}


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
            "credits": credits["balance"],
            "default_model": user.get("default_model"),
        },
        "credits": credits,
    }


@router.get("/api/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    credits = credit_service.get_user_credits(current_user["id"])
    return {
        "id": current_user["id"],
        "username": current_user["username"],
        "email": current_user["email"],
        "is_admin": current_user["is_admin"],
        "credits": credits["balance"],
        "default_model": current_user.get("default_model"),
    }


@router.get("/api/auth/default-model")
async def get_default_model(current_user: dict = Depends(get_current_user)):
    model = _get_user_default_model(current_user["id"])
    return {"default_model": model}


@router.post("/api/auth/default-model")
async def set_default_model(
    req: dict,
    current_user: dict = Depends(get_current_user)
):
    model_id = req.get("model_id")
    models = admin_service.get_models_config().get("models", [])
    valid_ids = {m.get("id") for m in models}
    if model_id and model_id not in valid_ids:
        raise HTTPException(status_code=400, detail="无效的模型ID")
    with get_db() as db:
        db.execute(
            "UPDATE users SET default_model = ? WHERE id = ?",
            (model_id, current_user["id"]),
        )
        db.commit()
    return {"success": True, "default_model": model_id}


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


# ========== AI (with token-based credit) ==========

@router.get("/api/ai/models")
async def ai_models(current_user: dict = Depends(get_current_user)):
    """返回可用模型列表（隐藏 API Key）"""
    cfg = admin_service.get_models_config()
    models = []
    for m in cfg.get("models", []):
        models.append({
            "id": m.get("id"),
            "name": m.get("name"),
            "default": m.get("default", False),
            "peak_price_per_1k": m.get("peak_price_per_1k", 0),
            "valley_price_per_1k": m.get("valley_price_per_1k", 0),
            "peak_start": m.get("peak_start", "09:00"),
            "peak_end": m.get("peak_end", "23:00"),
        })
    return {"models": models}

def _get_user_default_model(user_id: int) -> Optional[str]:
    with get_db() as db:
        cursor = db.execute("SELECT default_model FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        return row["default_model"] if row and row["default_model"] else None


def _resolve_model_config(model_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
    models = admin_service.get_models_config().get("models", [])
    if not models:
        return None
    if model_id:
        for m in models:
            if m.get("id") == model_id:
                return m
    return next((m for m in models if m.get("default")), models[0])


async def _consume_after_stream(user_id: int, model_id: Optional[str], full_text: str, description: str) -> None:
    """流式结束后根据实际 token 消耗扣积分"""
    import re
    match = re.search(r"__TOKENS__:([0-9]+)__", full_text)
    if not match:
        return
    tokens = int(match.group(1))
    actual_model_id = model_id or _resolve_model_config().get("id")
    credit_service.consume_ai_credits(user_id, actual_model_id, tokens, description)


@router.get("/api/ai/diagnose")
async def ai_diagnose(
    code: str = Query(...),
    model: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    model_config = _resolve_model_config(model)
    if not model_config or not model_config.get("api_key"):
        return await ai_service.diagnose_stock(code)

    cost = credit_service.calculate_ai_cost(model_config.get("id"), 1000)
    if cost > 0 and credit_service.get_user_credits(current_user["id"])["balance"] < cost:
        raise HTTPException(status_code=402, detail="积分余额不足，请充值后再试。")

    return await ai_service.diagnose_stock(code)


@router.get("/api/ai/diagnose/stream")
async def ai_diagnose_stream(
    code: str = Query(...),
    model: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    model_config = _resolve_model_config(model or _get_user_default_model(current_user["id"]))
    if not model_config or not model_config.get("api_key"):
        async def mock_gen():
            async for chunk in ai_service.diagnose_stock_stream(code, model_config):
                yield f"data: {json.dumps({'chunk': chunk}, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(mock_gen(), media_type="text/event-stream")

    cost = credit_service.calculate_ai_cost(model_config.get("id"), 1000)
    if cost > 0 and credit_service.get_user_credits(current_user["id"])["balance"] < cost:
        async def error_gen():
            yield f"data: {json.dumps({'chunk': '积分余额不足，请充值后再试。'}, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(error_gen(), media_type="text/event-stream")

    async def event_generator():
        buffer = ""
        async for chunk in ai_service.diagnose_stock_stream(code, model_config):
            buffer += chunk
            yield f"data: {json.dumps({'chunk': chunk}, ensure_ascii=False)}\n\n"
        await _consume_after_stream(current_user["id"], model_config.get("id"), buffer, f"AI诊断 {code}")
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/api/ai/recommendations")
async def ai_recommendations(
    model: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    model_config = _resolve_model_config(model or _get_user_default_model(current_user["id"]))
    if model_config and model_config.get("api_key"):
        cost = credit_service.calculate_ai_cost(model_config.get("id"), 500)
        if cost > 0:
            ok = credit_service.consume_credits(current_user["id"], cost, "AI每日推荐")
            if not ok:
                raise HTTPException(status_code=402, detail="积分余额不足，请充值后再试。")
    return await ai_service.get_daily_recommendations()


@router.post("/api/ai/chat")
async def ai_chat(
    req: ChatRequest,
    current_user: dict = Depends(get_current_user),
):
    model_config = _resolve_model_config(req.model or _get_user_default_model(current_user["id"]))
    if not model_config or not model_config.get("api_key"):
        async def mock_gen():
            async for chunk in ai_service.chat_about_stock(req.message, [h.model_dump() for h in req.history], model_config):
                yield f"data: {json.dumps({'chunk': chunk}, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(mock_gen(), media_type="text/event-stream")

    cost = credit_service.calculate_ai_cost(model_config.get("id"), 500)
    if cost > 0 and credit_service.get_user_credits(current_user["id"])["balance"] < cost:
        async def error_gen():
            yield f"data: {json.dumps({'chunk': '积分余额不足，请充值后再试。'}, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(error_gen(), media_type="text/event-stream")

    async def event_generator():
        buffer = ""
        async for chunk in ai_service.chat_about_stock(req.message, [h.model_dump() for h in req.history], model_config):
            buffer += chunk
            yield f"data: {json.dumps({'chunk': chunk}, ensure_ascii=False)}\n\n"
        await _consume_after_stream(current_user["id"], model_config.get("id"), buffer, f"AI问答: {req.message[:20]}...")
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")



# ========== Admin ==========

@router.get("/api/admin/settings")
async def admin_get_settings(current_user: dict = Depends(get_current_admin)):
    data = admin_service.get_all_settings()
    # 多模型配置保持 JSON 字符串返回，前端自行解析
    if "llm_models_config" not in data:
        data["llm_models_config"] = '{"models":[]}'
    # 对模型配置里的 api_key 做掩码处理
    try:
        cfg = json.loads(data.get("llm_models_config", "{}"))
        for m in cfg.get("models", []):
            key = m.get("api_key", "")
            if len(key) > 12:
                m["api_key"] = key[:4] + "****" + key[-4:]
            elif key:
                m["api_key"] = "****"
        data["llm_models_config"] = json.dumps(cfg, ensure_ascii=False)
    except Exception:
        pass
    return data


@router.post("/api/admin/settings")
async def admin_update_settings(
    settings: AdminSettingsUpdate,
    current_user: dict = Depends(get_current_admin)
):
    old_settings = admin_service.get_all_settings()
    for key, value in settings.settings.items():
        # 跳过掩码格式的 API Key，保留原值
        if key == "llm_models_config" and isinstance(value, dict):
            # 对传入的模型配置进行掩码还原：如果某个 api_key 是掩码，则保留旧值
            try:
                old_cfg = json.loads(old_settings.get("llm_models_config", "{}"))
                old_map = {m.get("id"): m for m in old_cfg.get("models", []) if m.get("id")}
                for m in value.get("models", []):
                    key_val = m.get("api_key", "")
                    if "****" in str(key_val) and m.get("id") in old_map:
                        m["api_key"] = old_map[m["id"]].get("api_key", "")
            except Exception:
                pass
            admin_service.save_models_config(value)
            continue
        # 复杂类型统一 JSON 序列化
        if isinstance(value, (dict, list)):
            admin_service.update_setting(key, json.dumps(value, ensure_ascii=False))
        else:
            admin_service.update_setting(key, str(value))
    return {"success": True}


@router.get("/api/admin/models")
async def admin_get_models(current_user: dict = Depends(get_current_admin)):
    return admin_service.get_models_config()


@router.post("/api/admin/models")
async def admin_update_models(
    config: dict,
    current_user: dict = Depends(get_current_admin)
):
    admin_service.save_models_config(config)
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
