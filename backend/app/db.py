import sqlite3
import os
import json
from contextlib import contextmanager
from typing import List, Dict, Any, Optional

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "zhitouai.db")
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

INIT_SQL = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    is_admin INTEGER DEFAULT 0,
    default_model TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS credits (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    balance INTEGER DEFAULT 0,
    total_consumed INTEGER DEFAULT 0,
    total_recharged INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    amount INTEGER NOT NULL,
    description TEXT,
    tokens_used INTEGER DEFAULT 0,
    model_id TEXT,
    price_per_1k REAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS watchlist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stock_code TEXT NOT NULL,
    stock_name TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, stock_code)
);

CREATE TABLE IF NOT EXISTS recommendation_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    code TEXT NOT NULL,
    name TEXT,
    price REAL,
    change_pct REAL,
    score INTEGER,
    signal TEXT,
    reason TEXT,
    risk_level TEXT,
    metrics_json TEXT,
    UNIQUE(date, code)
);

-- 初始化管理员账户（默认密码 admin123，首次登录后请修改）
INSERT OR IGNORE INTO users (id, username, email, password_hash, is_admin)
VALUES (1, 'admin', 'admin@zhitou.ai', '$2b$12$Hn9W81KKRF6PBeLGSxcPYuQxAYgbsSeU.wqcdp6rWnPZFZ3eNSewK', 1);

-- 给管理员初始积分
INSERT OR IGNORE INTO credits (user_id, balance, total_recharged)
VALUES (1, 10000, 10000);

-- 初始化积分与充值规则
INSERT OR IGNORE INTO admin_settings (key, value) VALUES ('register_gift_credits', '100');
INSERT OR IGNORE INTO admin_settings (key, value) VALUES ('daily_checkin_credits', '10');
INSERT OR IGNORE INTO admin_settings (key, value) VALUES ('credit_exchange_rate', '100');
INSERT OR IGNORE INTO admin_settings (key, value) VALUES ('profit_ratio', '1.3');

-- 初始化模型配置（默认 DeepSeek）
INSERT OR IGNORE INTO admin_settings (key, value) VALUES ('llm_models_config', '{"models":[{"id":"deepseek-chat","name":"DeepSeek Chat","base_url":"https://api.deepseek.com","api_key":"","peak_price_per_1k":0.01,"valley_price_per_1k":0.005,"peak_start":"09:00","peak_end":"23:00","default":true}]}');

"""


def _migrate_db():
    """对已有数据库进行列级迁移（SQLite 不支持 IF NOT EXISTS 加列）"""
    with get_db() as db:
        # users.default_model
        try:
            db.execute("ALTER TABLE users ADD COLUMN default_model TEXT")
        except sqlite3.OperationalError:
            pass
        # transactions 新增 token 相关列
        for col, ddl in [
            ("tokens_used", "INTEGER DEFAULT 0"),
            ("model_id", "TEXT"),
            ("price_per_1k", "REAL"),
        ]:
            try:
                db.execute(f"ALTER TABLE transactions ADD COLUMN {col} {ddl}")
            except sqlite3.OperationalError:
                pass
        # watchlist 新增股票名称列
        try:
            db.execute("ALTER TABLE watchlist ADD COLUMN stock_name TEXT")
        except sqlite3.OperationalError:
            pass
        db.commit()


def init_db():
    with get_db() as db:
        db.executescript(INIT_SQL)
        db.commit()
    _migrate_db()


@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


# ========== Watchlist ==========

def get_watchlist(user_id: int) -> List[Dict[str, Any]]:
    from . import data_service
    with get_db() as db:
        rows = db.execute(
            "SELECT stock_code, stock_name FROM watchlist WHERE user_id=? ORDER BY created_at DESC",
            (user_id,),
        ).fetchall()
    out = []
    for r in rows:
        code = r["stock_code"]
        name = r["stock_name"] or code
        try:
            q = data_service.get_stock_quote(code)
            price = q.get("price")
            change_pct = q.get("change_pct")
            if not name or name == code:
                name = q.get("name") or name
        except Exception:
            price = None
            change_pct = None
        out.append({"code": code, "name": name, "price": price, "change_pct": change_pct})
    return out


def add_watchlist(user_id: int, code: str, name: str = "") -> None:
    with get_db() as db:
        db.execute(
            "INSERT OR IGNORE INTO watchlist (user_id, stock_code, stock_name) VALUES (?, ?, ?)",
            (user_id, code, name),
        )
        db.commit()


def remove_watchlist(user_id: int, code: str) -> None:
    with get_db() as db:
        db.execute(
            "DELETE FROM watchlist WHERE user_id=? AND stock_code=?",
            (user_id, code),
        )
        db.commit()


def is_in_watchlist(user_id: int, code: str) -> bool:
    with get_db() as db:
        row = db.execute(
            "SELECT 1 FROM watchlist WHERE user_id=? AND stock_code=?",
            (user_id, code),
        ).fetchone()
        return row is not None


# ========== Recommendation History ==========

def save_recommendation_history(date_str: str, items: List[Dict[str, Any]]) -> None:
    with get_db() as db:
        for it in items:
            metrics = it.get("metrics") or {}
            db.execute(
                """INSERT OR REPLACE INTO recommendation_history
                   (date, code, name, price, change_pct, score, signal, reason, risk_level, metrics_json)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    date_str,
                    it["code"],
                    it.get("name"),
                    it.get("price"),
                    it.get("change_pct"),
                    it.get("score"),
                    it.get("signal"),
                    it.get("reason"),
                    it.get("risk_level"),
                    json.dumps(metrics, ensure_ascii=False),
                ),
            )
        db.commit()


def get_recommendation_history(date_str: str) -> List[Dict[str, Any]]:
    with get_db() as db:
        rows = db.execute(
            "SELECT * FROM recommendation_history WHERE date=?", (date_str,)
        ).fetchall()
        return [dict(r) for r in rows]


def get_latest_recommendation_date(before_date: str) -> Optional[str]:
    with get_db() as db:
        row = db.execute(
            "SELECT date FROM recommendation_history WHERE date < ? ORDER BY date DESC LIMIT 1",
            (before_date,),
        ).fetchone()
        return row["date"] if row else None
