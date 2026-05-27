"""
/api/approval — 环评审批三级审批流管理路由
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from api.schemas.approval import ApprovalCreate, ApprovalTransition
from api.services.approval_service import ApprovalService, get_approval_service

router = APIRouter(prefix="/api/approval", tags=["approval"])


@router.get("/items", summary="列出所有审批")
async def list_approvals(
    approval_type: Optional[str] = Query(default=None, description="按审批类型过滤"),
    status: Optional[str] = Query(default=None, description="按状态过滤"),
    level: Optional[str] = Query(default=None, description="按审批级别过滤"),
    department: Optional[str] = Query(default=None, description="按部门过滤"),
    limit: int = Query(default=100, ge=1, le=500, description="返回数量上限"),
    offset: int = Query(default=0, ge=0, description="偏移量"),
    service: ApprovalService = Depends(get_approval_service),
) -> list[dict]:
    records = await service.list_approvals(
        approval_type=approval_type, status=status, level=level,
        department=department, limit=limit, offset=offset,
    )
    return [r.to_dict() for r in records]


@router.post("/items", status_code=201, summary="创建审批")
async def create_approval(
    request: ApprovalCreate,
    service: ApprovalService = Depends(get_approval_service),
) -> dict:
    record = await service.create_approval(request.model_dump())
    return record.to_dict()


@router.get("/items/{approval_id}", summary="获取审批详情")
async def get_approval(
    approval_id: str,
    service: ApprovalService = Depends(get_approval_service),
) -> dict:
    record = await service.get_approval(approval_id)
    if record is None:
        raise HTTPException(status_code=404, detail=f"审批不存在: {approval_id}")
    return record.to_dict()


@router.post("/items/{approval_id}/transition", summary="审批流转")
async def transition_approval(
    approval_id: str,
    request: ApprovalTransition,
    service: ApprovalService = Depends(get_approval_service),
) -> dict:
    try:
        record = await service.transition(
            approval_id=approval_id, action=request.action,
            operator=request.operator, comment=request.comment or "",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if record is None:
        raise HTTPException(status_code=404, detail=f"审批不存在: {approval_id}")
    return record.to_dict()
