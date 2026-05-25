"""
/api/agents — Agent CRUD + 状态管理路由
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from api.schemas.agent import (
    AgentCreateRequest,
    AgentListResponse,
    AgentMessageRequest,
    AgentMessageResponse,
    AgentProvider,
    AgentResponse,
    AgentStatus,
    AgentUpdateStatusRequest,
)
from api.services.agent_service import AgentService, get_agent_service

router = APIRouter()


@router.get("/", response_model=AgentListResponse, summary="列出所有 Agent")
async def list_agents(
    status: Optional[AgentStatus] = Query(default=None, description="按状态过滤"),
    provider: Optional[AgentProvider] = Query(default=None, description="按提供商过滤"),
    limit: int = Query(default=100, ge=1, le=500, description="返回数量上限"),
    offset: int = Query(default=0, ge=0, description="偏移量"),
    service: AgentService = Depends(get_agent_service),
) -> AgentListResponse:
    """获取所有 Agent 列表，支持按状态和提供商过滤。"""
    return await service.list_agents(status=status, provider=provider, limit=limit, offset=offset)


@router.post("/", response_model=AgentResponse, status_code=201, summary="创建 Agent")
async def create_agent(
    request: AgentCreateRequest,
    service: AgentService = Depends(get_agent_service),
) -> AgentResponse:
    """创建新的 Agent 实例。根据 provider/model 初始化 TaijiAgent。"""
    return await service.create_agent(request)


@router.get("/{agent_id}", response_model=AgentResponse, summary="获取 Agent 详情")
async def get_agent(
    agent_id: str,
    service: AgentService = Depends(get_agent_service),
) -> AgentResponse:
    """获取指定 Agent 的详细信息和当前状态。"""
    response = await service.get_agent(agent_id)
    if response is None:
        raise HTTPException(status_code=404, detail=f"Agent 不存在: {agent_id}")
    return response


@router.put("/{agent_id}/status", response_model=AgentResponse, summary="更新 Agent 状态")
async def update_agent_status(
    agent_id: str,
    request: AgentUpdateStatusRequest,
    service: AgentService = Depends(get_agent_service),
) -> AgentResponse:
    """
    更新 Agent 运行状态。

    状态转换：running ↔ paused ↔ stopped
    """
    if not service.agent_exists(agent_id):
        raise HTTPException(status_code=404, detail=f"Agent 不存在: {agent_id}")

    response = await service.update_status(agent_id, request)
    if response is None:
        raise HTTPException(status_code=404, detail=f"Agent 不存在: {agent_id}")
    return response


@router.post("/{agent_id}/message", response_model=AgentMessageResponse, summary="发送消息给 Agent")
async def send_message_to_agent(
    agent_id: str,
    request: AgentMessageRequest,
    service: AgentService = Depends(get_agent_service),
) -> AgentMessageResponse:
    """
    向 Agent 发送消息并获取回复。

    Agent 必须处于 running 或 paused 状态才能接收消息。
    """
    if not service.agent_exists(agent_id):
        raise HTTPException(status_code=404, detail=f"Agent 不存在: {agent_id}")

    return await service.send_message(agent_id, request)
