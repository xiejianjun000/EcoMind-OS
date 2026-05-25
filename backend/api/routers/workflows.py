"""
/api/workflows — 工作流管理路由
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from api.schemas.workflow import (
    WorkflowCreateRequest,
    WorkflowExecuteRequest,
    WorkflowExecuteResponse,
    WorkflowListResponse,
    WorkflowResponse,
    WorkflowStatus,
)
from api.services.workflow_service import WorkflowService, get_workflow_service

router = APIRouter()


@router.get("/", response_model=WorkflowListResponse, summary="列出所有工作流")
async def list_workflows(
    status: Optional[WorkflowStatus] = Query(default=None, description="按状态过滤"),
    limit: int = Query(default=100, ge=1, le=500, description="返回数量上限"),
    offset: int = Query(default=0, ge=0, description="偏移量"),
    service: WorkflowService = Depends(get_workflow_service),
) -> WorkflowListResponse:
    """获取所有工作流列表，支持按状态过滤。"""
    return await service.list_workflows(status=status, limit=limit, offset=offset)


@router.post("/", response_model=WorkflowResponse, status_code=201, summary="创建工作流")
async def create_workflow(
    request: WorkflowCreateRequest,
    service: WorkflowService = Depends(get_workflow_service),
) -> WorkflowResponse:
    """
    创建新工作流。

    需要定义节点和边，内部会初始化 WorkflowEngine 实例。
    """
    return await service.create_workflow(request)


@router.get("/{workflow_id}", response_model=WorkflowResponse, summary="获取工作流详情")
async def get_workflow(
    workflow_id: str,
    service: WorkflowService = Depends(get_workflow_service),
) -> WorkflowResponse:
    """获取指定工作流的详细信息和执行状态。"""
    response = await service.get_workflow(workflow_id)
    if response is None:
        raise HTTPException(status_code=404, detail=f"工作流不存在: {workflow_id}")
    return response


@router.post("/{workflow_id}/execute", response_model=WorkflowExecuteResponse, summary="执行工作流")
async def execute_workflow(
    workflow_id: str,
    request: WorkflowExecuteRequest,
    service: WorkflowService = Depends(get_workflow_service),
) -> WorkflowExecuteResponse:
    """
    启动工作流执行。

    工作流必须处于 pending 或 completed 状态才能执行。
    执行过程中可通过 WebSocket 订阅 workflow:progress 主题获取实时进度。
    """
    response = await service.get_workflow(workflow_id)
    if response is None:
        raise HTTPException(status_code=404, detail=f"工作流不存在: {workflow_id}")

    return await service.execute_workflow(workflow_id, request)


@router.post("/{workflow_id}/cancel", response_model=WorkflowExecuteResponse, summary="取消工作流")
async def cancel_workflow(
    workflow_id: str,
    service: WorkflowService = Depends(get_workflow_service),
) -> WorkflowExecuteResponse:
    """
    取消正在执行的工作流。

    工作流必须处于 running 状态才能取消。
    """
    response = await service.get_workflow(workflow_id)
    if response is None:
        raise HTTPException(status_code=404, detail=f"工作流不存在: {workflow_id}")

    return await service.cancel_workflow(workflow_id)
