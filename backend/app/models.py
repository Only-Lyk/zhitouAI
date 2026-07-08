from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class MarketIndex(BaseModel):
    name: str
    code: str
    price: float
    change: float
    change_pct: float


class StockBasic(BaseModel):
    code: str
    name: str
    price: float
    change: float
    change_pct: float
    volume: float
    market_cap: Optional[float] = None
    pe: Optional[float] = None
    pb: Optional[float] = None


class StockKLine(BaseModel):
    date: str
    open: float
    high: float
    low: float
    close: float
    volume: float


class TechnicalIndicator(BaseModel):
    ma5: Optional[float] = None
    ma10: Optional[float] = None
    ma20: Optional[float] = None
    ma60: Optional[float] = None
    macd_dif: Optional[float] = None
    macd_dea: Optional[float] = None
    macd_hist: Optional[float] = None
    rsi14: Optional[float] = None
    boll_up: Optional[float] = None
    boll_mid: Optional[float] = None
    boll_down: Optional[float] = None


class AIDiagnosisResult(BaseModel):
    code: str
    name: str
    score: int
    signal: str
    trend: str
    support: Optional[float] = None
    pressure: Optional[float] = None
    risk_level: str
    reason: str
    suggestion: str
    indicators: TechnicalIndicator
    generated_at: datetime


class AIRecommendation(BaseModel):
    code: str
    name: str
    price: float
    change_pct: float
    score: int
    signal: str
    reason: str
    risk_level: str


class ChatMessage(BaseModel):
    role: str  # user / assistant
    content: str
    timestamp: datetime = datetime.now()


class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = []


# ========== Auth & User ==========

class UserRegister(BaseModel):
    username: str
    email: Optional[str] = None
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    is_admin: int = 0


class CreditInfo(BaseModel):
    balance: int
    total_consumed: int
    total_recharged: int


class TransactionRecord(BaseModel):
    id: int
    user_id: int
    type: str
    amount: int
    description: str
    created_at: datetime


# ========== Admin ==========

class AdminSetting(BaseModel):
    key: str
    value: str
    updated_at: datetime


class AdminSettingsUpdate(BaseModel):
    settings: dict


class AdminUserList(BaseModel):
    users: List[dict]
    total: int
    page: int
    page_size: int


class AdminTransactionList(BaseModel):
    transactions: List[dict]
    total: int
    page: int
    page_size: int
