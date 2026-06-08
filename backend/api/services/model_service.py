"""
Model 业务逻辑服务

提供模型列表、健康检查、模型路由、配置查询等功能。
集成 LiteLLM 和本地推理配置。
"""

from __future__ import annotations

import asyncio
import logging
import time
from pathlib import Path
from typing import Any, Optional

from api.schemas.model import (
    ModelConfigResponse,
    ModelHealthResponse,
    ModelInfo,
    ModelListResponse,
    ModelProvider,
    ModelRouteRequest,
    ModelRouteResponse,
    ModelStatus,
    ModelTier,
)

try:
    from inference.router import ModelRouter as InferenceRouter
    _inference_available = True
except Exception:
    _inference_available = False

logger = logging.getLogger(__name__)


# 模型注册表 — 预配置的国产模型列表
_DEFAULT_MODELS: list[dict[str, Any]] = [
    # Qwen 系列
    {
        "model_id": "qwen-max",
        "model_name": "Qwen Max",
        "provider": ModelProvider.QWEN,
        "tier": ModelTier.OPUS,
        "api_base": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "max_tokens": 8192,
        "cost_per_1k_tokens": 0.04,
    },
    {
        "model_id": "qwen-plus",
        "model_name": "Qwen Plus",
        "provider": ModelProvider.QWEN,
        "tier": ModelTier.SONNET,
        "api_base": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "max_tokens": 8192,
        "cost_per_1k_tokens": 0.016,
    },
    {
        "model_id": "qwen-turbo",
        "model_name": "Qwen Turbo",
        "provider": ModelProvider.QWEN,
        "tier": ModelTier.HAIKU,
        "api_base": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "max_tokens": 8192,
        "cost_per_1k_tokens": 0.004,
    },
    # GLM 系列
    {
        "model_id": "glm-4",
        "model_name": "GLM-4",
        "provider": ModelProvider.GLM,
        "tier": ModelTier.OPUS,
        "api_base": "https://open.bigmodel.cn/api/paas/v4",
        "max_tokens": 8192,
        "cost_per_1k_tokens": 0.1,
    },
    {
        "model_id": "glm-4-flash",
        "model_name": "GLM-4 Flash",
        "provider": ModelProvider.GLM,
        "tier": ModelTier.HAIKU,
        "api_base": "https://open.bigmodel.cn/api/paas/v4",
        "max_tokens": 4096,
        "cost_per_1k_tokens": 0.01,
    },
    # DeepSeek 系列
    {
        "model_id": "deepseek-chat",
        "model_name": "DeepSeek Chat",
        "provider": ModelProvider.DEEPSEEK,
        "tier": ModelTier.OPUS,
        "api_base": "https://api.deepseek.com/v1",
        "max_tokens": 8192,
        "cost_per_1k_tokens": 0.014,
    },
    {
        "model_id": "deepseek-coder",
        "model_name": "DeepSeek Coder",
        "provider": ModelProvider.DEEPSEEK,
        "tier": ModelTier.SONNET,
        "api_base": "https://api.deepseek.com/v1",
        "max_tokens": 8192,
        "cost_per_1k_tokens": 0.014,
    },
    # Yi 系列
    {
        "model_id": "yi-large",
        "model_name": "Yi Large",
        "provider": ModelProvider.YI,
        "tier": ModelTier.OPUS,
        "api_base": "https://api.lingyiwanwu.com/v1",
        "max_tokens": 8192,
        "cost_per_1k_tokens": 0.06,
    },
    {
        "model_id": "yi-medium",
        "model_name": "Yi Medium",
        "provider": ModelProvider.YI,
        "tier": ModelTier.SONNET,
        "api_base": "https://api.lingyiwanwu.com/v1",
        "max_tokens": 4096,
        "cost_per_1k_tokens": 0.012,
    },
    # 其他国产模型
    {
        "model_id": "chatglm-turbo",
        "model_name": "ChatGLM Turbo",
        "provider": ModelProvider.CHATGLM,
        "tier": ModelTier.HAIKU,
        "api_base": "https://open.bigmodel.cn/api/paas/v4",
        "max_tokens": 4096,
        "cost_per_1k_tokens": 0.005,
    },
    {
        "model_id": "baichuan2-turbo",
        "model_name": "Baichuan2 Turbo",
        "provider": ModelProvider.BAICHUAN,
        "tier": ModelTier.SONNET,
        "api_base": "https://api.baichuan-ai.com/v1",
        "max_tokens": 4096,
        "cost_per_1k_tokens": 0.008,
    },
    {
        "model_id": "minicpm-4b",
        "model_name": "MiniCPM-4B",
        "provider": ModelProvider.MINICPM,
        "tier": ModelTier.HAIKU,
        "api_base": "http://localhost:8000/v1",
        "max_tokens": 4096,
        "cost_per_1k_tokens": 0.0,
        "supports_streaming": True,
    },
    {
        "model_id": "internlm2-20b",
        "model_name": "InternLM2-20B",
        "provider": ModelProvider.INTERNLM,
        "tier": ModelTier.SONNET,
        "api_base": "http://localhost:8001/v1",
        "max_tokens": 8192,
        "cost_per_1k_tokens": 0.0,
    },
    {
        "model_id": "aquila2-34b",
        "model_name": "Aquila2-34B",
        "provider": ModelProvider.AQUILA,
        "tier": ModelTier.SONNET,
        "api_base": "http://localhost:8002/v1",
        "max_tokens": 4096,
        "cost_per_1k_tokens": 0.0,
    },
    {
        "model_id": "skywork-13b",
        "model_name": "Skywork-13B",
        "provider": ModelProvider.SKYWORK,
        "tier": ModelTier.HAIKU,
        "api_base": "http://localhost:8003/v1",
        "max_tokens": 4096,
        "cost_per_1k_tokens": 0.0,
    },
    # 本地推理模型
    {
        "model_id": "local-deepseek-671b",
        "model_name": "DeepSeek-671B (Local vLLM)",
        "provider": ModelProvider.LOCAL_VLLM,
        "tier": ModelTier.OPUS,
        "api_base": "http://localhost:8000/v1",
        "max_tokens": 8192,
        "cost_per_1k_tokens": 0.0,
    },
    {
        "model_id": "local-qwen3-72b",
        "model_name": "Qwen3-72B (Local SGLang)",
        "provider": ModelProvider.LOCAL_SGLANG,
        "tier": ModelTier.OPUS,
        "api_base": "http://localhost:8001/v1",
        "max_tokens": 8192,
        "cost_per_1k_tokens": 0.0,
    },
]

# 模型路由映射 — tier → 优先模型列表
_TIER_ROUTING: dict[ModelTier, list[str]] = {
    ModelTier.OPUS: ["local-deepseek-671b", "local-qwen3-72b", "qwen-max", "glm-4", "deepseek-chat", "yi-large"],
    ModelTier.SONNET: ["qwen-plus", "deepseek-coder", "glm-4-flash", "yi-medium", "baichuan2-turbo", "internlm2-20b"],
    ModelTier.HAIKU: ["qwen-turbo", "glm-4-flash", "minicpm-4b", "chatglm-turbo", "skywork-13b"],
}


class ModelService:
    """
    Model 业务逻辑服务

    提供模型列表、健康检查、智能路由、配置查询。
    """

    def __init__(self) -> None:
        self._models: dict[str, ModelInfo] = {}
        self._latency_cache: dict[str, float] = {}
        self._init_models()

    def _init_models(self) -> None:
        """初始化模型注册表。"""
        for model_data in _DEFAULT_MODELS:
            model_id = model_data["model_id"]
            self._models[model_id] = ModelInfo(
                model_id=model_id,
                model_name=model_data["model_name"],
                provider=model_data["provider"],
                tier=model_data.get("tier"),
                status=ModelStatus.ONLINE,
                api_base=model_data.get("api_base", ""),
                max_tokens=model_data.get("max_tokens", 4096),
                supports_streaming=model_data.get("supports_streaming", True),
                supports_tools=model_data.get("supports_tools", True),
                cost_per_1k_tokens=model_data.get("cost_per_1k_tokens", 0.0),
            )
        logger.info(f"已注册 {len(self._models)} 个模型")

    async def list_models(
        self,
        provider: Optional[ModelProvider] = None,
        tier: Optional[ModelTier] = None,
    ) -> ModelListResponse:
        """
        列出可用模型。

        Args:
            provider: 按提供商过滤
            tier: 按层级过滤

        Returns:
            模型列表响应
        """
        models = list(self._models.values())
        if provider:
            models = [m for m in models if m.provider == provider]
        if tier:
            models = [m for m in models if m.tier == tier]

        return ModelListResponse(models=models, total=len(models))

    async def health_check(self) -> ModelHealthResponse:
        """
        模型健康检查。

        对每个已配置的模型端点发送轻量级健康探测，
        返回各模型的可用状态。

        Returns:
            健康检查响应
        """
        model_statuses: list[dict[str, Any]] = []
        healthy_count = 0

        for model_id, model in self._models.items():
            is_healthy = await self._check_model_health(model)
            status_str = "online" if is_healthy else "offline"

            if is_healthy:
                healthy_count += 1

            model_statuses.append({
                "model_id": model_id,
                "model_name": model.model_name,
                "provider": model.provider.value,
                "status": status_str,
            })

        all_healthy = healthy_count > 0
        return ModelHealthResponse(
            healthy=all_healthy,
            models=model_statuses,
        )

    async def route_model(self, request: ModelRouteRequest) -> ModelRouteResponse:
        """模型智能路由 — 优先使用 inference/ 引擎，回退到内置路由。"""
        # 尝试 inference/ 引擎路由
        if _inference_available and request.tier:
            try:
                router = InferenceRouter()
                result = router.route(tier=request.tier.value if hasattr(request.tier, 'value') else str(request.tier))
                if result and result.model_id:
                    return ModelRouteResponse(
                        routed_model=result.model_id,
                        provider=result.provider,
                        tier=request.tier,
                        api_base=getattr(result, 'api_base', ''),
                        reason=f"推理引擎路由: {result.reason}",
                        fallback=getattr(result, 'fallback', None),
                    )
            except Exception as e:
                logger.warning(f"Inference router failed, using built-in: {e}")

        tier_models = _TIER_ROUTING.get(request.tier, [])
        if not tier_models:
            return ModelRouteResponse(
                routed_model="qwen-turbo",
                provider=ModelProvider.QWEN,
                tier=request.tier,
                reason="无可路由模型，使用默认降级",
                fallback=None,
            )

        selected_model_id: Optional[str] = None
        fallback_model_id: Optional[str] = None
        reason = ""

        # 如果优先本地
        if request.prefer_local:
            for mid in tier_models:
                model = self._models.get(mid)
                if model and model.provider in (ModelProvider.LOCAL_VLLM, ModelProvider.LOCAL_SGLANG):
                    if model.status == ModelStatus.ONLINE:
                        selected_model_id = mid
                        reason = f"本地优先：选择 {model.model_name}"
                        break
                    else:
                        fallback_model_id = mid

        # 从路由列表中选择
        if not selected_model_id:
            for mid in tier_models:
                model = self._models.get(mid)
                if model and model.status == ModelStatus.ONLINE:
                    # 检查延迟要求
                    if request.max_latency_ms and model.latency_ms > request.max_latency_ms:
                        if not fallback_model_id:
                            fallback_model_id = mid
                        continue
                    selected_model_id = mid
                    reason = f"智能路由：tier={request.tier.value}, 选择 {model.model_name}"
                    break

        # 降级到第一个可用模型
        if not selected_model_id:
            selected_model_id = tier_models[0]
            reason = f"降级路由：使用 {selected_model_id}"

        model = self._models.get(selected_model_id, self._models.get("qwen-turbo"))
        if not model:
            model = list(self._models.values())[0]

        return ModelRouteResponse(
            routed_model=model.model_id,
            provider=model.provider,
            tier=request.tier,
            api_base=model.api_base,
            reason=reason,
            fallback=fallback_model_id,
        )

    async def get_config(self) -> ModelConfigResponse:
        """
        获取模型配置信息。

        读取 LiteLLM config.yaml 路径和当前配置摘要。

        Returns:
            模型配置响应
        """
        config_path = str(Path(__file__).parent.parent.parent / "inference" / "config.yaml")
        configured_models = list(self._models.keys())

        router_settings = {
            "routing_strategy": "usage-based-routing-v2",
            "allowed_fails": 3,
            "cooldown_time": 60,
        }
        general_settings = {
            "master_key": "os.environ/LITELLM_MASTER_KEY",
            "database_url": "sqlite:///./litellm_proxy.db",
        }

        return ModelConfigResponse(
            litellm_config_path=config_path,
            configured_models=configured_models,
            router_settings=router_settings,
            general_settings=general_settings,
        )

    async def _check_model_health(self, model: ModelInfo) -> bool:
        """检查单个模型端点的健康状态。"""
        if not model.api_base:
            return False

        try:
            import os

            provider = model.provider
            if hasattr(provider, 'value'):
                provider = provider.value

            _api_key_env_map = {
                "qwen": "DASHSCOPE_API_KEY",
                "glm": "ZHIPUAI_API_KEY",
                "deepseek": "DEEPSEEK_API_KEY",
                "yi": "YI_API_KEY",
                "chatglm": "ZHIPUAI_API_KEY",
                "baichuan": "BAICHUAN_API_KEY",
                "minicpm": "OPENAI_API_KEY",
                "internlm": "INTERNLM_API_KEY",
                "aquila": "AQUILA_API_KEY",
                "skywork": "SKYWORK_API_KEY",
                "stepfun": "STEPFUN_API_KEY",
            }

            if provider in _api_key_env_map:
                env_key = _api_key_env_map[provider]
                return bool(os.environ.get(env_key, ""))

            if provider in ("local_vllm", "local_sglang"):
                import httpx
                try:
                    async with httpx.AsyncClient(timeout=3.0) as client:
                        response = await client.get(f"{model.api_base}/health")
                        return response.status_code < 500
                except Exception:
                    return False

            import httpx
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{model.api_base}/models")
                return response.status_code < 500
        except Exception:
            return False


# 全局单例
_model_service: Optional[ModelService] = None


def get_model_service() -> ModelService:
    """获取 ModelService 单例（依赖注入用）。"""
    global _model_service
    if _model_service is None:
        _model_service = ModelService()
    return _model_service
