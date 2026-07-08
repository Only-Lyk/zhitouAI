from typing import Optional
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


def consume_credits(user_id: int, amount: int, description: str) -> bool:
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
            "INSERT INTO transactions (user_id, type, amount, description) VALUES (?, 'consume', ?, ?)",
            (user_id, amount, description),
        )
        db.commit()
        return True


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


def get_setting(key: str, default: str = "0") -> str:
    with get_db() as db:
        cursor = db.execute(
            "SELECT value FROM admin_settings WHERE key = ?", (key,)
        )
        row = cursor.fetchone()
        return row["value"] if row else default


def get_ai_cost(action: str) -> int:
    key_map = {
        "diagnose": "ai_diagnose_cost",
        "chat": "ai_chat_cost",
        "recommendation": "ai_recommendation_cost",
    }
    return int(get_setting(key_map.get(action, "ai_chat_cost"), "5"))
