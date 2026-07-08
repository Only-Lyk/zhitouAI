# 项目上下文

## 项目概述

智投AI - 自用量化股票分析系统。支持AI量化诊断、智能选股、K线图表、技术指标、AI问答助手。面向10人以内自用+朋友使用，手机优先的响应式PWA Web应用。

## 技术栈

- **前端**: Vite 7, React 19, TypeScript, Tailwind CSS, Recharts
- **沙箱开发后端**: Express + TypeScript（提供Mock API用于预览）
- **生产部署后端**: Python 3.10+, FastAPI, AKShare, pandas, uvicorn
- **数据库**: SQLite（10人规模足够）
- **AI**: 大语言模型流式对话（DeepSeek/豆包等），当前为模拟流式输出

## 目录结构

```
├── backend/            # Python FastAPI 后端（生产部署用）
│   ├── app/
│   │   ├── __init__.py
│   │   ├── models.py      # Pydantic 数据模型
│   │   ├── data_service.py # AKShare 数据获取与指标计算
│   │   ├── ai_service.py   # AI 分析与推荐逻辑
│   │   └── api.py          # FastAPI 路由
│   ├── main.py          # FastAPI 入口
│   └── requirements.txt # Python 依赖
├── server/             # Express 后端（沙箱开发预览用）
│   ├── routes/
│   │   └── index.ts     # Mock API 路由
│   ├── server.ts        # Express 服务入口
│   └── vite.ts          # Vite 中间件集成
├── src/                # React 前端源码
│   ├── main.tsx         # React 入口
│   ├── App.tsx          # 路由配置
│   ├── index.css        # 全局样式 + Tailwind
│   ├── components/      # 公共组件
│   │   ├── Layout.tsx
│   │   ├── BottomNav.tsx
│   │   ├── MarketOverview.tsx
│   │   ├── StockCard.tsx
│   │   ├── KLineChart.tsx
│   │   └── AIScoreBadge.tsx
│   └── pages/           # 页面组件
│       ├── HomePage.tsx
│       ├── StockPage.tsx
│       ├── AIPage.tsx
│       ├── ChatPage.tsx
│       └── WatchlistPage.tsx
├── public/             # 静态资源
│   ├── manifest.json    # PWA 配置
│   └── icon-*.svg       # PWA 图标
├── scripts/            # 构建与启动脚本
├── index.html          # 入口 HTML
├── package.json        # 前端依赖
├── tsconfig.json       # TypeScript 配置
├── vite.config.ts      # Vite 配置
└── DESIGN.md           # 视觉设计规范
```

## 包管理规范

**仅允许使用 pnpm** 作为包管理器，**严禁使用 npm 或 yarn**。
**常用命令**：
- 安装依赖：`pnpm add <package>`
- 安装开发依赖：`pnpm add -D <package>`
- 安装所有依赖：`pnpm install`
- 移除依赖：`pnpm remove <package>`

## 开发规范

- 使用 Tailwind CSS 进行样式开发
- 手机优先（Mobile First）的响应式设计
- 暗色主题为主，高端金融终端风格

### 编码规范

- 默认按 TypeScript `strict` 心智写代码；优先复用当前作用域已声明的变量、函数、类型和导入，禁止引用未声明标识符或拼错变量名。
- 禁止隐式 `any` 和 `as any`；函数参数、返回值、解构项、事件对象、Express `req`/`res`、`catch` 错误在使用前应有明确类型或先完成类型收窄，并清理未使用的变量和导入。

## API 路由清单

| 路由 | 方法 | 说明 |
|---|---|---|
| `/api/health` | GET | 健康检查 |
| `/api/market/indices` | GET | 大盘指数 |
| `/api/market/sectors` | GET | 热点板块 |
| `/api/stock/quote?code=` | GET | 股票行情 |
| `/api/stock/kline?code=` | GET | K线数据 |
| `/api/stock/indicators?code=` | GET | 技术指标 |
| `/api/stock/search?keyword=` | GET | 搜索股票 |
| `/api/ai/diagnose?code=` | GET | AI诊断（非流式） |
| `/api/ai/diagnose/stream?code=` | GET | AI诊断（SSE流式） |
| `/api/ai/recommendations` | GET | AI每日推荐 |
| `/api/ai/chat` | POST | AI问答（SSE流式） |

## Windows 服务器部署指南

1. 安装 Python 3.10+，创建虚拟环境
2. `cd backend && pip install -r requirements.txt`
3. 前端构建：`pnpm run build`（输出到 `dist/`）
4. 启动后端：`cd backend && uvicorn main:app --host 0.0.0.0 --port 5000`
5. FastAPI 会自动挂载 `dist/` 为静态文件
6. 建议使用 NSSM 将 uvicorn 注册为 Windows Service
