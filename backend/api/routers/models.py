"""
/api/models — 模型管理 + 健康检查路由
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Query

from api.schemas.model import (
    ModelConfigResponse,
    ModelHealthResponse,
    ModelListResponse,
    ModelProvider,
    ModelRouteRequest,
    ModelRouteResponse,
    ModelTier,
)
from api.services.model_service import ModelService, get_model_service

router = APIRouter()


@router.get("/", response_model=ModelListResponse, summary="列出可用模型")
async def list_models(
    provider: Optional[ModelProvider] = Query(default=None, description="按提供商过滤"),
    tier: Optional[ModelTier] = Query(default=None, description="按层级过滤"),
    service: ModelService = Depends(get_model_service),
) -> ModelListResponse:
    """
    列出所有可用模型。

    包含国产模型（Qwen/GLM/DeepSeek/Yi/ChatGLM/Baichuan/MiniCPM/InternLM/Aquila/Skywork）
    和本地推理模型（vLLM/SGLang）。
    """
    return await service.list_models(provider=provider, tier=tier)


@router.get("/status", response_model=ModelHealthResponse, summary="模型健康检查")
async def check_model_health(
    service: ModelService = Depends(get_model_service),
) -> ModelHealthResponse:
    """
    检查所有模型的健康状态。

    对每个已配置的模型端点发送健康探测，返回在线/离线状态。
    """
    return await service.health_check()


@router.post("/route", response_model=ModelRouteResponse, summary="模型路由")
async def route_model(
    request: ModelRouteRequest,
    service: ModelService = Depends(get_model_service),
) -> ModelRouteResponse:
    """
    模型智能路由。

    根据层级 (opus/sonnet/haiku) 选择最优国产模型：
    - opus → DeepSeek-671B / Qwen3-72B
    - sonnet → Qwen3-14B / GLM-4-9B
    - haiku → Qwen3-4B / MiniCPM-4B

    支持 prefer_local 优先选择本地推理，max_latency_ms 延迟约束。
    """
    return await service.route_model(request)


@router.get("/config", response_model=ModelConfigResponse, summary="获取模型配置")
async def get_model_config(
    service: ModelService = Depends(get_model_service),
) -> ModelConfigResponse:
    """
    获取模型配置信息。

    返回 LiteLLM 配置路径、已配置模型列表、路由策略等。
    """
    return await service.get_config()
