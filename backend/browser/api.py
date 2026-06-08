"""浏览器自动化 API"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

router = APIRouter(prefix="/api/browser", tags=["Browser Automation"])


class FetchRequest(BaseModel):
    url: str = Field(..., description="目标 URL")


class WatchRequest(BaseModel):
    name: Optional[str] = None
    url: str = Field(...)
    category: str = "general"


@router.get("/status")
async def browser_status():
    """浏览器状态"""
    from browser.collector import EcoBrowser
    b = EcoBrowser.get_instance()
    return b.status()


@router.post("/fetch")
async def fetch_page(req: FetchRequest):
    """深度抓取单个页面"""
    from browser.collector import EcoBrowser
    b = EcoBrowser.get_instance()
    result = await b.deep_fetch(req.url)
    if not result:
        raise HTTPException(500, "抓取失败")
    return {
        "url": result.url,
        "title": result.title,
        "content": result.content[:2000],
        "summary": result.summary,
        "is_new": result.is_new,
    }


@router.post("/watch")
async def run_watchdog():
    """运行官网监控（检测新公示/新处罚）"""
    from browser.collector import EcoBrowser
    b = EcoBrowser.get_instance()
    return await b.run_watchdog()
