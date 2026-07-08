# 智投AI - 量化股票分析系统

自用量化股票分析系统，支持AI量化诊断、智能选股、K线图表、技术指标、AI问答助手。

## 技术栈

- **前端**: Vite 7, React 19, TypeScript, Tailwind CSS, Recharts
- **沙箱开发后端**: Express + TypeScript（提供Mock API用于预览）
- **生产部署后端**: Python 3.10+, FastAPI, AKShare, pandas, uvicorn
- **数据库**: SQLite
- **AI**: 大语言模型流式对话（DeepSeek/豆包等）

## 功能模块

- 大盘指数实时行情
- K线图 + 技术指标（MA/MACD/RSI/布林带）
- AI个股深度诊断（流式输出）
- AI每日智能选股推荐
- AI投资问答助手
- 自选股管理

## 本地开发

```bash
# 安装依赖
pnpm install

# 启动开发服务器（前端 + Express Mock API）
PORT=5000 pnpm tsx server/server.ts

# 或
bash scripts/dev.sh
```

## 生产部署（Windows Server）

### 1. 环境准备

需要安装：Git、Node.js 20+、Python 3.10+

```powershell
# 安装 pnpm（Node.js 自带）
npm install -g pnpm@9.15.0

# 验证
node --version    # v20.x
pnpm --version    # 9.x
python --version  # 3.12.x
```

### 2. 构建前端

```powershell
pnpm install
pnpm build
```

### 3. 安装 Python 后端

```powershell
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

### 4. 启动服务

```powershell
# 在 backend 目录下（venv 已激活）
uvicorn main:app --host 0.0.0.0 --port 5000
```

### 5. 注册 Windows 服务（开机自启）

使用 NSSM 将 uvicorn 注册为 Windows Service。

## 目录结构

```
├── backend/          # Python FastAPI 后端（生产用）
│   ├── app/
│   │   ├── models.py
│   │   ├── data_service.py
│   │   ├── ai_service.py
│   │   └── api.py
│   ├── main.py
│   └── requirements.txt
├── server/           # Express 后端（沙箱开发预览用）
│   ├── routes/
│   │   └── index.ts
│   ├── server.ts
│   └── vite.ts
├── src/              # React 前端源码
│   ├── components/
│   ├── pages/
│   ├── App.tsx
│   └── main.tsx
├── public/           # PWA 静态资源
├── dist/             # 前端构建产物
└── scripts/          # 构建与启动脚本
```

## 配置 AI API Key

生产环境需要配置 LLM API Key 才能使用真实的 AI 分析。

编辑 `backend/app/ai_service.py`，替换模拟逻辑为真实 LLM 调用（DeepSeek/豆包/Kimi 等）。

## 免责声明

本系统仅供数据分析参考，不构成投资建议。股市有风险，投资需谨慎。
