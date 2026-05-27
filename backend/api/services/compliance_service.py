"""
合规检查服务 — 环保法规标准查询与自动化检查。
"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional

logger = logging.getLogger(__name__)


@dataclass
class ComplianceCheck:
    check_id: str
    title: str
    category: str
    regulation: str
    target: str
    status: str
    result: str
    issues: list[dict[str, Any]] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.check_id,
            "title": self.title,
            "category": self.category,
            "regulation": self.regulation,
            "target": self.target,
            "status": self.status,
            "result": self.result,
            "issues": self.issues,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


class ComplianceService:
    def __init__(self) -> None:
        self._checks: dict[str, ComplianceCheck] = {}

    async def create_check(self, data: dict[str, Any]) -> ComplianceCheck:
        check = ComplianceCheck(
            check_id=str(uuid.uuid4()),
            title=data.get("title", ""),
            category=data.get("category", "废水"),
            regulation=data.get("regulation", ""),
            target=data.get("target", ""),
            status="pending",
            result="",
        )
        self._checks[check.check_id] = check
        logger.info(f"合规检查已创建: {check.check_id}")
        return check

    async def get_check(self, check_id: str) -> Optional[ComplianceCheck]:
        return self._checks.get(check_id)

    async def list_checks(
        self, category: Optional[str] = None, status: Optional[str] = None,
        limit: int = 100, offset: int = 0,
    ) -> list[ComplianceCheck]:
        records = list(self._checks.values())
        if category:
            records = [r for r in records if r.category == category]
        if status:
            records = [r for r in records if r.status == status]
        records.sort(key=lambda r: r.updated_at, reverse=True)
        return records[offset: offset + limit]

    async def run_check(self, check_id: str) -> Optional[ComplianceCheck]:
        check = self._checks.get(check_id)
        if not check:
            return None
        check.status = "completed"
        check.result = "pass" if not check.issues else "fail"
        check.updated_at = datetime.now()
        return check


_compliance_service: Optional[ComplianceService] = None


def get_compliance_service() -> ComplianceService:
    global _compliance_service
    if _compliance_service is None:
        _compliance_service = ComplianceService()
    return _compliance_service
