import pandas as pd
import time
import random
import requests
import json
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import functools


TENCENT_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://finance.qq.com/",
}


def retry_on_error(max_retries: int = 3, delay: float = 1.0):
    """请求重试装饰器"""
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(max_retries):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    print(f"Attempt {attempt + 1}/{max_retries} failed for {func.__name__}: {e}")
                    if attempt < max_retries - 1:
                        time.sleep(delay * (attempt + 1) + random.uniform(0, 0.5))
                    else:
                        raise
            return None
        return wrapper
    return decorator


def _sleep_random(min_sec: float = 0.3, max_sec: float = 1.0):
    """随机延时，避免请求频率过高"""
    time.sleep(random.uniform(min_sec, max_sec))


def _get_tencent_prefix(code: str) -> str:
    """获取腾讯接口前缀"""
    if code.startswith("6") or code.startswith("5") or code.startswith("9"):
        return "sh"
    return "sz"


@retry_on_error(max_retries=3, delay=1.5)
def get_market_indices() -> List[Dict[str, Any]]:
    """获取主要大盘指数"""
    try:
        _sleep_random()
        codes = "sh000001,sz399001,sz399006,sh000688"
        url = f"https://qt.gtimg.cn/q={codes}"
        resp = requests.get(url, headers=TENCENT_HEADERS, timeout=10)
        resp.encoding = "gbk"
        text = resp.text

        code_map = {
            "000001": "上证指数",
            "399001": "深证成指",
            "399006": "创业板指",
            "000688": "科创50",
        }
        indices = []
        for line in text.split(";"):
            line = line.strip()
            if not line or "v_pv_none_match" in line:
                continue
            parts = line.split('"')
            if len(parts) < 2:
                continue
            data = parts[1].split("~")
            if len(data) < 45:
                continue
            code = data[2]
            name = code_map.get(code, data[1])
            indices.append({
                "name": name,
                "code": code,
                "price": float(data[3]) if data[3] else 0,
                "change": float(data[4]) if data[4] else 0,
                "change_pct": float(data[5]) if data[5] else 0,
            })
        return indices if indices else _mock_indices()
    except Exception as e:
        print(f"Error fetching indices: {e}")
        return _mock_indices()


def _mock_indices() -> List[Dict[str, Any]]:
    return [
        {"name": "上证指数", "code": "000001", "price": 3050.23, "change": 12.5, "change_pct": 0.41},
        {"name": "深证成指", "code": "399001", "price": 9780.56, "change": -23.1, "change_pct": -0.24},
        {"name": "创业板指", "code": "399006", "price": 1920.45, "change": 8.3, "change_pct": 0.43},
    ]


def _fetch_quote_from_tencent(code: str) -> Optional[Dict[str, Any]]:
    """从腾讯财经获取个股行情"""
    try:
        prefix = _get_tencent_prefix(code)
        url = f"https://qt.gtimg.cn/q={prefix}{code}"
        resp = requests.get(url, headers=TENCENT_HEADERS, timeout=10)
        resp.encoding = "gbk"
        text = resp.text
        if not text or "v_pv_none_match" in text:
            return None
        parts = text.split('"')
        if len(parts) < 2:
            return None
        data = parts[1].split("~")
        if len(data) < 45:
            return None
        return {
            "code": code,
            "name": data[1],
            "price": float(data[3]) if data[3] else 0,
            "change": float(data[4]) if data[4] else 0,
            "change_pct": float(data[5]) if data[5] else 0,
            "volume": float(data[6]) / 100 if data[6] else 0,
            "market_cap": float(data[17]) / 1e8 if data[17] else None,
            "pe": float(data[39]) if data[39] else None,
            "pb": float(data[46]) if data[46] else None,
        }
    except Exception as e:
        print(f"Tencent quote fetch error for {code}: {e}")
        return None


@retry_on_error(max_retries=2, delay=1.0)
def get_stock_quote(code: str) -> Dict[str, Any]:
    """获取单只股票行情"""
    data = _fetch_quote_from_tencent(code)
    if data:
        return data
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


def _fetch_kline_from_tencent(code: str, days: int = 120) -> List[Dict[str, Any]]:
    """从腾讯财经获取K线数据"""
    try:
        prefix = _get_tencent_prefix(code)
        url = f"https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param={prefix}{code},day,,,{days},qfq"
        resp = requests.get(url, headers=TENCENT_HEADERS, timeout=15)
        resp.encoding = "gbk"
        data = resp.json()
        key = f"{prefix}{code}"
        if "data" not in data or key not in data["data"]:
            return []
        day_data = data["data"][key].get("qfqday", data["data"][key].get("day", []))
        klines = []
        for item in day_data:
            klines.append({
                "date": item[0],
                "open": float(item[1]),
                "close": float(item[2]),
                "low": float(item[3]),
                "high": float(item[4]),
                "volume": float(item[5]) / 10000,
            })
        return klines
    except Exception as e:
        print(f"Tencent kline fetch error for {code}: {e}")
        return []


@retry_on_error(max_retries=2, delay=1.0)
def get_kline_data(code: str, period: str = "daily", days: int = 120) -> List[Dict[str, Any]]:
    """获取K线数据"""
    tencent_kline = _fetch_kline_from_tencent(code, days)
    if tencent_kline and len(tencent_kline) > 0:
        return tencent_kline
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


@retry_on_error(max_retries=2, delay=1.0)
def search_stocks(keyword: str) -> List[Dict[str, Any]]:
    """搜索股票（使用腾讯搜索接口）"""
    try:
        _sleep_random()
        # 使用腾讯接口搜索
        url = f"https://searchapi.eastmoney.com/api/suggest/get?input={keyword}&type=14&count=20"
        resp = requests.get(url, headers=TENCENT_HEADERS, timeout=10)
        data = resp.json()
        results = []
        if "QuotationCodeTable" in data and "Data" in data["QuotationCodeTable"]:
            for item in data["QuotationCodeTable"]["Data"]:
                results.append({
                    "code": item.get("Code", ""),
                    "name": item.get("Name", ""),
                    "price": 0,
                    "change_pct": 0,
                })
        return results
    except Exception as e:
        print(f"Error searching stocks: {e}")
        return []


@retry_on_error(max_retries=2, delay=1.0)
def get_hot_sectors() -> List[Dict[str, Any]]:
    """获取热点板块（使用东方财富接口）"""
    try:
        _sleep_random()
        url = "https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=20&po=1&np=1&fltt=2&invt=2&fid=f3&fs=m:90+t:2&fields=f12,f14,f3,f4,f128,f140"
        resp = requests.get(url, headers=TENCENT_HEADERS, timeout=10)
        data = resp.json()
        sectors = []
        if "data" in data and "diff" in data["data"]:
            for item in data["data"]["diff"]:
                sectors.append({
                    "name": item.get("f14", ""),
                    "change_pct": float(item.get("f3", 0)),
                    "leader": item.get("f128", ""),
                })
        return sectors[:10] if sectors else _mock_sectors()
    except Exception as e:
        print(f"Error fetching sectors: {e}")
        return _mock_sectors()


def _mock_sectors() -> List[Dict[str, Any]]:
    return [
        {"name": "半导体", "change_pct": 3.52, "leader": "中芯国际"},
        {"name": "新能源", "change_pct": 2.18, "leader": "宁德时代"},
        {"name": "白酒", "change_pct": -1.05, "leader": "贵州茅台"},
    ]
