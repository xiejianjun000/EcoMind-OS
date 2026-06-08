"""
/api/automations — 自动化引擎
"""
from __future__ import annotations
import uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException, Query
from api.schemas.platform import AutomationCreate, AutomationResponse, AutomationStatus, AutomationTrigger

router = APIRouter()
_items: dict[str, dict] = {}

@router.post("", response_model=AutomationResponse)
def create(body: AutomationCreate):
    aid = str(uuid.uuid4())[:8]
    now = datetime.now().isoformat()
    item = body.model_dump()
    item["id"] = aid
    item["status"] = AutomationStatus.ACTIVE
    item["last_run"] = ""
    item["next_run"] = now
    item["created_at"] = now
    item["updated_at"] = now
    _items[aid] = item
    return AutomationResponse(**item)

@router.get("", response_model=list[AutomationResponse])
def list_all():
    return [AutomationResponse(**v) for v in _items.values()]

@router.put("/{aid}/status")
def toggle(aid: str, status: AutomationStatus = Query(...)):
    if aid not in _items:
        raise HTTPException(404, "自动化不存在")
    _items[aid]["status"] = status
    _items[aid]["updated_at"] = datetime.now().isoformat()
    return {"id": aid, "status": status}

@router.delete("/{aid}")
def delete(aid: str):
    if aid not in _items:
        raise HTTPException(404, "自动化不存在")
    del _items[aid]
    return {"deleted": True}
