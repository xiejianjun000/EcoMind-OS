"""
环境数据 API Router
对接湖南省生态环境厅实时空气质量数据
"""
from __future__ import annotations

import logging
from fastapi import APIRouter, HTTPException

from api.services.environment_service import get_realtime_aqi, get_forecast, get_ranking

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/realtime")
async def realtime_aqi():
    """获取14市州实时AQI数据"""
    try:
        data = await get_realtime_aqi()
        return {"code": 200, "data": data, "total": len(data)}
    except Exception as e:
        logger.error(f"Realtime AQI error: {e}")
        raise HTTPException(status_code=502, detail=f"数据获取失败: {e}")


@router.get("/forecast")
async def forecast():
    """获取7天空气质量预报"""
    try:
        data = await get_forecast()
        return {"code": 200, "data": data, "total": len(data)}
    except Exception as e:
        logger.error(f"Forecast error: {e}")
        raise HTTPException(status_code=502, detail=f"预报数据获取失败: {e}")


@router.get("/ranking")
async def ranking(date: str = ""):
    """获取城市空气质量排名"""
    try:
        data = await get_ranking(date)
        return {"code": 200, "data": data, "total": len(data)}
    except Exception as e:
        logger.error(f"Ranking error: {e}")
        raise HTTPException(status_code=502, detail=f"排名数据获取失败: {e}")
