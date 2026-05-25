"""
Agent Pydantic Schemas — Agent 相关的请求/响应模型定义
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field, ConfigDict


class AgentStatus(str, Enum):
    """Agent 运行状态枚举"""
    RUNNING = "running"
    PAUSED = "paused"
    STOPPED = "stopped"
    ERROR = "error"


class AgentProvider(str, Enum):
    """Agent LLM 提供商枚举"""
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    QWEN = "qwen"
    GLM = "glm"
    KIMI = "kimi"
    DEEPSEEK = "deepseek"
    YI = "yi"


class AgentCreateRequest(BaseModel):
    """创建 Agent 请求体"""
    name: str = Field(..., min_length=1, max_length=128, description="Agent 名称")
    description: str = Field(default="", max_length=512, description="Agent 描述")
    provider: AgentProvider = Field(default=AgentProvider.QWEN, description="LLM 提供商")
    model: str = Field(default="qwen-max", description="模型名称")
    soul: str = Field(default="default", description="Soul 人格标识")
    temperature: float = Field(default=0.7, ge=0.0, le=2.0, description="生成温度")
    max_tokens: int = Field(default=4096, ge=1, le=131072, description="最大 token 数")
    max_iterations: int = Field(default=25, ge=1, le=200, description="最大迭代次数")
    taiji_verify_enabled: bool = Field(default=True, description="是否启用防幻觉验证")
    tools: list[str] = Field(default_factory=list, description="已启用工具列表")
    metadata: dict[str, Any] = Field(default_factory=dict, description="扩展元数据")

    model_config = ConfigDict(json_schema_extra={
        "examples": [
            {
                "name": "政务助手",
                "description": "政务审批流程智能助手",
                "provider": "qwen",
                "model": "qwen-max",
                "soul": "gov-assistant",
                "temperature": 0.7,
                "max_tokens": 4096,
            }
        ]
    })


class AgentUpdateStatusRequest(BaseModel):
    """更新 Agent 状态请求体"""
    status: AgentStatus = Field(..., description="目标状态")


class AgentMessageRequest(BaseModel):
    """向 Agent 发送消息请求体"""
    message: str = Field(..., min_length=1, description="消息内容")
    system_message: Optional[str] = Field(default=None, description="可选的系统消息覆盖")
    stream: bool = Field(default=False, description="是否流式返回")


class AgentResponse(BaseModel):
    """Agent 详情响应"""
    agent_id: str = Field(..., description="Agent 唯一标识")
    name: str = Field(..., description="Agent 名称")
    description: str = Field(default="", description="Agent 描述")
    status: AgentStatus = Field(default=AgentStatus.STOPPED, description="当前状态")
    provider: AgentProvider = Field(default=AgentProvider.QWEN, description="LLM 提供商")
    model: str = Field(default="qwen-max", description="模型名称")
    soul: str = Field(default="default", description="Soul 人格标识")
    temperature: float = Field(default=0.7)
    max_tokens: int = Field(default=4096)
    max_iterations: int = Field(default=25)
    taiji_verify_enabled: bool = Field(default=True)
    tools: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    model_config = ConfigDict(from_attributes=True)


class AgentListResponse(BaseModel):
    """Agent 列表响应"""
    agents: list[AgentResponse] = Field(default_factory=list)
    total: int = Field(default=0)


class AgentMessageResponse(BaseModel):
    """Agent 消息响应"""
    agent_id: str = Field(..., description="Agent 标识")
    message: str = Field(..., description="Agent 回复内容")
    iterations: int = Field(default=0, description="迭代次数")
    tools_used: list[str] = Field(default_factory=list, description="使用的工具列表")
    hallucination_risk: float = Field(default=0.0, ge=0.0, le=1.0, description="幻觉风险")
    status: str = Field(default="completed", description="执行状态")
