# 多阶段构建：前端 + Python FastAPI 后端
# 阶段 1：构建 React 前端
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# 阶段 2：Python 运行环境
FROM python:3.11-slim
WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# 安装 Python 依赖
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# 复制后端代码
COPY backend/ ./backend/

# 复制前端构建产物到 FastAPI 静态目录
COPY --from=frontend-builder /app/dist ./backend/dist/

# 设置环境变量
ENV PYTHONPATH=/app
ENV DEPLOY_RUN_PORT=5000
ENV JWT_SECRET_KEY=change-me-in-production

WORKDIR /app/backend
EXPOSE 5000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5000"]
