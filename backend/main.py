import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from app.api import router
from app.auth import get_password_hash
import sqlite3

app = FastAPI(title="智投AI - 量化分析系统", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

static_dir = os.path.join(os.path.dirname(__file__), "..", "dist")
if os.path.exists(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "zhitouai.db")

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

INSERT OR IGNORE INTO users (id, username, email, password_hash, is_admin)
VALUES (1, 'admin', 'admin@zhitou.ai', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYA.qGZvKG6', 1);

INSERT OR IGNORE INTO credits (user_id, balance, total_recharged)
VALUES (1, 10000, 10000);

INSERT OR IGNORE INTO admin_settings (key, value) VALUES ('ai_diagnose_cost', '10');
INSERT OR IGNORE INTO admin_settings (key, value) VALUES ('ai_chat_cost', '5');
INSERT OR IGNORE INTO admin_settings (key, value) VALUES ('ai_recommendation_cost', '5');
INSERT OR IGNORE INTO admin_settings (key, value) VALUES ('register_gift_credits', '100');
INSERT OR IGNORE INTO admin_settings (key, value) VALUES ('daily_checkin_credits', '10');
INSERT OR IGNORE INTO admin_settings (key, value) VALUES ('llm_api_key', '');
INSERT OR IGNORE INTO admin_settings (key, value) VALUES ('llm_base_url', 'https://api.deepseek.com');
INSERT OR IGNORE INTO admin_settings (key, value) VALUES ('llm_model', 'deepseek-chat');
"""

def _init_database():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.executescript(INIT_SQL)
        conn.commit()
    finally:
        conn.close()

def _ensure_admin_exists():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE username = ?", ("admin",))
    if not cursor.fetchone():
        cursor.execute(
            "INSERT INTO users (username, email, password_hash, is_admin) VALUES (?, ?, ?, ?)",
            ("admin", "admin@zhitou.ai", get_password_hash("admin123"), 1),
        )
        cursor.execute(
            "INSERT INTO credits (user_id, balance, total_consumed, total_recharged) VALUES (?, ?, ?, ?)",
            (cursor.lastrowid, 999999, 0, 999999),
        )
        conn.commit()
    conn.close()

@app.on_event("startup")
async def startup_event():
    _init_database()
    _ensure_admin_exists()

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("DEPLOY_RUN_PORT", 5000))
    uvicorn.run(app, host="0.0.0.0", port=port)
