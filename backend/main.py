import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from app.api import router
from app.db import init_db
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

# 生产环境挂载前端静态文件
static_dir = os.path.join(os.path.dirname(__file__), "..", "dist")
if os.path.exists(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")


def _ensure_admin_exists():
    """确保默认管理员账户存在"""
    db_path = os.path.join(os.path.dirname(__file__), "..", "data", "zhitouai.db")
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    conn = sqlite3.connect(db_path)
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
    init_db()
    _ensure_admin_exists()

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("DEPLOY_RUN_PORT", 5000))
    uvicorn.run(app, host="0.0.0.0", port=port)
