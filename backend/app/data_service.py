import akshare as ak
import pandas as pd
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import asyncio


def get_market_indices() -> List[Dict[str, Any]]:
    """获取主要大盘指数"""
    try:
        df = ak.stock_zh_index_spot_em()
        indices = []
        code_map = {
            "sh000001": "上证指数",
            "sz399001": "深证成指",
            "sz399006": "创业板指",
            "sh000688": "科创50",
            "sh000016": "上证50",
        }
        for _, row in df.iterrows():
            code = row.get("代码", "")
            if f"sh{code}" in code_map or f"sz{code}" in code_map:
                full_code = f"sh{code}" if code.startswith("0") or code.startswith("6") else f"sz{code}"
                indices.append({
                    "name": code_map.get(full_code, row.get("名称", "")),
                    "code": code,
                    "price": float(row.get("最新价", 0)),
                    "change": float(row.get("涨跌额", 0)),
                    "change_pct": float(row.get("涨跌幅", 0)),
                })
        return indices[:5]
    except Exception as e:
        print(f"Error fetching indices: {e}")
        return [
            {"name": "上证指数", "code": "000001", "price": 3050.23, "change": 12.5, "change_pct": 0.41},
            {"name": "深证成指", "code": "399001", "price": 9780.56, "change": -23.1, "change_pct": -0.24},
            {"name": "创业板指", "code": "399006", "price": 1920.45, "change": 8.3, "change_pct": 0.43},
        ]


def get_stock_quote(code: str) -> Dict[str, Any]:
    """获取单只股票行情"""
    try:
        df = ak.stock_zh_a_spot_em()
        row = df[df["代码"] == code]
        if len(row) == 0:
            return _mock_stock_quote(code)
        r = row.iloc[0]
        return {
            "code": code,
            "name": str(r.get("名称", "")),
            "price": float(r.get("最新价", 0)),
            "change": float(r.get("涨跌额", 0)),
            "change_pct": float(r.get("涨跌幅", 0)),
            "volume": float(r.get("成交量", 0)) / 10000,
            "market_cap": float(r.get("总市值", 0)) / 1e8 if pd.notna(r.get("总市值")) else None,
            "pe": float(r.get("市盈率-动态", 0)) if pd.notna(r.get("市盈率-动态")) else None,
            "pb": float(r.get("市净率", 0)) if pd.notna(r.get("市净率")) else None,
        }
    except Exception as e:
        print(f"Error fetching quote {code}: {e}")
        return _mock_stock_quote(code)


def _mock_stock_quote(code: str) -> Dict[str, Any]:
    import random
    base = random.uniform(10, 500)
    change_pct = random.uniform(-3, 3)
    return {
        "code": code,
        "name": f"股票{code}",
        "price": round(base, 2),
        "change": round(base * change_pct / 100, 2),
        "change_pct": round(change_pct, 2),
        "volume": round(random.uniform(100, 50000), 2),
        "market_cap": round(random.uniform(50, 5000), 2),
        "pe": round(random.uniform(5, 80), 2),
        "pb": round(random.uniform(0.5, 10), 2),
    }


def get_kline_data(code: str, period: str = "daily", days: int = 120) -> List[Dict[str, Any]]:
    """获取K线数据"""
    try:
        if period == "daily":
            df = ak.stock_zh_a_hist(symbol=code, period="daily", start_date="20240101", adjust="qfq")
        else:
            df = ak.stock_zh_a_hist(symbol=code, period="weekly", start_date="20240101", adjust="qfq")
        if df is None or len(df) == 0:
            return _mock_kline(code, days)
        df = df.tail(days)
        klines = []
        for _, row in df.iterrows():
            klines.append({
                "date": str(row.get("日期", "")),
                "open": float(row.get("开盘", 0)),
                "high": float(row.get("最高", 0)),
                "low": float(row.get("最低", 0)),
                "close": float(row.get("收盘", 0)),
                "volume": float(row.get("成交量", 0)) / 10000,
            })
        return klines
    except Exception as e:
        print(f"Error fetching kline {code}: {e}")
        return _mock_kline(code, days)


def _mock_kline(code: str, days: int) -> List[Dict[str, Any]]:
    import random
    import datetime as dt
    klines = []
    base = random.uniform(20, 200)
    for i in range(days):
        d = dt.datetime.now() - dt.timedelta(days=days - i)
        change = random.uniform(-0.03, 0.03)
        open_p = base * (1 + change)
        close = open_p * (1 + random.uniform(-0.02, 0.02))
        high = max(open_p, close) * (1 + random.uniform(0, 0.015))
        low = min(open_p, close) * (1 - random.uniform(0, 0.015))
        klines.append({
            "date": d.strftime("%Y-%m-%d"),
            "open": round(open_p, 2),
            "high": round(high, 2),
            "low": round(low, 2),
            "close": round(close, 2),
            "volume": round(random.uniform(500, 50000), 2),
        })
        base = close
    return klines


def calculate_indicators(klines: List[Dict[str, Any]]) -> Dict[str, Any]:
    """计算技术指标"""
    if len(klines) < 60:
        return {}
    closes = pd.Series([k["close"] for k in klines])
    volumes = pd.Series([k["volume"] for k in klines])

    # MA
    ma5 = closes.rolling(5).mean().iloc[-1] if len(closes) >= 5 else None
    ma10 = closes.rolling(10).mean().iloc[-1] if len(closes) >= 10 else None
    ma20 = closes.rolling(20).mean().iloc[-1] if len(closes) >= 20 else None
    ma60 = closes.rolling(60).mean().iloc[-1] if len(closes) >= 60 else None

    # MACD
    ema12 = closes.ewm(span=12, adjust=False).mean()
    ema26 = closes.ewm(span=26, adjust=False).mean()
    dif = ema12 - ema26
    dea = dif.ewm(span=9, adjust=False).mean()
    hist = dif - dea

    # RSI
    delta = closes.diff()
    gain = delta.where(delta > 0, 0).rolling(14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
    rs = gain / loss
    rsi = 100 - (100 / (1 + rs))

    # BOLL
    mid = closes.rolling(20).mean()
    std = closes.rolling(20).std()
    boll_up = mid + 2 * std
    boll_down = mid - 2 * std

    return {
        "ma5": round(float(ma5), 2) if ma5 is not None and pd.notna(ma5) else None,
        "ma10": round(float(ma10), 2) if ma10 is not None and pd.notna(ma10) else None,
        "ma20": round(float(ma20), 2) if ma20 is not None and pd.notna(ma20) else None,
        "ma60": round(float(ma60), 2) if ma60 is not None and pd.notna(ma60) else None,
        "macd_dif": round(float(dif.iloc[-1]), 3) if pd.notna(dif.iloc[-1]) else None,
        "macd_dea": round(float(dea.iloc[-1]), 3) if pd.notna(dea.iloc[-1]) else None,
        "macd_hist": round(float(hist.iloc[-1]), 3) if pd.notna(hist.iloc[-1]) else None,
        "rsi14": round(float(rsi.iloc[-1]), 1) if pd.notna(rsi.iloc[-1]) else None,
        "boll_up": round(float(boll_up.iloc[-1]), 2) if pd.notna(boll_up.iloc[-1]) else None,
        "boll_mid": round(float(mid.iloc[-1]), 2) if pd.notna(mid.iloc[-1]) else None,
        "boll_down": round(float(boll_down.iloc[-1]), 2) if pd.notna(boll_down.iloc[-1]) else None,
    }


def search_stocks(keyword: str) -> List[Dict[str, Any]]:
    """搜索股票"""
    try:
        df = ak.stock_zh_a_spot_em()
        df = df[df["名称"].str.contains(keyword, na=False) | df["代码"].str.contains(keyword, na=False)]
        results = []
        for _, r in df.head(20).iterrows():
            results.append({
                "code": str(r.get("代码", "")),
                "name": str(r.get("名称", "")),
                "price": float(r.get("最新价", 0)),
                "change_pct": float(r.get("涨跌幅", 0)),
            })
        return results
    except Exception as e:
        print(f"Error searching stocks: {e}")
        return []


def get_hot_sectors() -> List[Dict[str, Any]]:
    """获取热点板块"""
    try:
        df = ak.stock_sector_spot_em()
        sectors = []
        for _, r in df.head(10).iterrows():
            sectors.append({
                "name": str(r.get("板块", "")),
                "change_pct": float(r.get("涨跌幅", 0)),
                "leader": str(r.get("领涨股", "")),
            })
        return sectors
    except Exception as e:
        print(f"Error fetching sectors: {e}")
        return [
            {"name": "半导体", "change_pct": 3.52, "leader": "中芯国际"},
            {"name": "新能源", "change_pct": 2.18, "leader": "宁德时代"},
            {"name": "白酒", "change_pct": -1.05, "leader": "贵州茅台"},
        ]
