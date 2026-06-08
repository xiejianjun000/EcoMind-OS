"""
/api/workspaces — 工作空间管理
"""
from __future__ import annotations
import uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException
from api.schemas.platform import WorkspaceCreate, WorkspaceResponse

router = APIRouter()
_items: dict[str, dict] = {}

_defaults = [
    {"name": "一平硐煤矿项目", "description": "湖南煤业集团金竹山矿业生态环境监管", "icon": "🏔️"},
    {"name": "娄底锑都投资采购案", "description": "湖南宜化资产处置采购舞弊调查", "icon": "⚖️"},
]

@router.post("", response_model=WorkspaceResponse)
def create(body: WorkspaceCreate):
    wid = str(uuid.uuid4())[:8]
    now = datetime.now().isoformat()
    item = body.model_dump()
    item.update(id=wid, member_count=1, task_count=0, created_by="user", created_at=now, updated_at=now)
    _items[wid] = item
    return WorkspaceResponse(**item)

@router.get("", response_model=list[WorkspaceResponse])
def list_all():
    results = list(_items.values())
    if not results:
        for d in _defaults:
            wid = str(uuid.uuid4())[:8]
            now = datetime.now().isoformat()
            d.update(id=wid, member_count=1, task_count=0, created_by="system", created_at=now, updated_at=now)
            _items[wid] = d
            results.append(d)
    return [WorkspaceResponse(**r) for r in results]

@router.put("/{wid}/switch", response_model=WorkspaceResponse)
def switch(wid: str):
    if wid not in _items:
        raise HTTPException(404, "工作空间不存在")
    return WorkspaceResponse(**_items[wid])

@router.delete("/{wid}")
def delete(wid: str):
    if wid not in _items:
        raise HTTPException(404, "工作空间不存在")
    del _items[wid]
    return {"deleted": True}
