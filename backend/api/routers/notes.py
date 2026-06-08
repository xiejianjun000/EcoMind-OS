"""
/api/notes — 资料库/知识管理
"""
from __future__ import annotations
import uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException, Query
from api.schemas.platform import NoteCreate, NoteResponse

router = APIRouter()
_items: dict[str, dict] = {}

@router.post("", response_model=NoteResponse)
def create(body: NoteCreate):
    nid = str(uuid.uuid4())[:8]
    now = datetime.now().isoformat()
    item = body.model_dump()
    item.update(id=nid, created_by="user", created_at=now, updated_at=now)
    _items[nid] = item
    return NoteResponse(**item)

@router.get("", response_model=list[NoteResponse])
def list_all(q: str = "", category: str = "", workspace: str = ""):
    results = list(_items.values())
    if q:
        results = [r for r in results if q.lower() in r["title"].lower() or q.lower() in r["content"].lower()]
    if category:
        results = [r for r in results if r["category"] == category]
    if workspace:
        results = [r for r in results if r["workspace"] == workspace]
    return [NoteResponse(**r) for r in results]

@router.get("/{nid}", response_model=NoteResponse)
def get(nid: str):
    if nid not in _items:
        raise HTTPException(404, "资料不存在")
    return NoteResponse(**_items[nid])

@router.delete("/{nid}")
def delete(nid: str):
    if nid not in _items:
        raise HTTPException(404, "资料不存在")
    del _items[nid]
    return {"deleted": True}
