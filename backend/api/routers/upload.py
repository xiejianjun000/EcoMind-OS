"""
EcoMind 文件上传服务 — 支持用户上传文件供 AI 工具分析。

POST /api/upload           — 上传文件，返回服务器端路径
GET  /api/upload/files      — 列出当前会话已上传的文件
"""

from __future__ import annotations

import os
import shutil
import uuid
import logging
import tempfile
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Query
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()

UPLOAD_DIR = os.path.join(tempfile.gettempdir(), "ecomind_uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

VIRTUAL_BASE = "/files/"

_path_map: dict[str, str] = {}

def _to_virtual(real_path: str) -> str:
    real = os.path.normpath(real_path)
    for vp, rp in _path_map.items():
        if rp == real:
            return vp
    token = f"f-{uuid.uuid4().hex[:16]}"
    _path_map[token] = real
    return f"{VIRTUAL_BASE}{token}"

def _from_virtual(virtual_path: str) -> Optional[str]:
    if not virtual_path.startswith(VIRTUAL_BASE):
        return None
    token = virtual_path[len(VIRTUAL_BASE):]
    return _path_map.get(token)

ALLOWED_EXTENSIONS = {
    ".pdf", ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".tiff", ".tif",
    ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    ".txt", ".md", ".csv", ".json", ".xml",
    ".mp3", ".wav", ".m4a", ".flac", ".ogg",
    ".mp4", ".avi", ".mov", ".mkv",
}
MAX_FILE_SIZE = 200 * 1024 * 1024  # 200MB，支持大型案卷PDF


class UploadResponse(BaseModel):
    success: bool
    file_id: str
    file_name: str
    file_path: str
    file_size: int
    mime_type: str
    extension: str
    message: str


class FileListResponse(BaseModel):
    files: list[dict]
    total_size: int
    count: int


@router.post("", response_model=UploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    session_id: Optional[str] = Form(default=None),
):
    """
    上传文件到服务器临时目录。
    
    返回的 file_path 可直接传给 document_ocr / image_analyze / video_analyze / voice_transcribe 等工具使用。
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="文件名不能为空")
    
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的文件类型: {ext}，允许的类型: {', '.join(sorted(ALLOWED_EXTENSIONS)[:15])}...",
        )
    
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail=f"文件过大（{len(contents)//1024//1024}MB），最大允许 {MAX_FILE_SIZE//1024//1024}MB")

    file_id = f"uf-{uuid.uuid4().hex[:12]}"
    safe_name = f"{file_id}{ext}"
    
    if session_id:
        session_dir = os.path.join(UPLOAD_DIR, session_id)
        os.makedirs(session_dir, exist_ok=True)
        file_path = os.path.join(session_dir, safe_name)
    else:
        file_path = os.path.join(UPLOAD_DIR, safe_name)

    with open(file_path, "wb") as f:
        f.write(contents)

    logger.info(f"文件上传成功: {file.filename} → {file_path} ({len(contents)} bytes)")

    return UploadResponse(
        success=True,
        file_id=file_id,
        file_name=file.filename,
        file_path=_to_virtual(file_path),
        file_size=len(contents),
        mime_type=file.content_type or "application/octet-stream",
        extension=ext,
        message="上传成功",
    )


@router.post("/batch", response_model=dict)
async def upload_batch(
    files: list[UploadFile] = File(...),
    session_id: Optional[str] = Form(default=None),
):
    """批量上传多个文件"""
    results = []
    for file in (files or []):
        try:
            contents = await file.read()
            ext = os.path.splitext(file.filename)[1].lower()
            if ext not in ALLOWED_EXTENSIONS:
                results.append({"name": file.filename, "status": "error", "reason": f"不支持类型: {ext}"})
                continue
            
            file_id = f"uf-{uuid.uuid4().hex[:12]}"
            safe_name = f"{file_id}{ext}"
            
            if session_id:
                session_dir = os.path.join(UPLOAD_DIR, session_id)
                os.makedirs(session_dir, exist_ok=True)
                dest = os.path.join(session_dir, safe_name)
            else:
                dest = os.path.join(UPLOAD_DIR, safe_name)

            with open(dest, "wb") as f:
                f.write(contents)

            results.append({
                "name": file.filename,
                "status": "success",
                "file_id": file_id,
                "file_path": _to_virtual(dest),
                "size": len(contents),
            })
        except Exception as e:
            results.append({"name": file.filename or "?", "status": "error", "reason": str(e)})

    return {"results": results, "uploaded": sum(1 for r in results if r["status"] == "success"), "total": len(results)}


@router.get("/files", response_model=FileListResponse)
async def list_uploaded_files(
    session_id: Optional[str] = Query(default=None),
):
    """列出已上传的文件"""
    base_dir = os.path.join(UPLOAD_DIR, session_id) if session_id else UPLOAD_DIR
    
    if not os.path.exists(base_dir):
        return FileListResponse(files=[], total_size=0, count=0)
    
    result = []
    total_size = 0
    for fname in sorted(os.listdir(base_dir)):
        fpath = os.path.join(base_dir, fname)
        if os.path.isfile(fpath):
            size = os.path.getsize(fpath)
            result.append({
                "name": fname,
                "path": _to_virtual(fpath),
                "size": size,
                "size_human": f"{size/1024:.1f}KB" if size < 1024*1024 else f"{size/1024/1024:.1f}MB",
                "modified": datetime.fromtimestamp(os.path.getmtime(fpath)).isoformat(),
            })
            total_size += size

    return FileListResponse(files=result, total_size=total_size, count=len(result))


@router.delete("/cleanup")
async def cleanup_session_files(session_id: str = Query(...)):
    """清理指定会话的所有上传文件"""
    session_dir = os.path.join(UPLOAD_DIR, session_id)
    if os.path.exists(session_dir):
        shutil.rmtree(session_dir, ignore_errors=True)
        return {"message": f"已清理会话 {session_id} 的上传文件"}
    return {"message": "该会话没有上传文件"}


@router.get("/resolve")
async def resolve_virtual_path(virtual_path: str = Query(...)):
    real = _from_virtual(virtual_path)
    if not real:
        raise HTTPException(status_code=404, detail="文件路径无效或已过期")
    if not os.path.exists(real):
        raise HTTPException(status_code=404, detail="文件不存在")
    return {"real_path": real, "exists": True}
