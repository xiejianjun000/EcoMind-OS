"""
执法办案服务 — 案件全生命周期状态机管理。
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional

logger = logging.getLogger(__name__)

_STATE_WHITELIST: dict[str, set[str]] = {
    "线索": {"受理", "归档"},
    "受理": {"立案", "归档"},
    "立案": {"调查"},
    "调查": {"告知", "归档"},
    "告知": {"决定", "归档"},
    "决定": {"执行"},
    "执行": {"归档"},
    "归档": set(),
}

_VALID_STAGES = set(_STATE_WHITELIST.keys())


@dataclass
class CaseRecord:
    """案件记录（内存存储）。"""
    case_id: str
    case_number: str
    title: str
    stage: str
    description: str = ""
    department: str = ""
    priority: str = "normal"
    reporter: str = ""
    assignee: str = ""
    tags: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)
    timeline: list[dict[str, Any]] = field(default_factory=list)
    audit_log: list[dict[str, Any]] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> dict[str, Any]:
        return {
            "case_id": self.case_id,
            "case_number": self.case_number,
            "title": self.title,
            "stage": self.stage,
            "description": self.description,
            "department": self.department,
            "priority": self.priority,
            "reporter": self.reporter,
            "assignee": self.assignee,
            "tags": self.tags,
            "metadata": self.metadata,
            "timeline": self.timeline,
            "audit_log": self.audit_log,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


class EnforcementService:
    """执法办案服务 — 案件 CRUD + 状态机流转。"""

    def __init__(self) -> None:
        self._cases: dict[str, CaseRecord] = {}
        self._case_counter: int = 0

    def _generate_case_number(self) -> str:
        self._case_counter += 1
        return f"HN-ENF-{datetime.now().year}-{self._case_counter:03d}"

    def _log_audit(
        self, record: CaseRecord, action: str, detail: dict[str, Any] | None = None,
    ) -> None:
        entry = {
            "action": action,
            "detail": detail or {},
            "timestamp": datetime.now().isoformat(),
        }
        record.audit_log.append(entry)

    def _append_timeline(
        self, record: CaseRecord, event: str, extra: dict[str, Any] | None = None,
    ) -> None:
        entry = {
            "event": event,
            "timestamp": datetime.now().isoformat(),
            "stage": record.stage,
        }
        if extra:
            entry.update(extra)
        record.timeline.append(entry)

    async def create_case(self, data: dict[str, Any]) -> CaseRecord:
        case_id = str(uuid.uuid4())
        case_number = self._generate_case_number()
        record = CaseRecord(
            case_id=case_id,
            case_number=case_number,
            title=data.get("title", ""),
            stage="线索",
            description=data.get("description", ""),
            department=data.get("department", ""),
            priority=data.get("priority", "normal"),
            reporter=data.get("reporter", ""),
            assignee=data.get("assignee", ""),
            tags=data.get("tags", []),
            metadata=data.get("metadata", {}),
        )
        self._append_timeline(record, "create")
        self._log_audit(record, "create_case")
        self._cases[case_id] = record
        logger.info(f"案件已创建: {case_number} ({case_id})")
        return record

    async def get_case(self, case_id: str) -> Optional[CaseRecord]:
        return self._cases.get(case_id)

    async def list_cases(
        self,
        stage: Optional[str] = None,
        department: Optional[str] = None,
        priority: Optional[str] = None,
        assignee: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[CaseRecord]:
        records = list(self._cases.values())
        if stage:
            records = [r for r in records if r.stage == stage]
        if department:
            records = [r for r in records if r.department == department]
        if priority:
            records = [r for r in records if r.priority == priority]
        if assignee:
            records = [r for r in records if r.assignee == assignee]
        records.sort(key=lambda r: r.updated_at, reverse=True)
        return records[offset: offset + limit]

    async def transition(
        self, case_id: str, target_stage: str, operator: str = "", remark: str = "",
    ) -> Optional[CaseRecord]:
        record = self._cases.get(case_id)
        if not record:
            return None
        if target_stage not in _VALID_STAGES:
            raise ValueError(f"无效的目标状态: {target_stage}")
        allowed = _STATE_WHITELIST.get(record.stage, set())
        if target_stage not in allowed:
            raise ValueError(
                f"状态流转不允许: {record.stage} → {target_stage}"
            )

        approval_id = str(uuid.uuid4())
        old_stage = record.stage
        record.stage = target_stage
        record.updated_at = datetime.now()

        self._append_timeline(record, "transition", {
            "from_stage": old_stage,
            "to_stage": target_stage,
            "operator": operator,
            "remark": remark,
            "approval_id": approval_id,
        })
        self._log_audit(record, "transition", {
            "from_stage": old_stage,
            "to_stage": target_stage,
            "approval_id": approval_id,
            "operator": operator,
        })
        logger.info(
            f"案件 {record.case_number}: {old_stage} → {target_stage} (审批: {approval_id})"
        )
        return record

    async def update_case(
        self, case_id: str, data: dict[str, Any],
    ) -> Optional[CaseRecord]:
        record = self._cases.get(case_id)
        if not record:
            return None
        updatable = {
            "title", "description", "department", "priority",
            "reporter", "assignee", "tags", "metadata",
        }
        changed = {}
        for key in updatable:
            if key in data:
                setattr(record, key, data[key])
                changed[key] = data[key]
        record.updated_at = datetime.now()
        self._log_audit(record, "update_case", changed)
        return record

    async def delete_case(self, case_id: str) -> bool:
        if case_id not in self._cases:
            return False
        del self._cases[case_id]
        logger.info(f"案件已删除: {case_id}")
        return True


_enforcement_service: Optional[EnforcementService] = None


def get_enforcement_service() -> EnforcementService:
    global _enforcement_service
    if _enforcement_service is None:
        _enforcement_service = EnforcementService()
    return _enforcement_service
