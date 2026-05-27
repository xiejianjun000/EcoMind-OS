"""合规检查 + 报告生成 — 联合路由"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from api.services.compliance_service import ComplianceService, get_compliance_service

router = APIRouter(tags=["compliance"])


# ─── 合规检查 ───

@router.get("/api/compliance/checks", summary="合规检查列表")
async def list_checks(
    category: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    service: ComplianceService = Depends(get_compliance_service),
) -> list[dict]:
    records = await service.list_checks(category=category, status=status, limit=limit, offset=offset)
    return [r.to_dict() for r in records]


@router.post("/api/compliance/checks", status_code=201, summary="创建合规检查")
async def create_check(
    request: dict,
    service: ComplianceService = Depends(get_compliance_service),
) -> dict:
    record = await service.create_check(request)
    return record.to_dict()


@router.get("/api/compliance/checks/{check_id}", summary="合规检查详情")
async def get_check(
    check_id: str,
    service: ComplianceService = Depends(get_compliance_service),
) -> dict:
    record = await service.get_check(check_id)
    if record is None:
        raise HTTPException(status_code=404, detail=f"检查不存在: {check_id}")
    return record.to_dict()


@router.post("/api/compliance/checks/{check_id}/run", summary="执行合规检查")
async def run_check(
    check_id: str,
    service: ComplianceService = Depends(get_compliance_service),
) -> dict:
    record = await service.run_check(check_id)
    if record is None:
        raise HTTPException(status_code=404, detail=f"检查不存在: {check_id}")
    return record.to_dict()
