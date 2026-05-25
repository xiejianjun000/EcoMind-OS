"""
/api/security — 安全治理 + GOVMCP 审批路由
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from api.schemas.security import (
    ApprovalActionRequest,
    ApprovalListResponse,
    ApprovalResponse,
    ApprovalStatusResponse,
    AuditTrailResponse,
    SecurityEventListResponse,
    SecurityEventSeverity,
    SecurityEventType,
)
from api.services.security_service import SecurityService, get_security_service

router = APIRouter()


@router.get("/events", response_model=SecurityEventListResponse, summary="获取安全事件列表")
async def list_security_events(
    event_type: Optional[SecurityEventType] = Query(default=None, description="按事件类型过滤"),
    severity: Optional[SecurityEventSeverity] = Query(default=None, description="按严重等级过滤"),
    resolved: Optional[bool] = Query(default=None, description="按是否已处理过滤"),
    limit: int = Query(default=100, ge=1, le=500, description="返回数量上限"),
    offset: int = Query(default=0, ge=0, description="偏移量"),
    service: SecurityService = Depends(get_security_service),
) -> SecurityEventListResponse:
    """
    获取安全事件列表。

    支持按事件类型（幻觉/未授权/数据泄露等）、严重等级、处理状态过滤。
    """
    return await service.list_security_events(
        event_type=event_type,
        severity=severity,
        resolved=resolved,
        limit=limit,
        offset=offset,
    )


@router.get("/approvals", response_model=ApprovalListResponse, summary="获取审批队列")
async def list_approvals(
    status: Optional[ApprovalStatusResponse] = Query(default=None, description="按审批状态过滤"),
    department: Optional[str] = Query(default=None, description="按部门过滤"),
    user_id: Optional[str] = Query(default=None, description="按用户过滤"),
    limit: int = Query(default=100, ge=1, le=500, description="返回数量上限"),
    offset: int = Query(default=0, ge=0, description="偏移量"),
    service: SecurityService = Depends(get_security_service),
) -> ApprovalListResponse:
    """
    获取审批队列。

    返回当前用户的待审批/已审批列表。
    通过 GOVMCP ApprovalWorkflow 获取数据。
    """
    return await service.list_approvals(
        status=status,
        department=department,
        user_id=user_id,
        limit=limit,
        offset=offset,
    )


@router.post(
    "/approvals/{approval_id}/approve",
    response_model=ApprovalResponse,
    summary="审批通过",
)
async def approve_approval(
    approval_id: str,
    request: ApprovalActionRequest,
    service: SecurityService = Depends(get_security_service),
) -> ApprovalResponse:
    """
    审批通过。

    调用 GOVMCP ApprovalWorkflow.approve()，推进审批流程到下一步。
    审批操作会记录到审计日志。
    """
    response = await service.approve(approval_id, request)
    if response is None:
        raise HTTPException(
            status_code=404,
            detail=f"审批请求不存在或操作失败: {approval_id}",
        )
    return response


@router.post(
    "/approvals/{approval_id}/reject",
    response_model=ApprovalResponse,
    summary="审批驳回",
)
async def reject_approval(
    approval_id: str,
    request: ApprovalActionRequest,
    service: SecurityService = Depends(get_security_service),
) -> ApprovalResponse:
    """
    审批驳回。

    调用 GOVMCP ApprovalWorkflow.reject()，驳回审批请求。
    驳回操作会记录到审计日志。
    """
    response = await service.reject(approval_id, request)
    if response is None:
        raise HTTPException(
            status_code=404,
            detail=f"审批请求不存在或操作失败: {approval_id}",
        )
    return response


@router.get("/audit-trail", response_model=AuditTrailResponse, summary="获取审计日志")
async def get_audit_trail(
    user_id: Optional[str] = Query(default=None, description="按操作人过滤"),
    action: Optional[str] = Query(default=None, description="按操作类型过滤"),
    limit: int = Query(default=100, ge=1, le=500, description="返回数量上限"),
    service: SecurityService = Depends(get_security_service),
) -> AuditTrailResponse:
    """
    获取审计日志。

    返回系统审计记录，支持按操作人、操作类型过滤。
    同时返回哈希链完整性验证结果（SM3 国密哈希链）。
    """
    return await service.get_audit_trail(user_id=user_id, action=action, limit=limit)
