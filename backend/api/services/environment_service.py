"""
湖南省生态环境数据服务
从 hn.leitesoft.cn 对接实时空气质量数据
"""
from __future__ import annotations

import logging
import time
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

API_BASE = "https://hn.leitesoft.cn:9020/HNAirWebAPI/api"
# 密码已编码，不能再用 params（会二次编码），直接拼 URL
AUTH_URL = f"{API_BASE}/MobileApp/AuthenticationLogin?userName=hnapp&password=c%2AIlLBHUw1%21S"

# 缓存
_token: Optional[str] = None
_token_expires: float = 0
_cache: dict = {}
_cache_ttl: float = 300  # 5 min


async def _get_token() -> str:
    global _token, _token_expires
    if _token and time.time() < _token_expires - 60:
        return _token
    try:
        async with httpx.AsyncClient(timeout=15, verify=False) as client:
            resp = await client.get(AUTH_URL)
            data = resp.json()
            _token = data["data"]
            _token_expires = time.time() + 3600
            logger.info("LeiteSoft token refreshed")
            return _token
    except Exception as e:
        logger.error(f"Auth failed: {e}")
        raise


async def _fetch(url: str, params: dict = None) -> dict:
    token = await _get_token()
    headers = {"Authorization": f"Bearer {token}"}
    try:
        async with httpx.AsyncClient(timeout=20, verify=False) as client:
            resp = await client.get(url, params=params, headers=headers)
            return resp.json()
    except Exception as e:
        logger.error(f"API call failed: {url} -> {e}")
        raise


async def get_realtime_aqi() -> list[dict]:
    """获取14市州实时AQI数据"""
    cache_key = "realtime_aqi"
    if cache_key in _cache and time.time() - _cache[cache_key]["ts"] < _cache_ttl:
        return _cache[cache_key]["data"]

    raw = await _fetch(f"{API_BASE}/MobileApp/GetSortNow", {"stationType": "STCenter"})
    result = []
    for item in raw:
        result.append({
            "city": item.get("StationName", ""),
            "aqi": int(item.get("AQI", 0)),
            "level": item.get("AQType", ""),
            "primary": item.get("PrimaryEP") or "",
            "time": item.get("QueryTime", ""),
        })
    _cache[cache_key] = {"data": result, "ts": time.time()}
    return result


async def get_forecast() -> list[dict]:
    """获取7天空气质量预报"""
    cache_key = "forecast"
    if cache_key in _cache and time.time() - _cache[cache_key]["ts"] < _cache_ttl:
        return _cache[cache_key]["data"]

    raw = await _fetch(f"{API_BASE}/PublishData/GeNewTimetForcastMost")
    if not raw or len(raw) == 0:
        return []

    import json
    push = json.loads(raw[0]["pushData"])
    result = []
    for period in push:
        date = period.get("time", "")
        for city_data in period.get("data", []):
            result.append({
                "city": city_data.get("City", ""),
                "date": date,
                "aqi": city_data.get("AQI", ""),
                "level": city_data.get("AQType", ""),
                "pm25": city_data.get("PM25", ""),
                "o3": city_data.get("O3", ""),
                "primary": city_data.get("PrimaryEP", ""),
            })
    _cache[cache_key] = {"data": result, "ts": time.time()}
    return result


async def get_ranking(date: str = "") -> list[dict]:
    """获取城市空气质量排名"""
    from datetime import date as dt, timedelta
    if not date:
        date = (dt.today() - timedelta(days=1)).isoformat()

    cache_key = f"ranking_{date}"
    if cache_key in _cache and time.time() - _cache[cache_key]["ts"] < _cache_ttl:
        return _cache[cache_key]["data"]

    raw = await _fetch(
        f"{API_BASE}/MobileApp/GetSortDaily",
        {"choiceType": "isCity", "dataType": "0", "beginTime": date, "endTime": date},
    )
    result = []
    for item in raw:
        result.append({
            "city": item.get("SStationName", ""),
            "aqi": int(item.get("AQI", 0)) if str(item.get("AQI", "")).isdigit() else 0,
            "level": item.get("AQType", ""),
            "primary": item.get("PrimaryEP") or "",
            "date": item.get("SDatetime", ""),
        })
    result.sort(key=lambda x: x["aqi"])
    for i, r in enumerate(result):
        r["rank"] = i + 1

    _cache[cache_key] = {"data": result, "ts": time.time()}
    return result
