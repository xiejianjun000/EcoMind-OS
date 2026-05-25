"""
Workflow Pydantic Schemas — 工作流相关请求/响应模型定义
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field, ConfigDict


class WorkflowStatus(str, Enum):
    """工作流运行状态枚举"""
    PENDING = "pending"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class WorkflowNodeDefinition(BaseModel):
    """工作流节点定义"""
    name: str = Field(..., min_length=1, description="节点名称")
    node_type: str = Field(default="action", description="节点类型: action/decision/subflow")
    config: dict[str, Any] = Field(default_factory=dict, description="节点配置")


class WorkflowEdgeDefinition(BaseModel):
    """工作流边定义"""
    source: str = Field(..., description="源节点名称")
    target: str = Field(..., description="目标节点名称")
    condition: Optional[str] = Field(default=None, description="条件表达式（可选）")


class WorkflowCreateRequest(BaseModel):
    """创建工作流请求体"""
    name: str = Field(..., min_length=1, max_length=128, description="工作流名称")
    description: str = Field(default="", max_length=512, description="工作流描述")
    nodes: list[WorkflowNodeDefinition] = Field(..., min_length=1, description="节点列表")
    edges: list[WorkflowEdgeDefinition] = Field(default_factory=list, description="边列表")
    max_iterations: int = Field(default=100, ge=1, le=1000, description="最大迭代次数")
    timeout_seconds: int = Field(default=3600, ge=10, le=86400, description="超时秒数")
    metadata: dict[str, Any] = Field(default_factory=dict, description="扩展元数据")

    model_config = ConfigDict(json_schema_extra={
        "examples": [
            {
                "name": "政务审批流",
                "description": "三级审批工作流",
                "nodes": [
                    {"name": "submit", "node_type": "action"},
                    {"name": "review", "node_type": "decision"},
                    {"name": "approve", "node_type": "action"},
                ],
                "edges": [
                    {"source": "submit", "target": "review"},
                    {"source": "review", "target": "approve"},
                ],
            }
        ]
    })


class WorkflowExecuteRequest(BaseModel):
    """执行工作流请求体"""
    initial_state: dict[str, Any] = Field(default_factory=dict, description="初始状态数据")
    start_node: Optional[str] = Field(default=None, description="起始节点（默认自动检测）")


class WorkflowResponse(BaseModel):
    """工作流详情响应"""
    workflow_id: str = Field(..., description="工作流唯一标识")
    name: str = Field(..., description="工作流名称")
    description: str = Field(default="", description="工作流描述")
    status: WorkflowStatus = Field(default=WorkflowStatus.PENDING, description="当前状态")
    nodes: list[WorkflowNodeDefinition] = Field(default_factory=list)
    edges: list[WorkflowEdgeDefinition] = Field(default_factory=list)
    max_iterations: int = Field(default=100)
    timeout_seconds: int = Field(default=3600)
    current_node: Optional[str] = Field(default=None, description="当前执行节点")
    history: list[dict[str, Any]] = Field(default_factory=list, description="执行历史")
    errors: list[str] = Field(default_factory=list, description="错误列表")
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    model_config = ConfigDict(from_attributes=True)


class WorkflowListResponse(BaseModel):
    """工作流列表响应"""
    workflows: list[WorkflowResponse] = Field(default_factory=list)
    total: int = Field(default=0)


class WorkflowExecuteResponse(BaseModel):
    """工作流执行结果响应"""
    workflow_id: str = Field(..., description="工作流标识")
    status: WorkflowStatus = Field(..., description="执行后状态")
    current_node: Optional[str] = Field(default=None)
    history: list[dict[str, Any]] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)
