"""
/api/calendar — 日历服务路由

环境监测任务调度 · 会议管理 · 执法排班
对接 calendar_service.py 的 CalendarService 和 CalendarHelper 工作日计算引擎
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from backend.api.services.calendar_service import CalendarService, get_calendar_service

router = APIRouter(prefix="/api/calendar", tags=["Calendar"])


@router.get("/events", summary="查询日历事件")
async def list_events(
    start_date: Optional[str] = Query(default=None, description="起始日期 ISO"),
    end_date: Optional[str] = Query(default=None, description="结束日期 ISO"),
    event_type: Optional[str] = Query(default=None, description="事件类型: task|meeting|enforcement|approval|report"),
    department: Optional[str] = Query(default=None, description="部门"),
    assignee: Optional[str] = Query(default=None, description="负责人"),
    status: Optional[str] = Query(default=None, description="状态: pending|in_progress|completed|cancelled"),
    service: CalendarService = Depends(get_calendar_service),
) -> dict:
    """获取日历事件列表，支持按日期范围/类型/部门/负责人/状态过滤"""
    events = service.list_events(
        start_date=start_date,
        end_date=end_date,
        event_type=event_type,
        department=department,
        assignee=assignee,
        status=status,
    )
    return {"code": 200, "data": events, "total": len(events)}


@router.get("/events/{event_id}", summary="获取事件详情")
async def get_event(
    event_id: str,
    service: CalendarService = Depends(get_calendar_service),
) -> dict:
    """获取单个日历事件详情"""
    evt = service.get_event(event_id)
    if not evt:
        raise HTTPException(status_code=404, detail=f"事件 {event_id} 不存在")
    return {"code": 200, "data": evt}


@router.post("/events", status_code=201, summary="创建事件")
async def create_event(
    data: dict,
    service: CalendarService = Depends(get_calendar_service),
) -> dict:
    """创建日历事件"""
    evt = service.create_event(data)
    return {"code": 201, "data": evt, "message": "事件已创建"}


@router.put("/events/{event_id}", summary="更新事件")
async def update_event(
    event_id: str,
    data: dict,
    service: CalendarService = Depends(get_calendar_service),
) -> dict:
    """更新日历事件"""
    evt = service.update_event(event_id, data)
    if not evt:
        raise HTTPException(status_code=404, detail=f"事件 {event_id} 不存在")
    return {"code": 200, "data": evt, "message": "事件已更新"}


@router.delete("/events/{event_id}", summary="删除事件")
async def delete_event(
    event_id: str,
    service: CalendarService = Depends(get_calendar_service),
) -> dict:
    """删除日历事件"""
    ok = service.delete_event(event_id)
    if not ok:
        raise HTTPException(status_code=404, detail=f"事件 {event_id} 不存在")
    return {"code": 200, "message": "事件已删除"}


@router.get("/workday", summary="判断是否为工作日")
async def check_workday(
    date: str = Query(..., description="日期，格式 YYYY-MM-DD"),
    service: CalendarService = Depends(get_calendar_service),
) -> dict:
    """判断指定日期是否为工作日"""
    result = service.is_workday(date)
    return {"code": 200, "data": result}


@router.get("/workday/add", summary="计算加工作日后的日期")
async def add_workdays(
    start_date: str = Query(..., description="起始日期 YYYY-MM-DD"),
    days: int = Query(..., description="工作日天数"),
    service: CalendarService = Depends(get_calendar_service),
) -> dict:
    """计算从起始日期加上指定工作日后的日期"""
    result = service.add_workdays(start_date, days)
    return {"code": 200, "data": result}


@router.get("/workday/count", summary="计算两个日期之间的工作日数")
async def count_workdays(
    start_date: str = Query(..., description="起始日期 YYYY-MM-DD"),
    end_date: str = Query(..., description="结束日期 YYYY-MM-DD"),
    service: CalendarService = Depends(get_calendar_service),
) -> dict:
    """计算两个日期之间的工作日天数"""
    result = service.calculate_workdays(start_date, end_date)
    return {"code": 200, "data": result}


@router.get("/holidays/{year}", summary="获取指定年份节假日")
async def get_holidays(
    year: int,
    service: CalendarService = Depends(get_calendar_service),
) -> dict:
    """获取指定年份的法定节假日列表"""
    result = service.get_holidays(year)
    return {"code": 200, "data": result}


@router.get("/stats", summary="事件统计")
async def get_stats(
    start_date: str = Query(..., description="起始日期 YYYY-MM-DD"),
    end_date: str = Query(..., description="结束日期 YYYY-MM-DD"),
    service: CalendarService = Depends(get_calendar_service),
) -> dict:
    """获取日期范围内的事件统计（按类型/状态/部门/优先级）"""
    result = service.get_event_stats(start_date, end_date)
    return {"code": 200, "data": result}
