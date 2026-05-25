"""
Security 业务逻辑服务

封装对 taiji_agent.govmcp 模块的调用，提供安全事件管理、审批流、审计日志等功能。
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime
from typing import Any, Optional

from api.schemas.security import (
    ApprovalActionRequest,
    ApprovalListResponse,
    ApprovalResponse,
    ApprovalStatusResponse,
    ApprovalStepResponse,
    AuditRecordResponse,
    AuditTrailResponse,
    SecurityEventListResponse,
    SecurityEventResponse,
    SecurityEventSeverity,
    SecurityEventType,
)

logger = logging.getLogger(__name__)


class SecurityEventRecord:
    """安全事件记录。"""

    def __init__(
        self,
        event_type: SecurityEventType,
        severity: SecurityEventSeverity,
        title: str,
        description: str = "",
        agent_id: Optional[str] = None,
        source: str = "system",
        metadata: Optional[dict[str, Any]] = None,
    ) -> None:
        self.event_id = str(uuid.uuid4())
        self.event_type = event_type
        self.severity = severity
        self.title = title
        self.description = description
        self.agent_id = agent_id
        self.source = source
        self.metadata = metadata or {}
        self.resolved = False
        self.created_at = datetime.now()

    def to_response(self) -> SecurityEventResponse:
        return SecurityEventResponse(
            event_id=self.event_id,
            event_type=self.event_type,
            severity=self.severity,
            title=self.title,
            description=self.description,
            agent_id=self.agent_id,
            source=self.source,
            metadata=self.metadata,
            resolved=self.resolved,
            created_at=self.created_at,
        )


class SecurityService:
    """
    Security 业务逻辑服务

    提供安全事件管理、GOVMCP 审批流管理、审计日志查询。
    内部调用 govmcp.workflow.ApprovalWorkflow 和 govmcp.crypto.AuditTrail。
    """

    def __init__(self) -> None:
        self._events: list[SecurityEventRecord] = []
        self._approval_workflow: Any = None
        self._audit_trail: Any = None
        self._init_govmcp()

    def _init_govmcp(self) -> None:
        """初始化 GOVMCP 审批工作流和审计追踪。"""
        try:
            from taiji_agent.govmcp.workflow import ApprovalWorkflow
            self._approval_workflow = ApprovalWorkflow()
            logger.info("GOVMCP ApprovalWorkflow 初始化成功")
        except ImportError:
            logger.warning("govmcp.workflow 不可用，审批功能将以模拟模式运行")
        except Exception as e:
            logger.error(f"GOVMCP 初始化失败: {e}")

        try:
            from taiji_agent.govmcp.crypto import AuditTrail
            self._audit_trail = AuditTrail()
            logger.info("GOVMCP AuditTrail 初始化成功")
        except ImportError:
            logger.warning("govmcp.crypto.AuditTrail 不可用，审计功能将以模拟模式运行")
        except Exception as e:
            logger.error(f"AuditTrail 初始化失败: {e}")

    async def list_security_events(
        self,
        event_type: Optional[SecurityEventType] = None,
        severity: Optional[SecurityEventSeverity] = None,
        resolved: Optional[bool] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> SecurityEventListResponse:
        """
        获取安全事件列表，支持按类型/严重等级/处理状态过滤。

        Args:
            event_type: 按事件类型过滤
            severity: 按严重等级过滤
            resolved: 按是否已处理过滤
            limit: 返回数量上限
            offset: 偏移量

        Returns:
            安全事件列表响应
        """
        events = self._events

        if event_type:
            events = [e for e in events if e.event_type == event_type]
        if severity:
            events = [e for e in events if e.severity == severity]
        if resolved is not None:
            events = [e for e in events if e.resolved == resolved]

        events.sort(key=lambda e: e.created_at, reverse=True)
        total = len(events)
        events = events[offset: offset + limit]

        return SecurityEventListResponse(
            events=[e.to_response() for e in events],
            total=total,
        )

    async def list_approvals(
        self,
        status: Optional[ApprovalStatusResponse] = None,
        department: Optional[str] = None,
        user_id: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> ApprovalListResponse:
        """
        获取审批队列列表。

        通过 GOVMCP ApprovalWorkflow 获取审批请求，若不可用则返回空列表。

        Args:
            status: 按审批状态过滤
            department: 按部门过滤
            user_id: 按用户过滤
            limit: 返回数量上限
            offset: 偏移量

        Returns:
            审批列表响应
        """
        if self._approval_workflow:
            try:
                from taiji_agent.govmcp.workflow import ApprovalStatus as GovApprovalStatus

                gov_status = None
                if status:
                    status_map = {
                        ApprovalStatusResponse.DRAFT: GovApprovalStatus.DRAFT,
                        ApprovalStatusResponse.PENDING: GovApprovalStatus.PENDING,
                        ApprovalStatusResponse.IN_REVIEW: GovApprovalStatus.IN_REVIEW,
                        ApprovalStatusResponse.APPROVED: GovApprovalStatus.APPROVED,
                        ApprovalStatusResponse.REJECTED: GovApprovalStatus.REJECTED,
                        ApprovalStatusResponse.RETURNED: GovApprovalStatus.RETURNED,
                        ApprovalStatusResponse.CANCELLED: GovApprovalStatus.CANCELLED,
                        ApprovalStatusResponse.COMPLETED: GovApprovalStatus.COMPLETED,
                    }
                    gov_status = status_map.get(status)

                requests = self._approval_workflow.list_requests(
                    user_id=user_id,
                    status=gov_status,
                    department=department,
                )

                approvals = []
                for req in requests[offset: offset + limit]:
                    steps = [
                        ApprovalStepResponse(
                            step_id=s.step_id,
                            step_name=s.step_name,
                            approvers=[{"user_id": a.user_id, "name": a.name, "role": a.role} for a in s.approvers],
                            required_approvers=s.required_approvers,
                            status=ApprovalStatusResponse(s.status.value),
                            approved_by=s.approved_by,
                            rejected_by=s.rejected_by,
                            comments=s.comments,
                        )
                        for s in req.steps
                    ]

                    approvals.append(ApprovalResponse(
                        approval_id=req.request_id,
                        title=req.title,
                        description=req.description,
                        requester=req.requester,
                        department=req.department,
                        status=ApprovalStatusResponse(req.status.value),
                        steps=steps,
                        current_step=req.current_step,
                        metadata=req.metadata,
                        created_at=datetime.fromtimestamp(req.created_at),
                        updated_at=datetime.fromtimestamp(req.updated_at),
                    ))

                return ApprovalListResponse(
                    approvals=approvals,
                    total=len(requests),
                )
            except Exception as e:
                logger.error(f"获取审批列表失败: {e}")

        return ApprovalListResponse(approvals=[], total=0)

    async def approve(self, approval_id: str, request: ApprovalActionRequest) -> Optional[ApprovalResponse]:
        """
        审批通过。

        调用 GOVMCP ApprovalWorkflow.approve() 执行审批通过操作，
        并通过 WebSocket 推送审批通知。

        Args:
            approval_id: 审批请求 ID
            request: 审批操作请求

        Returns:
            更新后的审批详情，不存在返回 None
        """
        if self._approval_workflow:
            try:
                decision = await self._approval_workflow.approve(
                    request_id=approval_id,
                    approver_id=request.approver_id,
                    comment=request.comment,
                    step_id=request.step_id,
                )

                # 记录审计
                self._record_audit(
                    user_id=request.approver_id,
                    action="approve",
                    resource=f"approval:{approval_id}",
                    details={"comment": request.comment},
                )

                # WebSocket 推送
                self._notify_approval(approval_id, "approved", request.approver_id)

                # 返回更新后的审批详情
                req = self._approval_workflow.get_request(approval_id)
                if req:
                    return self._request_to_response(req)
            except ValueError:
                return None
            except Exception as e:
                logger.error(f"审批通过操作失败: {e}")

        return None

    async def reject(self, approval_id: str, request: ApprovalActionRequest) -> Optional[ApprovalResponse]:
        """
        审批驳回。

        调用 GOVMCP ApprovalWorkflow.reject() 执行审批驳回操作。

        Args:
            approval_id: 审批请求 ID
            request: 审批操作请求

        Returns:
            更新后的审批详情，不存在返回 None
        """
        if self._approval_workflow:
            try:
                decision = await self._approval_workflow.reject(
                    request_id=approval_id,
                    approver_id=request.approver_id,
                    comment=request.comment,
                    step_id=request.step_id,
                )

                self._record_audit(
                    user_id=request.approver_id,
                    action="reject",
                    resource=f"approval:{approval_id}",
                    details={"comment": request.comment},
                )

                self._notify_approval(approval_id, "rejected", request.approver_id)

                req = self._approval_workflow.get_request(approval_id)
                if req:
                    return self._request_to_response(req)
            except ValueError:
                return None
            except Exception as e:
                logger.error(f"审批驳回操作失败: {e}")

        return None

    async def get_audit_trail(
        self,
        user_id: Optional[str] = None,
        action: Optional[str] = None,
        limit: int = 100,
    ) -> AuditTrailResponse:
        """
        获取审计日志。

        调用 GOVMCP AuditTrail.get_records() 获取审计记录，
        并验证哈希链完整性。

        Args:
            user_id: 按用户过滤
            action: 按操作类型过滤
            limit: 返回数量上限

        Returns:
            审计日志响应
        """
        if self._audit_trail:
            try:
                records = self._audit_trail.get_records(
                    user_id=user_id,
                    action=action,
                    limit=limit,
                )

                chain_valid, chain_errors = self._audit_trail.verify_chain()

                audit_records = [
                    AuditRecordResponse(
                        record_id=r.record_id,
                        user_id=r.user_id,
                        action=r.action,
                        resource=r.resource,
                        timestamp=datetime.fromtimestamp(r.timestamp),
                        success=r.success,
                        details=r.details,
                    )
                    for r in records
                ]

                return AuditTrailResponse(
                    records=audit_records,
                    total=len(records),
                    chain_valid=chain_valid,
                )
            except Exception as e:
                logger.error(f"获取审计日志失败: {e}")

        return AuditTrailResponse(records=[], total=0, chain_valid=True)

    def _record_audit(
        self,
        user_id: str,
        action: str,
        resource: str,
        details: Optional[dict[str, Any]] = None,
        success: bool = True,
    ) -> None:
        """记录审计操作。"""
        if self._audit_trail:
            try:
                self._audit_trail.record_action(
                    user_id=user_id,
                    action=action,
                    resource=resource,
                    details=details,
                    success=success,
                )
            except Exception as e:
                logger.error(f"审计记录失败: {e}")

    def _notify_approval(
        self,
        approval_id: str,
        event: str,
        approver_id: str,
    ) -> None:
        """通过 WebSocket 推送审批通知。"""
        try:
            from api.main import ws_manager
            ws_manager.enqueue_broadcast("approval:notification", {
                "approval_id": approval_id,
                "event": event,
                "approver_id": approver_id,
            })
        except Exception:
            pass

    def _request_to_response(self, req: Any) -> ApprovalResponse:
        """将 GOVMCP ApprovalRequest 转换为 API 响应。"""
        steps = [
            ApprovalStepResponse(
                step_id=s.step_id,
                step_name=s.step_name,
                approvers=[{"user_id": a.user_id, "name": a.name, "role": a.role} for a in s.approvers],
                required_approvers=s.required_approvers,
                status=ApprovalStatusResponse(s.status.value),
                approved_by=s.approved_by,
                rejected_by=s.rejected_by,
                comments=s.comments,
            )
            for s in req.steps
        ]

        return ApprovalResponse(
            approval_id=req.request_id,
            title=req.title,
            description=req.description,
            requester=req.requester,
            department=req.department,
            status=ApprovalStatusResponse(req.status.value),
            steps=steps,
            current_step=req.current_step,
            metadata=req.metadata,
            created_at=datetime.fromtimestamp(req.created_at),
            updated_at=datetime.fromtimestamp(req.updated_at),
        )


# 全局单例
_security_service: Optional[SecurityService] = None


def get_security_service() -> SecurityService:
    """获取 SecurityService 单例（依赖注入用）。"""
    global _security_service
    if _security_service is None:
        _security_service = SecurityService()
    return _security_service
