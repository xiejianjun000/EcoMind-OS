"""
Agent 业务逻辑服务

封装对 taiji_agent 模块的调用，提供 Agent 生命周期管理、消息交互等功能。
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime
from typing import Any, Optional

from api.schemas.agent import (
    AgentCreateRequest,
    AgentMessageRequest,
    AgentProvider,
    AgentResponse,
    AgentStatus,
    AgentUpdateStatusRequest,
    AgentMessageResponse,
    AgentListResponse,
)

logger = logging.getLogger(__name__)


class AgentRecord:
    """Agent 运行时记录（内存存储）。"""

    def __init__(self, agent_id: str, request: AgentCreateRequest) -> None:
        self.agent_id = agent_id
        self.name = request.name
        self.description = request.description
        self.status = AgentStatus.STOPPED
        self.provider = request.provider
        self.model = request.model
        self.soul = request.soul
        self.temperature = request.temperature
        self.max_tokens = request.max_tokens
        self.max_iterations = request.max_iterations
        self.taiji_verify_enabled = request.taiji_verify_enabled
        self.tools = request.tools
        self.metadata = request.metadata
        self.created_at = datetime.now()
        self.updated_at = datetime.now()
        self._agent_instance: Any = None
        self._lock = asyncio.Lock()

    def to_response(self) -> AgentResponse:
        """转换为 API 响应模型。"""
        return AgentResponse(
            agent_id=self.agent_id,
            name=self.name,
            description=self.description,
            status=self.status,
            provider=self.provider,
            model=self.model,
            soul=self.soul,
            temperature=self.temperature,
            max_tokens=self.max_tokens,
            max_iterations=self.max_iterations,
            taiji_verify_enabled=self.taiji_verify_enabled,
            tools=self.tools,
            metadata=self.metadata,
            created_at=self.created_at,
            updated_at=self.updated_at,
        )


class AgentService:
    """
    Agent 业务逻辑服务

    提供 Agent 的 CRUD、状态管理、消息交互等核心功能。
    内部调用 taiji_agent 模块创建和管理 Agent 实例。
    """

    def __init__(self) -> None:
        self._agents: dict[str, AgentRecord] = {}

    async def create_agent(self, request: AgentCreateRequest) -> AgentResponse:
        """
        创建新 Agent。

        根据 request 中的 provider/model 配置，创建 AgentRecord 并初始化
        taiji_agent.TaijiAgent 实例（延迟加载）。

        Args:
            request: Agent 创建请求

        Returns:
            Agent 详情响应
        """
        agent_id = str(uuid.uuid4())
        record = AgentRecord(agent_id=agent_id, request=request)

        # 尝试初始化 TaijiAgent 实例
        try:
            from taiji_agent.agent.engine import AgentConfig, TaijiAgent

            config = AgentConfig(
                provider=request.provider.value,
                model=request.model,
                soul=request.soul,
                temperature=request.temperature,
                max_tokens=request.max_tokens,
                max_iterations=request.max_iterations,
                taiji_verify_enabled=request.taiji_verify_enabled,
                stream=True,
            )
            agent_instance = TaijiAgent(config=config)
            record._agent_instance = agent_instance
            logger.info(f"Agent 实例初始化成功: {agent_id} ({request.name})")
        except ImportError:
            logger.warning(f"taiji_agent 模块不可用，Agent {agent_id} 将以无后端模式运行")
        except Exception as e:
            logger.error(f"Agent 实例初始化失败: {agent_id}, 错误: {e}")

        self._agents[agent_id] = record
        return record.to_response()

    async def list_agents(
        self,
        status: Optional[AgentStatus] = None,
        provider: Optional[AgentProvider] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> AgentListResponse:
        """
        列出所有 Agent，支持按状态/提供商过滤。

        Args:
            status: 按状态过滤（可选）
            provider: 按提供商过滤（可选）
            limit: 返回数量上限
            offset: 偏移量

        Returns:
            Agent 列表响应
        """
        records = list(self._agents.values())

        if status:
            records = [r for r in records if r.status == status]
        if provider:
            records = [r for r in records if r.provider == provider]

        records.sort(key=lambda r: r.updated_at, reverse=True)
        total = len(records)
        records = records[offset: offset + limit]

        return AgentListResponse(
            agents=[r.to_response() for r in records],
            total=total,
        )

    async def get_agent(self, agent_id: str) -> Optional[AgentResponse]:
        """
        获取指定 Agent 详情。

        Args:
            agent_id: Agent 唯一标识

        Returns:
            Agent 详情，不存在返回 None
        """
        record = self._agents.get(agent_id)
        return record.to_response() if record else None

    async def update_status(
        self,
        agent_id: str,
        request: AgentUpdateStatusRequest,
    ) -> Optional[AgentResponse]:
        """
        更新 Agent 运行状态。

        状态转换规则：
        - STOPPED → RUNNING: 启动 Agent
        - RUNNING → PAUSED: 暂停 Agent
        - PAUSED → RUNNING: 恢复 Agent
        - * → STOPPED: 停止 Agent

        Args:
            agent_id: Agent 标识
            request: 状态更新请求

        Returns:
            更新后的 Agent 详情，不存在返回 None
        """
        record = self._agents.get(agent_id)
        if not record:
            return None

        async with record._lock:
            old_status = record.status
            record.status = request.status
            record.updated_at = datetime.now()

            # 根据新状态执行相应操作
            if request.status == AgentStatus.RUNNING and record._agent_instance:
                logger.info(f"Agent {agent_id} 启动运行")
            elif request.status == AgentStatus.STOPPED and record._agent_instance:
                logger.info(f"Agent {agent_id} 已停止")
            elif request.status == AgentStatus.PAUSED:
                logger.info(f"Agent {agent_id} 已暂停")

        # 通过 WebSocket 推送状态变化
        try:
            from api.main import ws_manager
            ws_manager.enqueue_broadcast("agent:status", {
                "agent_id": agent_id,
                "old_status": old_status.value,
                "new_status": request.status.value,
                "name": record.name,
            })
        except Exception:
            pass

        return record.to_response()

    async def send_message(
        self,
        agent_id: str,
        request: AgentMessageRequest,
    ) -> AgentMessageResponse:
        """
        向 Agent 发送消息并获取回复。

        如果 Agent 实例存在且处于 RUNNING 状态，调用 TaijiAgent.run()；
        否则返回错误信息。

        Args:
            agent_id: Agent 标识
            request: 消息请求

        Returns:
            Agent 消息响应
        """
        record = self._agents.get(agent_id)
        if not record:
            return AgentMessageResponse(
                agent_id=agent_id,
                message="Agent 不存在",
                status="error",
            )

        if record.status == AgentStatus.STOPPED:
            return AgentMessageResponse(
                agent_id=agent_id,
                message="Agent 当前未运行，请先启动 Agent",
                status="error",
            )

        if record._agent_instance is None:
            return AgentMessageResponse(
                agent_id=agent_id,
                message="Agent 后端实例不可用",
                status="error",
            )

        try:
            agent = record._agent_instance
            result = await agent.run(
                task=request.message,
                system_message=request.system_message,
            )

            # 解析 TaskResult
            content = result.content or ""
            if result.error:
                content = f"[执行出错] {result.error}"

            return AgentMessageResponse(
                agent_id=agent_id,
                message=content,
                iterations=result.iterations,
                tools_used=result.tools_used if hasattr(result, "tools_used") else [],
                hallucination_risk=result.hallucination_risk if hasattr(result, "hallucination_risk") else 0.0,
                status=result.status.value if hasattr(result.status, "value") else str(result.status),
            )
        except Exception as e:
            logger.error(f"Agent {agent_id} 消息处理异常: {e}")
            return AgentMessageResponse(
                agent_id=agent_id,
                message=f"处理消息时发生错误: {str(e)}",
                status="error",
            )

    def agent_exists(self, agent_id: str) -> bool:
        """检查 Agent 是否存在。"""
        return agent_id in self._agents


# 全局单例
_agent_service: Optional[AgentService] = None


def get_agent_service() -> AgentService:
    """获取 AgentService 单例（依赖注入用）。"""
    global _agent_service
    if _agent_service is None:
        _agent_service = AgentService()
    return _agent_service
