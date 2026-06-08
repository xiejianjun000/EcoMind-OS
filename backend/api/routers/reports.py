"""报告生成路由"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query

from api.services.report_service import ReportService, get_report_service

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("", summary="报告列表")
async def list_reports(
    report_type: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    service: ReportService = Depends(get_report_service),
) -> list[dict]:
    records = await service.list_reports(report_type=report_type, limit=limit, offset=offset)
    return [r.to_dict() for r in records]


@router.post("", status_code=201, summary="生成报告")
async def generate_report(
    request: dict,
    service: ReportService = Depends(get_report_service),
) -> dict:
    record = await service.generate(request)
    return record.to_dict()


@router.get("/{report_id}", summary="报告详情")
async def get_report(
    report_id: str,
    service: ReportService = Depends(get_report_service),
) -> dict:
    record = await service.get_report(report_id)
    if record is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"报告不存在: {report_id}")
    return record.to_dict()
