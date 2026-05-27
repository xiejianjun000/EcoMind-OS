"""
环评审批服务 — 三级审批状态机管理。
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional

logger = logging.getLogger(__name__)

_LEVEL_ORDER: list[str] = ["L1-科员", "L2-处长", "L3-厅领导"]


@dataclass
class ApprovalRecord:
    """审批记录（内存存储）。"""
    approval_id: str
    approval_number: str
    title: str
    approval_type: str
    status: str
    level: str
    applicant: str = ""
    department: str = ""
    enterprise_name: str = ""
    credit_code: str = ""
    content: str = ""
    attachments: list[dict[str, Any]] = field(default_factory=list)
    timeline: list[dict[str, Any]] = field(default_factory=list)
    audit_log: list[dict[str, Any]] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.approval_id,
            "approval_number": self.approval_number,
            "title": self.title,
            "approval_type": self.approval_type,
            "status": self.status,
            "level": self.level,
            "applicant": self.applicant,
            "department": self.department,
            "enterprise_name": self.enterprise_name,
            "credit_code": self.credit_code,
            "content": self.content,
            "attachments": self.attachments,
            "timeline": self.timeline,
            "audit_log": self.audit_log,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


class ApprovalService:
    """环评审批服务 — CRUD + 三级审批状态机。"""

    def __init__(self) -> None:
        self._items: dict[str, ApprovalRecord] = {}
        self._counter: int = 0

    def _generate_number(self) -> str:
        self._counter += 1
        return f"HN-APR-{datetime.now().year}-{self._counter:03d}"

    def _log_audit(
        self, record: ApprovalRecord, action: str, detail: dict[str, Any] | None = None,
    ) -> None:
        entry = {
            "action": action,
            "detail": detail or {},
            "timestamp": datetime.now().isoformat(),
        }
        record.audit_log.append(entry)

    def _append_timeline(
        self, record: ApprovalRecord, event: str, extra: dict[str, Any] | None = None,
    ) -> None:
        entry = {
            "event": event,
            "timestamp": datetime.now().isoformat(),
            "status": record.status,
            "level": record.level,
        }
        if extra:
            entry.update(extra)
        record.timeline.append(entry)

    async def create_approval(self, data: dict[str, Any]) -> ApprovalRecord:
        approval_id = str(uuid.uuid4())
        approval_number = self._generate_number()
        record = ApprovalRecord(
            approval_id=approval_id,
            approval_number=approval_number,
            title=data.get("title", ""),
            approval_type=data.get("approval_type", ""),
            status="pending",
            level="L1-科员",
            applicant=data.get("applicant", ""),
            department=data.get("department", ""),
            enterprise_name=data.get("enterprise_name", ""),
            credit_code=data.get("credit_code", ""),
            content=data.get("content", ""),
            attachments=data.get("attachments", []),
        )
        self._append_timeline(record, "create")
        self._log_audit(record, "create_approval")
        self._items[approval_id] = record
        logger.info(f"审批已创建: {approval_number} ({approval_id})")
        return record

    async def get_approval(self, approval_id: str) -> Optional[ApprovalRecord]:
        return self._items.get(approval_id)

    async def list_approvals(
        self,
        approval_type: Optional[str] = None,
        status: Optional[str] = None,
        level: Optional[str] = None,
        department: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[ApprovalRecord]:
        records = list(self._items.values())
        if approval_type:
            records = [r for r in records if r.approval_type == approval_type]
        if status:
            records = [r for r in records if r.status == status]
        if level:
            records = [r for r in records if r.level == level]
        if department:
            records = [r for r in records if r.department == department]
        records.sort(key=lambda r: r.updated_at, reverse=True)
        return records[offset: offset + limit]

    async def transition(
        self, approval_id: str, action: str, operator: str = "", comment: str = "",
    ) -> Optional[ApprovalRecord]:
        record = self._items.get(approval_id)
        if not record:
            return None
        if record.status in ("approved", "rejected", "returned"):
            raise ValueError(f"审批已终态，不可再流转: {record.status}")

        valid_actions = {"approve", "reject", "return"}
        if action not in valid_actions:
            raise ValueError(f"无效操作: {action}，仅支持 approve/reject/return")

        old_level = record.level
        old_status = record.status

        if action == "approve":
            current_idx = _LEVEL_ORDER.index(record.level)
            if current_idx < len(_LEVEL_ORDER) - 1:
                record.level = _LEVEL_ORDER[current_idx + 1]
                record.status = "pending"
            else:
                record.status = "approved"
        elif action == "reject":
            record.status = "rejected"
        elif action == "return":
            record.status = "returned"

        record.updated_at = datetime.now()

        self._append_timeline(record, "transition", {
            "action": action,
            "from_level": old_level,
            "to_level": record.level,
            "from_status": old_status,
            "to_status": record.status,
            "operator": operator,
            "comment": comment,
        })
        self._log_audit(record, "transition", {
            "action": action,
            "from_level": old_level,
            "to_level": record.level,
            "operator": operator,
        })
        logger.info(
            f"审批 {record.approval_number}: {action} | "
            f"{old_level} → {record.level} | {old_status} → {record.status}"
        )
        return record


_approval_service: Optional[ApprovalService] = None


def get_approval_service() -> ApprovalService:
    global _approval_service
    if _approval_service is None:
        _approval_service = ApprovalService()
    return _approval_service
