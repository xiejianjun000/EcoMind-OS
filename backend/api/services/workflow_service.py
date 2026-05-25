"""
Workflow 业务逻辑服务

封装对 taiji_agent.workflow 模块的调用，管理工作流的创建、执行、取消等。
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime
from typing import Any, Optional

from api.schemas.workflow import (
    WorkflowCreateRequest,
    WorkflowEdgeDefinition,
    WorkflowExecuteRequest,
    WorkflowExecuteResponse,
    WorkflowListResponse,
    WorkflowNodeDefinition,
    WorkflowResponse,
    WorkflowStatus,
)

logger = logging.getLogger(__name__)


class WorkflowRecord:
    """工作流运行时记录（内存存储）。"""

    def __init__(self, workflow_id: str, request: WorkflowCreateRequest) -> None:
        self.workflow_id = workflow_id
        self.name = request.name
        self.description = request.description
        self.status = WorkflowStatus.PENDING
        self.nodes = request.nodes
        self.edges = request.edges
        self.max_iterations = request.max_iterations
        self.timeout_seconds = request.timeout_seconds
        self.metadata = request.metadata
        self.current_node: Optional[str] = None
        self.history: list[dict[str, Any]] = []
        self.errors: list[str] = []
        self.created_at = datetime.now()
        self.updated_at = datetime.now()
        self._engine_instance: Any = None
        self._execution_task: Optional[asyncio.Task] = None

    def to_response(self) -> WorkflowResponse:
        """转换为 API 响应模型。"""
        return WorkflowResponse(
            workflow_id=self.workflow_id,
            name=self.name,
            description=self.description,
            status=self.status,
            nodes=self.nodes,
            edges=self.edges,
            max_iterations=self.max_iterations,
            timeout_seconds=self.timeout_seconds,
            current_node=self.current_node,
            history=self.history,
            errors=self.errors,
            metadata=self.metadata,
            created_at=self.created_at,
            updated_at=self.updated_at,
        )


class WorkflowService:
    """
    Workflow 业务逻辑服务

    提供工作流的创建、查询、执行、取消等核心功能。
    内部调用 taiji_agent.workflow.WorkflowEngine 管理工作流实例。
    """

    def __init__(self) -> None:
        self._workflows: dict[str, WorkflowRecord] = {}

    async def create_workflow(self, request: WorkflowCreateRequest) -> WorkflowResponse:
        """
        创建新工作流。

        根据节点和边定义，初始化 WorkflowEngine 实例。

        Args:
            request: 工作流创建请求

        Returns:
            工作流详情响应
        """
        workflow_id = str(uuid.uuid4())
        record = WorkflowRecord(workflow_id=workflow_id, request=request)

        # 尝试初始化 WorkflowEngine
        try:
            from taiji_agent.workflow.engine import WorkflowConfig, WorkflowEngine

            config = WorkflowConfig(
                name=request.name,
                max_iterations=request.max_iterations,
                timeout_seconds=request.timeout_seconds,
            )
            engine = WorkflowEngine(config=config)

            # 注册节点
            for node_def in request.nodes:
                engine.add_node(
                    name=node_def.name,
                    func=self._create_node_function(node_def),
                )

            # 注册边
            for edge_def in request.edges:
                if edge_def.condition:
                    # 条件边暂作普通边处理
                    engine.add_edge(source=edge_def.source, target=edge_def.target)
                else:
                    engine.add_edge(source=edge_def.source, target=edge_def.target)

            record._engine_instance = engine
            logger.info(f"工作流引擎初始化成功: {workflow_id} ({request.name})")
        except ImportError:
            logger.warning(f"taiji_agent.workflow 模块不可用，工作流 {workflow_id} 以无后端模式运行")
        except Exception as e:
            logger.error(f"工作流引擎初始化失败: {workflow_id}, 错误: {e}")

        self._workflows[workflow_id] = record
        return record.to_response()

    async def list_workflows(
        self,
        status: Optional[WorkflowStatus] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> WorkflowListResponse:
        """
        列出所有工作流，支持按状态过滤。

        Args:
            status: 按状态过滤（可选）
            limit: 返回数量上限
            offset: 偏移量

        Returns:
            工作流列表响应
        """
        records = list(self._workflows.values())
        if status:
            records = [r for r in records if r.status == status]

        records.sort(key=lambda r: r.updated_at, reverse=True)
        total = len(records)
        records = records[offset: offset + limit]

        return WorkflowListResponse(
            workflows=[r.to_response() for r in records],
            total=total,
        )

    async def get_workflow(self, workflow_id: str) -> Optional[WorkflowResponse]:
        """
        获取指定工作流详情。

        Args:
            workflow_id: 工作流唯一标识

        Returns:
            工作流详情，不存在返回 None
        """
        record = self._workflows.get(workflow_id)
        return record.to_response() if record else None

    async def execute_workflow(
        self,
        workflow_id: str,
        request: WorkflowExecuteRequest,
    ) -> WorkflowExecuteResponse:
        """
        执行工作流。

        如果 WorkflowEngine 实例存在，启动异步执行；
        否则模拟执行流程。

        Args:
            workflow_id: 工作流标识
            request: 执行请求

        Returns:
            执行结果响应
        """
        record = self._workflows.get(workflow_id)
        if not record:
            return WorkflowExecuteResponse(
                workflow_id=workflow_id,
                status=WorkflowStatus.FAILED,
                errors=["工作流不存在"],
            )

        if record.status == WorkflowStatus.RUNNING:
            return WorkflowExecuteResponse(
                workflow_id=workflow_id,
                status=WorkflowStatus.RUNNING,
                errors=["工作流正在执行中"],
            )

        record.status = WorkflowStatus.RUNNING
        record.updated_at = datetime.now()

        # 启动异步执行
        if record._engine_instance:
            try:
                engine = record._engine_instance
                state = await engine.run(
                    initial_state=request.initial_state,
                    start_node=request.start_node,
                )

                record.current_node = state.current_node
                record.history = state.history
                record.errors = state.errors
                record.status = WorkflowStatus.COMPLETED
                record.updated_at = datetime.now()

                # 通过 WebSocket 推送进度
                self._notify_progress(workflow_id, "completed", state.current_node)

            except Exception as e:
                record.status = WorkflowStatus.FAILED
                record.errors.append(str(e))
                record.updated_at = datetime.now()
                logger.error(f"工作流执行失败: {workflow_id}, 错误: {e}")
        else:
            # 无后端模式：模拟执行
            record.current_node = request.start_node or (record.nodes[0].name if record.nodes else None)
            record.history.append({
                "node": record.current_node,
                "action": "simulated_execution",
                "data": request.initial_state,
                "timestamp": datetime.now().isoformat(),
            })
            record.status = WorkflowStatus.COMPLETED
            record.updated_at = datetime.now()

        return WorkflowExecuteResponse(
            workflow_id=workflow_id,
            status=record.status,
            current_node=record.current_node,
            history=record.history,
            errors=record.errors,
        )

    async def cancel_workflow(self, workflow_id: str) -> WorkflowExecuteResponse:
        """
        取消正在执行的工作流。

        Args:
            workflow_id: 工作流标识

        Returns:
            取消后的状态响应
        """
        record = self._workflows.get(workflow_id)
        if not record:
            return WorkflowExecuteResponse(
                workflow_id=workflow_id,
                status=WorkflowStatus.FAILED,
                errors=["工作流不存在"],
            )

        if record.status != WorkflowStatus.RUNNING:
            return WorkflowExecuteResponse(
                workflow_id=workflow_id,
                status=record.status,
                errors=["工作流未在运行中，无法取消"],
            )

        # 取消异步执行任务
        if record._execution_task and not record._execution_task.done():
            record._execution_task.cancel()

        record.status = WorkflowStatus.CANCELLED
        record.updated_at = datetime.now()

        self._notify_progress(workflow_id, "cancelled", record.current_node)

        return WorkflowExecuteResponse(
            workflow_id=workflow_id,
            status=WorkflowStatus.CANCELLED,
            current_node=record.current_node,
        )

    def _create_node_function(self, node_def: WorkflowNodeDefinition) -> Any:
        """
        根据节点定义创建执行函数。

        实际场景中这里会根据 node_type 分发到不同的执行器，
        当前提供基础占位实现。
        """
        async def node_handler(state: Any) -> dict[str, Any]:
            return {
                "node": node_def.name,
                "type": node_def.node_type,
                "config": node_def.config,
                "status": "executed",
            }
        return node_handler

    def _notify_progress(
        self,
        workflow_id: str,
        event: str,
        current_node: Optional[str],
    ) -> None:
        """通过 WebSocket 推送工作流进度。"""
        try:
            from api.main import ws_manager
            ws_manager.enqueue_broadcast("workflow:progress", {
                "workflow_id": workflow_id,
                "event": event,
                "current_node": current_node,
            })
        except Exception:
            pass


# 全局单例
_workflow_service: Optional[WorkflowService] = None


def get_workflow_service() -> WorkflowService:
    """获取 WorkflowService 单例（依赖注入用）。"""
    global _workflow_service
    if _workflow_service is None:
        _workflow_service = WorkflowService()
    return _workflow_service
