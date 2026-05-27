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


def _parse_station_item(item: dict) -> dict:
    """解析监测站数据，提取所有污染物字段"""
    def _to_int(key: str) -> int:
        try:
            return int(item.get(key, 0))
        except (ValueError, TypeError):
            return 0

    def _to_float(key: str) -> float:
        try:
            return float(item.get(key, 0))
        except (ValueError, TypeError):
            return 0.0

    return {
        "city": item.get("StationName", ""),
        "station_code": item.get("UniqueCode", ""),
        "aqi": _to_int("AQI"),
        "level": item.get("AQType", ""),
        "degree": item.get("AQDegree", ""),
        "primary": item.get("PrimaryEP") or "",
        "time": item.get("QueryTime", ""),
        "pm25": _to_int("PM25"),
        "pm10": _to_int("PM10"),
        "o3": _to_int("O3"),
        "no2": _to_int("NO2"),
        "so2": _to_int("SO2"),
        "co": _to_float("CO"),
        "lat": _to_float("SLatitude"),
        "lng": _to_float("SLongitude"),
    }


async def get_realtime_aqi() -> list[dict]:
    """获取14市州实时AQI数据（含六项污染物详情）"""
    cache_key = "realtime_aqi"
    if cache_key in _cache and time.time() - _cache[cache_key]["ts"] < _cache_ttl:
        return _cache[cache_key]["data"]

    raw = await _fetch(f"{API_BASE}/MobileApp/GetSortNow", {"stationType": "STCenter"})
    # 过滤掉"全省"汇总数据，仅保留14市州
    result = [_parse_station_item(item) for item in raw
              if item.get("StationName", "") not in ("全省",)]
    # 过滤"湘西州" -> 兼容旧数据中的"湘西土家族苗族自治州"
    for r in result:
        if "湘西" in r["city"] and r["city"] != "湘西州":
            r["city"] = "湘西州"
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


async def get_city_hourly_detail(city_name: str) -> dict:
    """获取指定城市的逐小时详细监测数据（含 PM2.5/PM10/O3/NO2/SO2/CO）"""
    # 从批量 GetSortNow 中过滤，因为 GetCurHourlyDataByStn 需要站点编码
    all_data = await get_realtime_aqi()
    for d in all_data:
        if d["city"] == city_name:
            return d
    return {"city": city_name, "aqi": 0, "level": "无数据", "primary": "", "time": "",
            "pm25": 0, "pm10": 0, "o3": 0, "no2": 0, "so2": 0, "co": 0.0,
            "lat": 0, "lng": 0}


async def get_all_cities_detail() -> list[dict]:
    """批量获取 14 市州逐小时详细监测数据（含六项污染物）"""
    return await get_realtime_aqi()
