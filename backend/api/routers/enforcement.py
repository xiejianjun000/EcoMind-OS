"""
/api/enforcement — 环保执法案件全生命周期管理路由
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from api.schemas.enforcement import CaseCreateRequest, CaseTransitionRequest, CaseUpdateRequest
from api.services.enforcement_service import EnforcementService, get_enforcement_service

router = APIRouter(prefix="/api/enforcement", tags=["enforcement"])


@router.get("/cases", summary="列出所有案件")
async def list_cases(
    stage: Optional[str] = Query(default=None, description="按办理阶段过滤"),
    department: Optional[str] = Query(default=None, description="按部门过滤"),
    priority: Optional[str] = Query(default=None, description="按优先级过滤"),
    assignee: Optional[str] = Query(default=None, description="按承办人过滤"),
    limit: int = Query(default=100, ge=1, le=500, description="返回数量上限"),
    offset: int = Query(default=0, ge=0, description="偏移量"),
    service: EnforcementService = Depends(get_enforcement_service),
) -> list[dict]:
    """获取所有案件列表，支持按阶段、部门、优先级和承办人过滤。"""
    records = await service.list_cases(
        stage=stage,
        department=department,
        priority=priority,
        assignee=assignee,
        limit=limit,
        offset=offset,
    )
    return [r.to_dict() for r in records]


@router.post("/cases", status_code=201, summary="创建案件")
async def create_case(
    request: CaseCreateRequest,
    service: EnforcementService = Depends(get_enforcement_service),
) -> dict:
    """创建新的执法案件，初始阶段为"线索"。"""
    record = await service.create_case(request.model_dump())
    return record.to_dict()


@router.get("/cases/{case_id}", summary="获取案件详情")
async def get_case(
    case_id: str,
    service: EnforcementService = Depends(get_enforcement_service),
) -> dict:
    """获取指定案件的详细信息和当前办理阶段。"""
    record = await service.get_case(case_id)
    if record is None:
        raise HTTPException(status_code=404, detail=f"案件不存在: {case_id}")
    return record.to_dict()


@router.put("/cases/{case_id}", summary="更新案件信息")
async def update_case(
    case_id: str,
    request: CaseUpdateRequest,
    service: EnforcementService = Depends(get_enforcement_service),
) -> dict:
    """更新案件基本信息（标题、描述、部门、优先级、承办人等可编辑字段）。"""
    record = await service.update_case(case_id, request.model_dump(exclude_none=True))
    if record is None:
        raise HTTPException(status_code=404, detail=f"案件不存在: {case_id}")
    return record.to_dict()


@router.post("/cases/{case_id}/transition", summary="案件阶段流转")
async def transition_case(
    case_id: str,
    request: CaseTransitionRequest,
    service: EnforcementService = Depends(get_enforcement_service),
) -> dict:
    """
    推进案件到下一办理阶段，触发审批记录。

    状态流转链：线索 → 受理 → 立案 → 调查 → 告知 → 决定 → 执行 → 归档
    """
    try:
        record = await service.transition(
            case_id=case_id,
            target_stage=request.target_stage.value,
            operator=request.operator,
            remark=request.comment or "",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if record is None:
        raise HTTPException(status_code=404, detail=f"案件不存在: {case_id}")
    return record.to_dict()


@router.delete("/cases/{case_id}", status_code=204, summary="删除案件")
async def delete_case(
    case_id: str,
    service: EnforcementService = Depends(get_enforcement_service),
) -> None:
    """删除指定案件记录。"""
    deleted = await service.delete_case(case_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"案件不存在: {case_id}")
