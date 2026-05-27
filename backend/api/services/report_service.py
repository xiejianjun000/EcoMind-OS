"""报告生成服务"""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional

logger = logging.getLogger(__name__)

_REPORT_TEMPLATES = {
    "监测报告": "## 环境监测报告\n\n- 监测时间: {date}\n- 监测区域: {city}\n- AQI: {aqi}\n- 结论: {conclusion}",
    "执法报告": "## 执法案件报告\n\n- 案件编号: {case_number}\n- 企业: {enterprise}\n- 违法行为: {violation}\n- 处罚决定: {verdict}",
    "审批报告": "## 审批结果报告\n\n- 审批编号: {approval_number}\n- 类型: {approval_type}\n- 结果: {result}\n- 审批意见: {comment}",
}


@dataclass
class Report:
    report_id: str
    title: str
    report_type: str
    status: str
    content: str
    params: dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.report_id,
            "title": self.title,
            "report_type": self.report_type,
            "status": self.status,
            "content": self.content,
            "params": self.params,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


class ReportService:
    def __init__(self) -> None:
        self._reports: dict[str, Report] = {}

    async def generate(self, data: dict[str, Any]) -> Report:
        report_type = data.get("report_type", "监测报告")
        template = _REPORT_TEMPLATES.get(report_type, _REPORT_TEMPLATES["监测报告"])
        content = template.format(**data.get("params", {}), date=datetime.now().strftime("%Y-%m-%d"))
        report = Report(
            report_id=str(uuid.uuid4()),
            title=data.get("title", f"{report_type}-{datetime.now():%Y%m%d}"),
            report_type=report_type,
            status="generated",
            content=content,
            params=data.get("params", {}),
        )
        self._reports[report.report_id] = report
        logger.info(f"报告已生成: {report.report_id}")
        return report

    async def get_report(self, report_id: str) -> Optional[Report]:
        return self._reports.get(report_id)

    async def list_reports(
        self, report_type: Optional[str] = None, limit: int = 100, offset: int = 0,
    ) -> list[Report]:
        records = list(self._reports.values())
        if report_type:
            records = [r for r in records if r.report_type == report_type]
        records.sort(key=lambda r: r.updated_at, reverse=True)
        return records[offset: offset + limit]


_report_service: Optional[ReportService] = None


def get_report_service() -> ReportService:
    global _report_service
    if _report_service is None:
        _report_service = ReportService()
    return _report_service
