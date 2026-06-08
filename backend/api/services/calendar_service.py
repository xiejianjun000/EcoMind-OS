"""
日历服务 — 环境监测任务调度 · 会议管理 · 执法排班

提供日历事件 CRUD、工作日计算、节假日管理功能。
对接 govmcp/tools.py 中的 CalendarHelper 工作日计算引擎。
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field, asdict
from datetime import datetime, date, timedelta
from typing import Any, Optional

from govmcp.tools import CalendarHelper

logger = logging.getLogger(__name__)


# ─── 数据模型 ───

@dataclass
class CalendarEvent:
    """日历事件"""
    id: str
    title: str
    event_type: str  # task | meeting | enforcement | approval | report
    start_time: str   # ISO 格式
    end_time: str     # ISO 格式
    all_day: bool = False
    description: str = ""
    location: str = ""
    assignee: str = ""
    department: str = ""
    status: str = "pending"  # pending | in_progress | completed | cancelled
    priority: str = "normal"  # low | normal | high | urgent
    recurrence: str = ""  # none | daily | weekly | monthly
    related_id: str = ""  # 关联业务 ID（如案件号、审批号）
    tags: list[str] = field(default_factory=list)
    created_at: str = ""
    updated_at: str = ""


# ─── 服务 ───

class CalendarService:
    """日历服务"""

    def __init__(self) -> None:
        self._events: dict[str, CalendarEvent] = {}
        self._init_mock_data()

    def _generate_id(self) -> str:
        import uuid
        return f"EVT-{uuid.uuid4().hex[:8].upper()}"

    def _now(self) -> str:
        return datetime.now().isoformat()

    # ─── Mock 初始化 ───

    def _init_mock_data(self) -> None:
        today = date.today()
        tomorrow = today + timedelta(days=1)
        next_week = today + timedelta(days=7)

        mock_events = [
            CalendarEvent(
                id="EVT-M001", title="湘江流域水质监测采样", event_type="task",
                start_time=f"{today.isoformat()}T09:00:00",
                end_time=f"{today.isoformat()}T12:00:00",
                all_day=False, description="湘江长沙段3个监测点水质采样", location="湘江长沙段",
                assignee="张监测员", department="环境监测中心", status="in_progress",
                priority="high", tags=["水质", "采样"],
                created_at=self._now(), updated_at=self._now(),
            ),
            CalendarEvent(
                id="EVT-M002", title="执法案件推进会", event_type="meeting",
                start_time=f"{today.isoformat()}T14:00:00",
                end_time=f"{today.isoformat()}T15:30:00",
                all_day=False, description="讨论CASE-2026-001案件进展",
                location="3楼会议室", assignee="李队长", department="执法支队",
                status="pending", priority="high", tags=["执法", "会议"],
                related_id="CASE-2026-001",
                created_at=self._now(), updated_at=self._now(),
            ),
            CalendarEvent(
                id="EVT-M003", title="排污许可证审批截止", event_type="approval",
                start_time=f"{tomorrow.isoformat()}T00:00:00",
                end_time=f"{tomorrow.isoformat()}T23:59:59",
                all_day=True, description="AP-2026-001 排污许可证审批截止日",
                assignee="审批科", department="环评审批科", status="pending",
                priority="urgent", tags=["审批", "截止"],
                related_id="AP-2026-001",
                created_at=self._now(), updated_at=self._now(),
            ),
            CalendarEvent(
                id="EVT-M004", title="月度环境监测报告提交", event_type="report",
                start_time=f"{next_week.isoformat()}T00:00:00",
                end_time=f"{next_week.isoformat()}T23:59:59",
                all_day=True, description="5月份全省环境监测月报提交",
                assignee="张监测员", department="环境监测中心", status="pending",
                priority="normal", tags=["报告", "月度"],
                created_at=self._now(), updated_at=self._now(),
            ),
            CalendarEvent(
                id="EVT-M005", title="株洲XX企业废气排放突击检查", event_type="enforcement",
                start_time=f"{(today + timedelta(days=2)).isoformat()}T10:00:00",
                end_time=f"{(today + timedelta(days=2)).isoformat()}T16:00:00",
                all_day=False, description="对株洲XX化工企业开展废气排放突击执法检查",
                location="株洲市石峰区", assignee="王执法员", department="执法支队",
                status="pending", priority="high", tags=["执法", "废气", "突击检查"],
                created_at=self._now(), updated_at=self._now(),
            ),
        ]
        for evt in mock_events:
            self._events[evt.id] = evt

    # ─── 事件 CRUD ───

    def list_events(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        event_type: Optional[str] = None,
        department: Optional[str] = None,
        assignee: Optional[str] = None,
        status: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        """查询日历事件，支持按日期范围/类型/部门/负责人/状态过滤"""
        results: list[CalendarEvent] = []
        for evt in self._events.values():
            if start_date and evt.start_time < start_date:
                continue
            if end_date and evt.start_time > end_date:
                continue
            if event_type and evt.event_type != event_type:
                continue
            if department and evt.department != department:
                continue
            if assignee and evt.assignee != assignee:
                continue
            if status and evt.status != status:
                continue
            results.append(evt)

        results.sort(key=lambda e: e.start_time)
        return [asdict(r) for r in results]

    def get_event(self, event_id: str) -> Optional[dict[str, Any]]:
        """获取单个事件详情"""
        evt = self._events.get(event_id)
        return asdict(evt) if evt else None

    def create_event(self, data: dict[str, Any]) -> dict[str, Any]:
        """创建事件"""
        evt = CalendarEvent(
            id=self._generate_id(),
            title=data.get("title", ""),
            event_type=data.get("event_type", "task"),
            start_time=data.get("start_time", self._now()),
            end_time=data.get("end_time", self._now()),
            all_day=data.get("all_day", False),
            description=data.get("description", ""),
            location=data.get("location", ""),
            assignee=data.get("assignee", ""),
            department=data.get("department", ""),
            status=data.get("status", "pending"),
            priority=data.get("priority", "normal"),
            recurrence=data.get("recurrence", "none"),
            related_id=data.get("related_id", ""),
            tags=data.get("tags", []),
            created_at=self._now(),
            updated_at=self._now(),
        )
        self._events[evt.id] = evt
        logger.info(f"日历事件已创建: {evt.id} - {evt.title}")
        return asdict(evt)

    def update_event(self, event_id: str, data: dict[str, Any]) -> Optional[dict[str, Any]]:
        """更新事件"""
        evt = self._events.get(event_id)
        if not evt:
            return None

        for key in ("title", "event_type", "start_time", "end_time", "all_day",
                     "description", "location", "assignee", "department",
                     "status", "priority", "recurrence", "related_id", "tags"):
            if key in data:
                setattr(evt, key, data[key])

        evt.updated_at = self._now()
        self._events[event_id] = evt
        logger.info(f"日历事件已更新: {event_id}")
        return asdict(evt)

    def delete_event(self, event_id: str) -> bool:
        """删除事件"""
        if event_id in self._events:
            del self._events[event_id]
            logger.info(f"日历事件已删除: {event_id}")
            return True
        return False

    # ─── 工作日工具 ───

    def is_workday(self, date_str: str) -> dict[str, Any]:
        """判断是否为工作日"""
        try:
            d = datetime.strptime(date_str, "%Y-%m-%d").date()
            return {
                "date": date_str,
                "is_workday": CalendarHelper.is_workday(d),
                "weekday": d.weekday(),
                "weekday_name": ["周一","周二","周三","周四","周五","周六","周日"][d.weekday()],
            }
        except ValueError:
            return {"error": f"日期格式错误: {date_str}，请使用 YYYY-MM-DD 格式"}

    def add_workdays(self, start_date: str, days: int) -> dict[str, Any]:
        """计算加工作日后的日期"""
        try:
            start = datetime.strptime(start_date, "%Y-%m-%d").date()
            result = CalendarHelper.add_workdays(start, days)
            return {
                "start_date": start_date,
                "days": days,
                "result_date": result.isoformat(),
                "weekday": result.weekday(),
            }
        except ValueError:
            return {"error": f"日期格式错误: {start_date}，请使用 YYYY-MM-DD 格式"}

    def calculate_workdays(self, start_date: str, end_date: str) -> dict[str, Any]:
        """计算两个日期之间的工作日天数"""
        try:
            start = datetime.strptime(start_date, "%Y-%m-%d").date()
            end = datetime.strptime(end_date, "%Y-%m-%d").date()
            count = CalendarHelper.calculate_workdays(start, end)
            return {
                "start_date": start_date,
                "end_date": end_date,
                "workdays": count,
                "total_days": (end - start).days + 1,
            }
        except ValueError:
            return {"error": "日期格式错误，请使用 YYYY-MM-DD 格式"}

    def get_holidays(self, year: int) -> dict[str, Any]:
        """获取指定年份的节假日列表"""
        return {
            "year": year,
            "holidays": {
                name: dates
                for name, dates in CalendarHelper.HOLIDAYS.items()
            },
        }

    # ─── 统计 ───

    def get_event_stats(self, start_date: str, end_date: str) -> dict[str, Any]:
        """获取日期范围内的事件统计"""
        events = self.list_events(start_date=start_date, end_date=end_date)
        total = len(events)

        type_stats: dict[str, int] = {}
        status_stats: dict[str, int] = {}
        dept_stats: dict[str, int] = {}
        priority_stats: dict[str, int] = {}

        for evt in events:
            t = evt.get("event_type", "unknown")
            type_stats[t] = type_stats.get(t, 0) + 1

            s = evt.get("status", "unknown")
            status_stats[s] = status_stats.get(s, 0) + 1

            d = evt.get("department", "unknown")
            dept_stats[d] = dept_stats.get(d, 0) + 1

            p = evt.get("priority", "normal")
            priority_stats[p] = priority_stats.get(p, 0) + 1

        return {
            "period": {"start": start_date, "end": end_date},
            "total_events": total,
            "by_type": type_stats,
            "by_status": status_stats,
            "by_department": dept_stats,
            "by_priority": priority_stats,
        }


# ─── 单例 ───

_service: Optional[CalendarService] = None


def get_calendar_service() -> CalendarService:
    global _service
    if _service is None:
        _service = CalendarService()
    return _service
