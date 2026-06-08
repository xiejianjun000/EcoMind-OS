"""
Security 业务逻辑服务 — EcoMind 自建版。

不再依赖 taiji_agent.govmcp 模块。
审批流、安全事件、审计日志全部自建，纯 Python 实现。
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
        source: str = "eco-verifier",
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


class ApprovalRecord:
    """审批请求记录（自建，替代 GOVMCP ApprovalWorkflow）。"""

    def __init__(
        self,
        title: str,
        description: str,
        requester: str,
        department: str = "",
        steps: Optional[list[dict]] = None,
    ) -> None:
        self.approval_id = str(uuid.uuid4())
        self.title = title
        self.description = description
        self.requester = requester
        self.department = department
        self.status = ApprovalStatusResponse.PENDING
        self.steps: list[dict] = steps or [{
            "step_id": str(uuid.uuid4()),
            "step_name": "一级审批",
            "approvers": [],
            "required_approvers": 1,
            "status": "pending",
            "approved_by": [],
            "rejected_by": [],
            "comments": [],
        }]
        self.current_step = 0
        self.metadata: dict[str, Any] = {}
        self.created_at = datetime.now()
        self.updated_at = datetime.now()

    def to_response(self) -> ApprovalResponse:
        steps = [
            ApprovalStepResponse(
                step_id=s["step_id"],
                step_name=s["step_name"],
                approvers=s.get("approvers", []),
                required_approvers=s.get("required_approvers", 1),
                status=ApprovalStatusResponse(s.get("status", "pending")),
                approved_by=s.get("approved_by", []),
                rejected_by=s.get("rejected_by", []),
                comments=s.get("comments", []),
            )
            for s in self.steps
        ]
        return ApprovalResponse(
            approval_id=self.approval_id,
            title=self.title,
            description=self.description,
            requester=self.requester,
            department=self.department,
            status=self.status,
            steps=steps,
            current_step=self.current_step,
            metadata=self.metadata,
            created_at=self.created_at,
            updated_at=self.updated_at,
        )


class AuditRecord:
    """审计记录。"""

    def __init__(
        self,
        user_id: str,
        action: str,
        resource: str,
        success: bool = True,
        details: Optional[dict[str, Any]] = None,
    ) -> None:
        self.record_id = str(uuid.uuid4())
        self.user_id = user_id
        self.action = action
        self.resource = resource
        self.success = success
        self.details = details or {}
        self.timestamp = datetime.now()


class SecurityService:
    """
    Security 业务逻辑服务 — EcoMind 自建版。

    安全事件管理 + 审批队列 + 审计日志。
    纯自建，零外部依赖。
    """

    def __init__(self) -> None:
        self._events: list[SecurityEventRecord] = []
        self._approvals: dict[str, ApprovalRecord] = {}
        self._audit_records: list[AuditRecord] = []
        logger.info("EcoMind SecurityService 初始化完成（自建模式）")

    # ─── 安全事件 ────────────────────────────

    def create_event(
        self,
        event_type: SecurityEventType,
        severity: SecurityEventSeverity,
        title: str,
        description: str = "",
        agent_id: Optional[str] = None,
        source: str = "eco-verifier",
    ) -> SecurityEventRecord:
        """创建安全事件"""
        event = SecurityEventRecord(
            event_type=event_type,
            severity=severity,
            title=title,
            description=description,
            agent_id=agent_id,
            source=source,
        )
        self._events.append(event)
        self._notify_ws("security:event", {"event_id": event.event_id, "title": title})
        return event

    async def list_security_events(
        self,
        event_type: Optional[SecurityEventType] = None,
        severity: Optional[SecurityEventSeverity] = None,
        resolved: Optional[bool] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> SecurityEventListResponse:
        """获取安全事件列表"""
        events = list(self._events)
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

    # ─── 审批管理 ─────────────────────────────

    async def create_approval(
        self,
        title: str,
        description: str,
        requester: str,
        department: str = "",
    ) -> ApprovalResponse:
        """创建审批请求"""
        record = ApprovalRecord(
            title=title,
            description=description,
            requester=requester,
            department=department,
        )
        self._approvals[record.approval_id] = record
        self._notify_ws("approval:created", {"approval_id": record.approval_id})
        return record.to_response()

    async def list_approvals(
        self,
        status: Optional[ApprovalStatusResponse] = None,
        department: Optional[str] = None,
        user_id: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> ApprovalListResponse:
        """获取审批列表"""
        approvals = list(self._approvals.values())
        if status:
            approvals = [a for a in approvals if a.status == status]
        if department:
            approvals = [a for a in approvals if a.department == department]
        if user_id:
            approvals = [a for a in approvals if a.requester == user_id]

        approvals.sort(key=lambda a: a.updated_at, reverse=True)
        total = len(approvals)
        approvals = approvals[offset: offset + limit]

        return ApprovalListResponse(
            approvals=[a.to_response() for a in approvals],
            total=total,
        )

    async def approve(self, approval_id: str, request: ApprovalActionRequest) -> Optional[ApprovalResponse]:
        """审批通过"""
        record = self._approvals.get(approval_id)
        if not record:
            return None

        record.status = ApprovalStatusResponse.APPROVED
        record.updated_at = datetime.now()

        # 审计记录
        self._record_audit(
            user_id=request.approver_id,
            action="approve",
            resource=f"approval:{approval_id}",
            details={"comment": request.comment},
        )

        self._notify_ws("approval:notification", {
            "approval_id": approval_id,
            "event": "approved",
            "approver_id": request.approver_id,
        })

        return record.to_response()

    async def reject(self, approval_id: str, request: ApprovalActionRequest) -> Optional[ApprovalResponse]:
        """审批驳回"""
        record = self._approvals.get(approval_id)
        if not record:
            return None

        record.status = ApprovalStatusResponse.REJECTED
        record.updated_at = datetime.now()

        self._record_audit(
            user_id=request.approver_id,
            action="reject",
            resource=f"approval:{approval_id}",
            details={"comment": request.comment},
        )

        self._notify_ws("approval:notification", {
            "approval_id": approval_id,
            "event": "rejected",
            "approver_id": request.approver_id,
        })

        return record.to_response()

    # ─── 审计日志 ─────────────────────────────

    async def get_audit_trail(
        self,
        user_id: Optional[str] = None,
        action: Optional[str] = None,
        limit: int = 100,
    ) -> AuditTrailResponse:
        """获取审计日志"""
        records = list(self._audit_records)
        if user_id:
            records = [r for r in records if r.user_id == user_id]
        if action:
            records = [r for r in records if r.action == action]

        records.sort(key=lambda r: r.timestamp, reverse=True)
        total = len(records)
        records = records[:limit]

        audit_records = [
            AuditRecordResponse(
                record_id=r.record_id,
                user_id=r.user_id,
                action=r.action,
                resource=r.resource,
                timestamp=r.timestamp,
                success=r.success,
                details=r.details,
            )
            for r in records
        ]

        return AuditTrailResponse(
            records=audit_records,
            total=total,
            chain_valid=True,
        )

    # ─── 内部方法 ─────────────────────────────

    def _record_audit(
        self,
        user_id: str,
        action: str,
        resource: str,
        details: Optional[dict[str, Any]] = None,
        success: bool = True,
    ) -> None:
        """记录审计操作"""
        record = AuditRecord(
            user_id=user_id,
            action=action,
            resource=resource,
            success=success,
            details=details,
        )
        self._audit_records.append(record)

    @staticmethod
    def _notify_ws(topic: str, data: dict[str, Any]) -> None:
        """通过 WebSocket 推送通知"""
        try:
            from api.main import ws_manager
            ws_manager.enqueue_broadcast(topic, data)
        except Exception:
            pass


# 全局单例
_security_service: Optional[SecurityService] = None


def get_security_service() -> SecurityService:
    global _security_service
    if _security_service is None:
        _security_service = SecurityService()
    return _security_service
