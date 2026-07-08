import json
import sqlite3
from .db import get_db
from typing import List, Dict, Any


def get_all_settings() -> Dict[str, str]:
    with get_db() as db:
        cursor = db.execute("SELECT key, value FROM admin_settings")
        return {row["key"]: row["value"] for row in cursor.fetchall()}


def update_setting(key: str, value: str) -> None:
    with get_db() as db:
        db.execute(
            "INSERT INTO admin_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) "
            "ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP",
            (key, value),
        )
        db.commit()


def get_models_config() -> Dict[str, Any]:
    """获取模型配置（结构化）"""
    try:
        raw = get_all_settings().get("llm_models_config", "{}")
        cfg = json.loads(raw)
        if not isinstance(cfg, dict) or "models" not in cfg:
            return {"models": []}
        return cfg
    except Exception:
        return {"models": []}


def save_models_config(config: Dict[str, Any]) -> None:
    update_setting("llm_models_config", json.dumps(config, ensure_ascii=False))


def get_all_users(page: int = 1, page_size: int = 20) -> Dict[str, Any]:
    offset = (page - 1) * page_size
    with get_db() as db:
        cursor = db.execute(
            """
            SELECT u.id, u.username, u.email, u.is_admin, u.created_at, u.default_model,
                   COALESCE(c.balance, 0) as credits,
                   COALESCE(c.total_consumed, 0) as total_consumed,
                   COALESCE(c.total_recharged, 0) as total_recharged
            FROM users u
            LEFT JOIN credits c ON u.id = c.user_id
            ORDER BY u.id DESC
            LIMIT ? OFFSET ?
            """,
            (page_size, offset),
        )
        users = [dict(row) for row in cursor.fetchall()]

        cursor = db.execute("SELECT COUNT(*) as total FROM users")
        total = cursor.fetchone()["total"]

    return {"users": users, "total": total, "page": page, "page_size": page_size}


def get_all_transactions(page: int = 1, page_size: int = 50) -> Dict[str, Any]:
    offset = (page - 1) * page_size
    with get_db() as db:
        cursor = db.execute(
            """
            SELECT t.*, u.username
            FROM transactions t
            JOIN users u ON t.user_id = u.id
            ORDER BY t.created_at DESC
            LIMIT ? OFFSET ?
            """,
            (page_size, offset),
        )
        transactions = [dict(row) for row in cursor.fetchall()]

        cursor = db.execute("SELECT COUNT(*) as total FROM transactions")
        total = cursor.fetchone()["total"]

    return {"transactions": transactions, "total": total, "page": page, "page_size": page_size}


def admin_recharge(user_id: int, amount: int, description: str) -> None:
    from .credit_service import recharge_credits
    recharge_credits(user_id, amount, description)

