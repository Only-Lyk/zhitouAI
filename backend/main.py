import os
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from app.api import router
from app.db import init_db

app = FastAPI(title="ZhiTouAI", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

static_dir = os.path.join(os.path.dirname(__file__), "..", "dist")

@app.on_event("startup")
async def startup_event():
    init_db()

@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    if request.url.path.startswith("/api/") or exc.status_code != 404:
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
    if os.path.exists(static_dir):
        return FileResponse(os.path.join(static_dir, "index.html"))
    return JSONResponse(status_code=404, content={"detail": "Not Found"})

if os.path.exists(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("DEPLOY_RUN_PORT", 5000))
    uvicorn.run(app, host="0.0.0.0", port=port)
