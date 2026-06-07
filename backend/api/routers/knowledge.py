"""
资料库 API Router — 本地文件扫描与自动分类
"""
from __future__ import annotations

import logging
import os
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse

from api.services.knowledge_service import scan_all, scan_directory, classify_file, get_category_info

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/scan")
async def scan_knowledge_base(
    dirs: str = Query("", description="逗号分隔的扫描目录，留空使用默认目录"),
):
    """扫描本地资料库，按分类返回文件列表"""
    try:
        scan_dirs = [d.strip() for d in dirs.split(',') if d.strip()] if dirs else None
        result = scan_all(scan_dirs)
        return {"code": 200, "data": result}
    except Exception as e:
        logger.error(f"Knowledge scan error: {e}")
        raise HTTPException(status_code=502, detail=f"资料库扫描失败: {e}")


@router.get("/categories")
async def get_categories():
    """获取所有文件分类定义"""
    from api.services.knowledge_service import CATEGORY_RULES
    return {
        "code": 200,
        "data": CATEGORY_RULES + [{"id": "other", "name": "其他文件", "icon": "📓", "keywords": [], "extensions": []}],
    }


@router.get("/config")
async def get_config():
    """获取资料库配置"""
    from api.services.knowledge_service import DEFAULT_SCAN_DIRS
    return {
        "code": 200,
        "data": {
            "default_scan_dirs": DEFAULT_SCAN_DIRS,
            "current_scan_dirs": os.getenv('KNOWLEDGE_SCAN_DIRS', '').split(',') if os.getenv('KNOWLEDGE_SCAN_DIRS') else DEFAULT_SCAN_DIRS,
        },
    }


ALLOWED_ROOTS = [
    os.path.expanduser("~/Documents"),
    os.path.expanduser("~/Desktop"),
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),  # EcoMind-OS/backend
]

def _is_safe_path(path: str) -> bool:
    """Check that resolved path is within allowed directories."""
    try:
        real = os.path.realpath(os.path.abspath(path))
        return any(real.startswith(os.path.realpath(root)) for root in ALLOWED_ROOTS if os.path.exists(root))
    except (ValueError, OSError):
        return False


@router.get("/file")
async def read_file(
    path: str = Query(..., description="文件完整路径"),
):
    """读取本地文件内容（支持 .txt/.md/.csv/.json 等文本文件）"""
    if not _is_safe_path(path):
        raise HTTPException(status_code=403, detail="禁止访问该路径")
    try:
        from api.services.knowledge_service import read_file_content
        result = read_file_content(path)
        if "error" in result:
            return {"code": 400, "data": result}
        return {"code": 200, "data": result}
    except Exception as e:
        logger.error(f"Read file error: {e}")
        raise HTTPException(status_code=502, detail=f"文件读取失败: {e}")


@router.get("/file/raw")
async def read_file_raw(
    path: str = Query(..., description="文件完整路径"),
):
    """直接返回文件原始内容（用于下载或预览）"""
    if not _is_safe_path(path):
        raise HTTPException(status_code=403, detail="禁止访问该路径")
    try:
        if not os.path.exists(path) or not os.path.isfile(path):
            raise HTTPException(status_code=404, detail="文件不存在")
        # 尝试识别 MIME 类型
        ext = os.path.splitext(path)[1].lower()
        media_types = {
            ".pdf": "application/pdf",
            ".txt": "text/plain",
            ".md": "text/markdown",
            ".json": "application/json",
            ".csv": "text/csv",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".gif": "image/gif",
        }
        media_type = media_types.get(ext, "application/octet-stream")
        filename = os.path.basename(path)
        return FileResponse(path, media_type=media_type, filename=filename)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Read raw file error: {e}")
        raise HTTPException(status_code=502, detail=f"文件下载失败: {e}")


@router.get("/search")
async def search_files(
    q: str = Query(..., description="搜索关键词"),
):
    """按关键词搜索资料库文件"""
    try:
        from api.services.knowledge_service import search_files
        results = search_files(q)
        return {"code": 200, "data": results, "total": len(results)}
    except Exception as e:
        logger.error(f"Search error: {e}")
        raise HTTPException(status_code=502, detail=f"搜索失败: {e}")


@router.get("/summary")
async def knowledge_summary():
    """获取资料库摘要（供 system prompt 使用）"""
    try:
        from api.services.knowledge_service import get_knowledge_summary
        summary = get_knowledge_summary()
        return {"code": 200, "data": summary}
    except Exception as e:
        logger.error(f"Summary error: {e}")
        raise HTTPException(status_code=502, detail=f"摘要生成失败: {e}")
