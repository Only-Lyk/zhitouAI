import json
from datetime import datetime, time
from typing import Optional, Dict, Any, List
from .db import get_db


def get_user_credits(user_id: int) -> dict:
    with get_db() as db:
        cursor = db.execute(
            "SELECT balance, total_consumed, total_recharged FROM credits WHERE user_id = ?",
            (user_id,),
        )
        row = cursor.fetchone()
        if row is None:
            db.execute(
                "INSERT INTO credits (user_id, balance) VALUES (?, 0)", (user_id,)
            )
            db.commit()
            return {"balance": 0, "total_consumed": 0, "total_recharged": 0}
        return dict(row)


def get_setting(key: str, default: str = "0") -> str:
    with get_db() as db:
        cursor = db.execute(
            "SELECT value FROM admin_settings WHERE key = ?", (key,)
        )
        row = cursor.fetchone()
        return row["value"] if row else default


def _get_credit_exchange_rate() -> int:
    return int(get_setting("credit_exchange_rate", "100"))


def _get_profit_ratio() -> float:
    return float(get_setting("profit_ratio", "1.3"))


def _get_models_config() -> List[Dict[str, Any]]:
    try:
        cfg = json.loads(get_setting("llm_models_config", "{}"))
        return cfg.get("models", [])
    except Exception:
        return []


def _get_model_config(model_id: str) -> Optional[Dict[str, Any]]:
    for m in _get_models_config():
        if m.get("id") == model_id:
            return m
    return None


def _is_peak_time(now: datetime, model_id: Optional[str] = None) -> bool:
    cfg = _get_models_config()
    if not cfg:
        return True
    model = None
    if model_id:
        model = next((m for m in cfg if m.get("id") == model_id), None)
    if not model:
        model = next((m for m in cfg if m.get("default")), cfg[0])
    peak_start = model.get("peak_start", "09:00")
    peak_end = model.get("peak_end", "23:00")
    try:
        start_h, start_m = map(int, peak_start.split(":"))
        end_h, end_m = map(int, peak_end.split(":"))
        start_t = time(start_h, start_m)
        end_t = time(end_h, end_m)
        current_t = now.time()
        if start_t <= end_t:
            return start_t <= current_t <= end_t
        return current_t >= start_t or current_t <= end_t
    except Exception:
        return True


def calculate_ai_cost(model_id: str, tokens_used: int) -> int:
    """根据模型、token 用量、峰谷时段计算应扣积分（向上取整）"""
    if tokens_used <= 0:
        return 0
    model = _get_model_config(model_id)
    if not model:
        model = next((m for m in _get_models_config() if m.get("default")), None)
    if not model:
        return 0

    price_per_1k = model.get("peak_price_per_1k", 0.01) if _is_peak_time(datetime.now(), model_id) else model.get("valley_price_per_1k", 0.005)
    exchange_rate = _get_credit_exchange_rate()
    profit_ratio = _get_profit_ratio()

    # cost_yuan = (tokens / 1000) * price_per_1k
    # cost_credits = cost_yuan * exchange_rate * profit_ratio
    cost_credits = (tokens_used / 1000) * price_per_1k * exchange_rate * profit_ratio
    return max(1, int(cost_credits + 0.9999))  # 向上取整，至少扣1分


def consume_credits(user_id: int, amount: int, description: str, tokens_used: int = 0, model_id: str = None, price_per_1k: float = None) -> bool:
    with get_db() as db:
        cursor = db.execute(
            "SELECT balance FROM credits WHERE user_id = ?", (user_id,)
        )
        row = cursor.fetchone()
        if row is None:
            return False
        balance = row["balance"]
        if balance < amount:
            return False
        db.execute(
            "UPDATE credits SET balance = balance - ?, total_consumed = total_consumed + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
            (amount, amount, user_id),
        )
        db.execute(
            "INSERT INTO transactions (user_id, type, amount, description, tokens_used, model_id, price_per_1k) VALUES (?, 'consume', ?, ?, ?, ?, ?)",
            (user_id, amount, description, tokens_used, model_id, price_per_1k),
        )
        db.commit()
        return True


def consume_ai_credits(user_id: int, model_id: str, tokens_used: int, description: str) -> Dict[str, Any]:
    """AI 调用后根据实际 token 消耗扣积分，返回扣费结果"""
    cost = calculate_ai_cost(model_id, tokens_used)
    if cost <= 0:
        return {"success": True, "cost": 0, "balance": get_user_credits(user_id)["balance"]}
    model = _get_model_config(model_id)
    price_per_1k = 0
    if model:
        price_per_1k = model.get("peak_price_per_1k", 0.01) if _is_peak_time(datetime.now(), model_id) else model.get("valley_price_per_1k", 0.005)
    ok = consume_credits(user_id, cost, description, tokens_used, model_id, price_per_1k)
    if not ok:
        return {"success": False, "cost": cost, "balance": get_user_credits(user_id)["balance"]}
    return {"success": True, "cost": cost, "balance": get_user_credits(user_id)["balance"]}


def recharge_credits(user_id: int, amount: int, description: str) -> None:
    with get_db() as db:
        cursor = db.execute(
            "SELECT 1 FROM credits WHERE user_id = ?", (user_id,)
        )
        if cursor.fetchone() is None:
            db.execute(
                "INSERT INTO credits (user_id, balance, total_recharged) VALUES (?, ?, ?)",
                (user_id, amount, amount),
            )
        else:
            db.execute(
                "UPDATE credits SET balance = balance + ?, total_recharged = total_recharged + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
                (amount, amount, user_id),
            )
        db.execute(
            "INSERT INTO transactions (user_id, type, amount, description) VALUES (?, 'recharge', ?, ?)",
            (user_id, amount, description),
        )
        db.commit()


def yuan_to_credits(yuan: float) -> int:
    """金额转积分：1元 = credit_exchange_rate 积分"""
    rate = _get_credit_exchange_rate()
    return int(yuan * rate)
