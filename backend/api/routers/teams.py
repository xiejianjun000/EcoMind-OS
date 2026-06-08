"""
/api/teams — 团队协作路由

团队 CRUD + Phase 推进 + 任务管理 + 模板
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from api.schemas.team import (
    PhaseAdvanceRequest,
    TaskCreateRequest,
    TaskListResponse,
    TaskResponse,
    TaskStatus,
    TaskUpdateRequest,
    TeamCreateRequest,
    TeamListResponse,
    TeamResponse,
    TeamStatus,
    TeamTemplateResponse,
    TeamUpdateRequest,
)
from api.services.team_service import TeamService, get_team_service

router = APIRouter()


# ============================================================
# Team CRUD
# ============================================================

@router.get("/", response_model=TeamListResponse, summary="列出所有团队")
async def list_teams(
    status: Optional[TeamStatus] = Query(default=None, description="按状态过滤"),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    service: TeamService = Depends(get_team_service),
) -> TeamListResponse:
    """获取所有团队列表，支持按状态过滤。"""
    return await service.list_teams(status=status, limit=limit, offset=offset)


@router.post("/", response_model=TeamResponse, status_code=201, summary="创建团队")
async def create_team(
    request: TeamCreateRequest,
    service: TeamService = Depends(get_team_service),
) -> TeamResponse:
    """创建新的团队。可基于模板快速创建。"""
    return await service.create_team(request)


@router.get("/templates", response_model=list[TeamTemplateResponse], summary="获取团队模板")
async def list_templates(
    service: TeamService = Depends(get_team_service),
) -> list[TeamTemplateResponse]:
    """获取所有可用的团队模板。"""
    return await service.list_templates()


@router.get("/{team_id}", response_model=TeamResponse, summary="获取团队详情")
async def get_team(
    team_id: str,
    service: TeamService = Depends(get_team_service),
) -> TeamResponse:
    """获取指定团队的详细信息和当前状态。"""
    response = await service.get_team(team_id)
    if response is None:
        raise HTTPException(status_code=404, detail=f"团队不存在: {team_id}")
    return response


@router.put("/{team_id}", response_model=TeamResponse, summary="更新团队")
async def update_team(
    team_id: str,
    request: TeamUpdateRequest,
    service: TeamService = Depends(get_team_service),
) -> TeamResponse:
    """更新团队信息。"""
    if not service.team_exists(team_id):
        raise HTTPException(status_code=404, detail=f"团队不存在: {team_id}")
    response = await service.update_team(team_id, request)
    if response is None:
        raise HTTPException(status_code=404, detail=f"团队不存在: {team_id}")
    return response


@router.delete("/{team_id}", status_code=204, summary="解散团队")
async def delete_team(
    team_id: str,
    service: TeamService = Depends(get_team_service),
) -> None:
    """解散团队（软删除）。"""
    if not service.team_exists(team_id):
        raise HTTPException(status_code=404, detail=f"团队不存在: {team_id}")
    await service.delete_team(team_id)


# ============================================================
# Phase Management
# ============================================================

@router.post("/{team_id}/advance-phase", response_model=TeamResponse, summary="推进 Phase")
async def advance_phase(
    team_id: str,
    request: PhaseAdvanceRequest,
    service: TeamService = Depends(get_team_service),
) -> TeamResponse:
    """推进团队至下一 Phase。"""
    if not service.team_exists(team_id):
        raise HTTPException(status_code=404, detail=f"团队不存在: {team_id}")
    response = await service.advance_phase(team_id, request)
    if response is None:
        raise HTTPException(status_code=404, detail=f"团队不存在: {team_id}")
    return response


# ============================================================
# Task Management
# ============================================================

@router.get("/{team_id}/tasks", response_model=list[TaskResponse], summary="列出团队任务")
async def list_tasks(
    team_id: str,
    status: Optional[TaskStatus] = Query(default=None),
    service: TeamService = Depends(get_team_service),
) -> list[TaskResponse]:
    """获取团队的所有任务。"""
    if not service.team_exists(team_id):
        raise HTTPException(status_code=404, detail=f"团队不存在: {team_id}")
    tasks = await service.list_tasks(team_id)
    if status:
        tasks = [t for t in tasks if t.status == status]
    return tasks


@router.post("/{team_id}/tasks", response_model=TaskResponse, status_code=201, summary="创建团队任务")
async def create_task(
    team_id: str,
    request: TaskCreateRequest,
    service: TeamService = Depends(get_team_service),
) -> TaskResponse:
    """为团队创建新任务。"""
    response = await service.create_task(team_id, request)
    if response is None:
        raise HTTPException(status_code=404, detail=f"团队不存在: {team_id}")
    return response


@router.put("/{team_id}/tasks/{task_id}", response_model=TaskResponse, summary="更新任务")
async def update_task(
    team_id: str,
    task_id: str,
    request: TaskUpdateRequest,
    service: TeamService = Depends(get_team_service),
) -> TaskResponse:
    """更新任务状态、进度等。"""
    if not service.team_exists(team_id):
        raise HTTPException(status_code=404, detail=f"团队不存在: {team_id}")
    response = await service.update_task(task_id, request)
    if response is None:
        raise HTTPException(status_code=404, detail=f"任务不存在: {task_id}")
    return response
