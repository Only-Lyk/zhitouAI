import sqlite3
import os
from contextlib import contextmanager

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "zhitouai.db")
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

INIT_SQL = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_admin INTEGER DEFAULT 0,
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, stock_code)
);

-- 初始化管理员账户（默认密码 admin123，首次登录后请修改）
INSERT OR IGNORE INTO users (id, username, email, password_hash, is_admin)
VALUES (1, 'admin', 'admin@zhitou.ai', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYA.qGZvKG6', 1);

-- 给管理员初始积分
INSERT OR IGNORE INTO credits (user_id, balance, total_recharged)
VALUES (1, 10000, 10000);

-- 初始化积分规则
INSERT OR IGNORE INTO admin_settings (key, value) VALUES ('ai_diagnose_cost', '10');
INSERT OR IGNORE INTO admin_settings (key, value) VALUES ('ai_chat_cost', '5');
INSERT OR IGNORE INTO admin_settings (key, value) VALUES ('ai_recommendation_cost', '5');
INSERT OR IGNORE INTO admin_settings (key, value) VALUES ('register_gift_credits', '100');
INSERT OR IGNORE INTO admin_settings (key, value) VALUES ('daily_checkin_credits', '10');

-- 初始化 LLM 配置（空值表示未配置）
INSERT OR IGNORE INTO admin_settings (key, value) VALUES ('llm_api_key', '');
INSERT OR IGNORE INTO admin_settings (key, value) VALUES ('llm_base_url', 'https://api.deepseek.com');
INSERT OR IGNORE INTO admin_settings (key, value) VALUES ('llm_model', 'deepseek-chat');
"""


def init_db():
    with get_db() as db:
        db.executescript(INIT_SQL)
        db.commit()


@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()
