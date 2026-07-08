import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from app.api import router

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

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("DEPLOY_RUN_PORT", 5000))
    uvicorn.run(app, host="0.0.0.0", port=port)
