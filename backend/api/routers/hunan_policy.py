"""
EcoMind 湖南生态环境政策 MCP API

提供 HTTP 接口访问湖南省生态环境厅政策文件数据：
- 触发爬取
- 全文检索
- 最新列表
- 政策详情
- 数据统计
"""

from __future__ import annotations

import json
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from govmcp.hunan_env_policy import SECTIONS
from govmcp.server import GovMCPServer

logger = logging.getLogger(__name__)
router = APIRouter()


def _get_govmcp():
    """懒加载 GovMCPServer 单例（带初始化）"""
    if not hasattr(_get_govmcp, "_server"):
        _get_govmcp._server = GovMCPServer()
    return _get_govmcp._server


class CrawlRequest(BaseModel):
    sections: Optional[list[str]] = Field(default=None, description="要爬取的板块，空=全部")
    days_back: int = Field(default=7, description="回溯天数")
    max_pages: int = Field(default=3, description="每板块最大页数")


class SearchRequest(BaseModel):
    query: str = Field(..., description="搜索关键词")
    section: Optional[str] = Field(default=None, description="板块过滤")
    limit: int = Field(default=20, description="返回条数")


@router.post("/crawl")
async def crawl_policies(req: CrawlRequest):
    """触发增量爬取湖南省生态环境厅政策文件（通过 GovMCPServer）"""
    mcp = _get_govmcp()
    try:
        result_str = await mcp.call_tool("hunan_policy_crawl", {
            "sections": req.sections,
            "days_back": req.days_back,
            "max_pages": req.max_pages,
        })
        return json.loads(result_str)
    except Exception as e:
        logger.error(f"Crawl failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/search")
async def search_policies(req: SearchRequest):
    """全文检索已抓取的政策文件（通过 GovMCPServer）"""
    mcp = _get_govmcp()
    try:
        result_str = await mcp.call_tool("hunan_policy_search", {
            "query": req.query,
            "section": req.section,
            "limit": req.limit,
        })
        return json.loads(result_str)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/latest")
async def latest_policies(
    days: int = Query(default=7, description="最近天数"),
    section: Optional[str] = Query(default=None, description="板块过滤"),
    limit: int = Query(default=50, description="返回条数"),
):
    """获取最新政策文件列表（通过 GovMCPServer）"""
    mcp = _get_govmcp()
    try:
        result_str = await mcp.call_tool("hunan_policy_latest", {
            "days": days,
            "section": section,
            "limit": limit,
        })
        return json.loads(result_str)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/detail/{article_id}")
async def policy_detail(article_id: str):
    """获取指定政策完整内容（通过 GovMCPServer）"""
    mcp = _get_govmcp()
    try:
        result_str = await mcp.call_tool("hunan_policy_detail", {"article_id": article_id})
        result = json.loads(result_str)
        if isinstance(result, dict) and "error" in result:
            raise HTTPException(status_code=404, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats")
async def policy_stats():
    """获取政策数据库统计信息（通过 GovMCPServer）"""
    mcp = _get_govmcp()
    try:
        result_str = await mcp.call_tool("hunan_policy_stats", {})
        return json.loads(result_str)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/sections")
async def list_sections():
    """列出所有可爬取的板块"""
    return {
        "sections": [
            {
                "key": k,
                "name": v["name"],
                "description": v["description"],
                "url": f"https://sthjt.hunan.gov.cn{v['list_url']}",
            }
            for k, v in SECTIONS.items()
        ]
    }
