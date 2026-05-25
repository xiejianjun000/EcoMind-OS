"""
Model Pydantic Schemas — 模型管理相关请求/响应模型定义
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field, ConfigDict


class ModelTier(str, Enum):
    """模型层级映射枚举"""
    OPUS = "opus"
    SONNET = "sonnet"
    HAIKU = "haiku"


class ModelProvider(str, Enum):
    """模型提供商"""
    QWEN = "qwen"
    GLM = "glm"
    DEEPSEEK = "deepseek"
    YI = "yi"
    CHATGLM = "chatglm"
    BAICHUAN = "baichuan"
    MINICPM = "minicpm"
    INTERNLM = "internlm"
    AQUILA = "aquila"
    SKYWORK = "skywork"
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    LOCAL_VLLM = "local_vllm"
    LOCAL_SGLANG = "local_sglang"


class ModelStatus(str, Enum):
    """模型状态"""
    ONLINE = "online"
    OFFLINE = "offline"
    LOADING = "loading"
    ERROR = "error"


class ModelInfo(BaseModel):
    """模型信息"""
    model_id: str = Field(..., description="模型标识")
    model_name: str = Field(..., description="模型显示名称")
    provider: ModelProvider = Field(..., description="提供商")
    tier: Optional[ModelTier] = Field(default=None, description="层级映射")
    status: ModelStatus = Field(default=ModelStatus.ONLINE)
    api_base: str = Field(default="", description="API 基础 URL")
    max_tokens: int = Field(default=4096, description="最大 token 数")
    supports_streaming: bool = Field(default=True, description="是否支持流式")
    supports_tools: bool = Field(default=True, description="是否支持工具调用")
    latency_ms: float = Field(default=0.0, description="平均延迟(ms)")
    cost_per_1k_tokens: float = Field(default=0.0, description="每千 token 成本")
    metadata: dict[str, Any] = Field(default_factory=dict)


class ModelListResponse(BaseModel):
    """模型列表响应"""
    models: list[ModelInfo] = Field(default_factory=list)
    total: int = Field(default=0)


class ModelHealthResponse(BaseModel):
    """模型健康检查响应"""
    healthy: bool = Field(..., description="是否健康")
    models: list[dict[str, Any]] = Field(default_factory=list, description="各模型健康状态")
    checked_at: datetime = Field(default_factory=datetime.now)


class ModelRouteRequest(BaseModel):
    """模型路由请求"""
    tier: ModelTier = Field(..., description="目标层级 (opus/sonnet/haiku)")
    task_type: str = Field(default="chat", description="任务类型: chat/code/analysis")
    prefer_local: bool = Field(default=False, description="优先使用本地模型")
    max_latency_ms: Optional[float] = Field(default=None, description="最大延迟要求(ms)")

    model_config = ConfigDict(json_schema_extra={
        "examples": [
            {
                "tier": "sonnet",
                "task_type": "chat",
                "prefer_local": False,
            }
        ]
    })


class ModelRouteResponse(BaseModel):
    """模型路由响应"""
    routed_model: str = Field(..., description="路由到的模型标识")
    provider: ModelProvider = Field(..., description="提供商")
    tier: ModelTier = Field(..., description="层级")
    api_base: str = Field(default="", description="API 基础 URL")
    reason: str = Field(default="", description="路由原因")
    fallback: Optional[str] = Field(default=None, description="备选模型")


class ModelConfigResponse(BaseModel):
    """模型配置响应"""
    litellm_config_path: str = Field(..., description="LiteLLM 配置文件路径")
    configured_models: list[str] = Field(default_factory=list, description="已配置模型列表")
    router_settings: dict[str, Any] = Field(default_factory=dict)
    general_settings: dict[str, Any] = Field(default_factory=dict)
