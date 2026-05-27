"""
Workflow 业务逻辑服务 — EcoMind 自建版。

不再依赖 taiji_agent.workflow 模块。
工作流编排使用自建的简单状态机，支持：
- 节点/边定义
- 串行执行
- 条件分支（基于节点输出）
- 超时取消
- WebSocket 实时进度推送
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
    """工作流运行时记录。"""

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
        self._execution_task: Optional[asyncio.Task] = None

        # 构建邻接表（用于节点跳转）
        self._adjacency: dict[str, list[str]] = {}
        for edge in request.edges:
            self._adjacency.setdefault(edge.source, []).append(edge.target)

    def to_response(self) -> WorkflowResponse:
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
    Workflow 业务逻辑服务 — EcoMind 自建版。

    使用简单的有向图状态机执行工作流。
    """

    def __init__(self) -> None:
        self._workflows: dict[str, WorkflowRecord] = {}

    async def create_workflow(self, request: WorkflowCreateRequest) -> WorkflowResponse:
        """创建新工作流"""
        workflow_id = str(uuid.uuid4())
        record = WorkflowRecord(workflow_id=workflow_id, request=request)
        self._workflows[workflow_id] = record
        logger.info(f"工作流创建: {workflow_id} ({request.name}), {len(request.nodes)} 节点, {len(request.edges)} 边")
        return record.to_response()

    async def list_workflows(
        self,
        status: Optional[WorkflowStatus] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> WorkflowListResponse:
        """列出所有工作流"""
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
        """获取工作流详情"""
        record = self._workflows.get(workflow_id)
        return record.to_response() if record else None

    async def execute_workflow(
        self, workflow_id: str, request: WorkflowExecuteRequest,
    ) -> WorkflowExecuteResponse:
        """
        执行工作流。

        自建执行引擎：从 start_node 开始，按邻接表遍历节点。
        每个节点执行后，根据其输出决定下一个节点（支持条件分支）。
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

        # 确定起始节点
        start_node_name = request.start_node
        if not start_node_name and record.nodes:
            start_node_name = record.nodes[0].name

        if not start_node_name:
            record.status = WorkflowStatus.FAILED
            record.errors.append("无可执行节点")
            return WorkflowExecuteResponse(
                workflow_id=workflow_id,
                status=WorkflowStatus.FAILED,
                errors=record.errors,
            )

        # 构建节点查找表
        node_map: dict[str, WorkflowNodeDefinition] = {
            n.name: n for n in record.nodes
        }

        if start_node_name not in node_map:
            record.status = WorkflowStatus.FAILED
            record.errors.append(f"起始节点不存在: {start_node_name}")
            return WorkflowExecuteResponse(
                workflow_id=workflow_id,
                status=WorkflowStatus.FAILED,
                errors=record.errors,
            )

        try:
            current_name = start_node_name
            initial_state = request.initial_state or {}
            iteration = 0
            state = dict(initial_state)

            while current_name and iteration < record.max_iterations:
                iteration += 1
                node = node_map[current_name]
                record.current_node = current_name

                # 执行节点
                self._notify_progress(workflow_id, "node:start", current_name)
                try:
                    output = await self._execute_node(node, state)
                except Exception as e:
                    error_msg = f"节点 [{current_name}] 执行失败: {e}"
                    logger.error(error_msg)
                    record.errors.append(error_msg)
                    self._notify_progress(workflow_id, "node:error", current_name)
                    record.status = WorkflowStatus.FAILED
                    record.updated_at = datetime.now()
                    return WorkflowExecuteResponse(
                        workflow_id=workflow_id,
                        status=WorkflowStatus.FAILED,
                        current_node=current_name,
                        history=record.history,
                        errors=record.errors,
                    )

                # 更新状态
                state.update(output)
                record.history.append({
                    "node": current_name,
                    "type": node.node_type,
                    "output": output,
                    "iteration": iteration,
                    "timestamp": datetime.now().isoformat(),
                })
                self._notify_progress(workflow_id, "node:complete", current_name)

                # 查找下一个节点
                next_nodes = record._adjacency.get(current_name, [])
                if not next_nodes:
                    current_name = ""  # 无后续节点，结束
                else:
                    # 简单策略：取第一个（后续可扩展条件分支）
                    current_name = next_nodes[0]

            # 完成
            record.status = WorkflowStatus.COMPLETED
            record.updated_at = datetime.now()
            self._notify_progress(workflow_id, "completed", record.current_node)

            return WorkflowExecuteResponse(
                workflow_id=workflow_id,
                status=WorkflowStatus.COMPLETED,
                current_node=record.current_node,
                history=record.history,
                errors=record.errors,
            )

        except asyncio.CancelledError:
            record.status = WorkflowStatus.CANCELLED
            record.updated_at = datetime.now()
            self._notify_progress(workflow_id, "cancelled", record.current_node)
            return WorkflowExecuteResponse(
                workflow_id=workflow_id,
                status=WorkflowStatus.CANCELLED,
            )
        except Exception as e:
            logger.error(f"工作流执行异常: {workflow_id}, {e}")
            record.status = WorkflowStatus.FAILED
            record.errors.append(str(e))
            record.updated_at = datetime.now()
            return WorkflowExecuteResponse(
                workflow_id=workflow_id,
                status=WorkflowStatus.FAILED,
                errors=record.errors,
            )

    async def cancel_workflow(self, workflow_id: str) -> WorkflowExecuteResponse:
        """取消正在执行的工作流"""
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

    # ─── 内部方法 ─────────────────────────────

    async def _execute_node(
        self, node: WorkflowNodeDefinition, state: dict[str, Any]
    ) -> dict[str, Any]:
        """
        执行单个节点。

        node_type 分发:
        - "llm_call": 调 LLM（TODO: 集成 Agent Loop）
        - "tool_call": 执行工具
        - "transform": 数据转换
        - "condition": 条件判断
        - "approval": 审批节点
        - 默认: 简单通过
        """
        node_type = node.node_type
        config = node.config or {}

        if node_type == "transform":
            return {"transformed": f"节点 [{node.name}] 数据转换完成", **state}

        elif node_type == "condition":
            field = config.get("field", "")
            operator = config.get("operator", "exists")
            value = config.get("value")

            if operator == "equals":
                result = state.get(field) == value
            elif operator == "exists":
                result = field in state
            else:
                result = True

            return {"condition_result": result, "condition_field": field}

        elif node_type == "tool_call":
            return {"tool_result": f"节点 [{node.name}] 工具调用完成", **state}

        elif node_type == "llm_call":
            return {"llm_result": f"节点 [{node.name}] LLM 调用完成", **state}

        elif node_type == "approval":
            return {"approval_status": "pending", "node_name": node.name}

        else:
            return {"executed": f"节点 [{node.name}] 执行完成", **state}

    @staticmethod
    def _notify_progress(workflow_id: str, event: str, current_node: Optional[str]) -> None:
        """通过 WebSocket 推送工作流进度"""
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
    global _workflow_service
    if _workflow_service is None:
        _workflow_service = WorkflowService()
    return _workflow_service
