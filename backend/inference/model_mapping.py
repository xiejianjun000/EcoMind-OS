"""
模型路由映射定义

定义 opus/sonnet/haiku 三级路由到国产模型的具体映射关系，
以及各模型的元数据（API 端点、参数、提供商等）。
"""

from __future__ import annotations

from enum import Enum
from typing import Any


class ModelTier(str, Enum):
    """模型层级"""
    OPUS = "opus"
    SONNET = "sonnet"
    HAIKU = "haiku"


class TaskType(str, Enum):
    """任务类型"""
    CHAT = "chat"
    CODE = "code"
    ANALYSIS = "analysis"
    GOV = "gov"


# 模型路由映射：tier → 模型列表（按优先级排序）
TIER_MODEL_MAP: dict[ModelTier, list[dict[str, Any]]] = {
    ModelTier.OPUS: [
        {
            "model_id": "local-deepseek-671b",
            "model_name": "DeepSeek-671B",
            "provider": "local_vllm",
            "api_base": "http://localhost:8000/v1",
            "is_local": True,
            "max_tokens": 8192,
            "supports_tools": True,
        },
        {
            "model_id": "local-qwen3-72b",
            "model_name": "Qwen3-72B",
            "provider": "local_sglang",
            "api_base": "http://localhost:8001/v1",
            "is_local": True,
            "max_tokens": 8192,
            "supports_tools": True,
        },
        {
            "model_id": "qwen-max",
            "model_name": "Qwen Max",
            "provider": "qwen",
            "api_base": "https://dashscope.aliyuncs.com/compatible-mode/v1",
            "is_local": False,
            "max_tokens": 8192,
            "supports_tools": True,
        },
        {
            "model_id": "glm-4",
            "model_name": "GLM-4",
            "provider": "glm",
            "api_base": "https://open.bigmodel.cn/api/paas/v4",
            "is_local": False,
            "max_tokens": 8192,
            "supports_tools": True,
        },
        {
            "model_id": "deepseek-chat",
            "model_name": "DeepSeek Chat",
            "provider": "deepseek",
            "api_base": "https://api.deepseek.com/v1",
            "is_local": False,
            "max_tokens": 8192,
            "supports_tools": True,
        },
        {
            "model_id": "yi-large",
            "model_name": "Yi Large",
            "provider": "yi",
            "api_base": "https://api.lingyiwanwu.com/v1",
            "is_local": False,
            "max_tokens": 8192,
            "supports_tools": True,
        },
    ],
    ModelTier.SONNET: [
        {
            "model_id": "qwen-plus",
            "model_name": "Qwen Plus",
            "provider": "qwen",
            "api_base": "https://dashscope.aliyuncs.com/compatible-mode/v1",
            "is_local": False,
            "max_tokens": 8192,
            "supports_tools": True,
        },
        {
            "model_id": "deepseek-coder",
            "model_name": "DeepSeek Coder",
            "provider": "deepseek",
            "api_base": "https://api.deepseek.com/v1",
            "is_local": False,
            "max_tokens": 8192,
            "supports_tools": True,
        },
        {
            "model_id": "glm-4-flash",
            "model_name": "GLM-4 Flash",
            "provider": "glm",
            "api_base": "https://open.bigmodel.cn/api/paas/v4",
            "is_local": False,
            "max_tokens": 4096,
            "supports_tools": True,
        },
        {
            "model_id": "yi-medium",
            "model_name": "Yi Medium",
            "provider": "yi",
            "api_base": "https://api.lingyiwanwu.com/v1",
            "is_local": False,
            "max_tokens": 4096,
            "supports_tools": True,
        },
        {
            "model_id": "baichuan2-turbo",
            "model_name": "Baichuan2 Turbo",
            "provider": "baichuan",
            "api_base": "https://api.baichuan-ai.com/v1",
            "is_local": False,
            "max_tokens": 4096,
            "supports_tools": False,
        },
        {
            "model_id": "internlm2-20b",
            "model_name": "InternLM2-20B",
            "provider": "internlm",
            "api_base": "http://localhost:8001/v1",
            "is_local": True,
            "max_tokens": 8192,
            "supports_tools": True,
        },
        {
            "model_id": "aquila2-34b",
            "model_name": "Aquila2-34B",
            "provider": "aquila",
            "api_base": "http://localhost:8002/v1",
            "is_local": True,
            "max_tokens": 4096,
            "supports_tools": False,
        },
    ],
    ModelTier.HAIKU: [
        {
            "model_id": "qwen-turbo",
            "model_name": "Qwen Turbo",
            "provider": "qwen",
            "api_base": "https://dashscope.aliyuncs.com/compatible-mode/v1",
            "is_local": False,
            "max_tokens": 8192,
            "supports_tools": True,
        },
        {
            "model_id": "minicpm-4b",
            "model_name": "MiniCPM-4B",
            "provider": "minicpm",
            "api_base": "http://localhost:8000/v1",
            "is_local": True,
            "max_tokens": 4096,
            "supports_tools": False,
        },
        {
            "model_id": "glm-4-flash",
            "model_name": "GLM-4 Flash",
            "provider": "glm",
            "api_base": "https://open.bigmodel.cn/api/paas/v4",
            "is_local": False,
            "max_tokens": 4096,
            "supports_tools": True,
        },
        {
            "model_id": "chatglm-turbo",
            "model_name": "ChatGLM Turbo",
            "provider": "chatglm",
            "api_base": "https://open.bigmodel.cn/api/paas/v4",
            "is_local": False,
            "max_tokens": 4096,
            "supports_tools": False,
        },
        {
            "model_id": "skywork-13b",
            "model_name": "Skywork-13B",
            "provider": "skywork",
            "api_base": "http://localhost:8003/v1",
            "is_local": True,
            "max_tokens": 4096,
            "supports_tools": False,
        },
    ],
}


# 环境变量默认值
ENV_DEFAULTS: dict[str, str] = {
    # 远程 API
    "DASHSCOPE_API_BASE": "https://dashscope.aliyuncs.com/compatible-mode/v1",
    "DASHSCOPE_API_KEY": "sk-placeholder-qwen",
    "GLM_API_BASE": "https://open.bigmodel.cn/api/paas/v4",
    "GLM_API_KEY": "sk-placeholder-glm",
    "DEEPSEEK_API_BASE": "https://api.deepseek.com/v1",
    "DEEPSEEK_API_KEY": "sk-placeholder-deepseek",
    "YI_API_BASE": "https://api.lingyiwanwu.com/v1",
    "YI_API_KEY": "sk-placeholder-yi",
    "BAICHUAN_API_BASE": "https://api.baichuan-ai.com/v1",
    "BAICHUAN_API_KEY": "sk-placeholder-baichuan",
    # 本地推理
    "LOCAL_VLLM_API_BASE": "http://localhost:8000/v1",
    "LOCAL_VLLM_API_KEY": "token-ecomind-vllm",
    "LOCAL_SGLANG_API_BASE": "http://localhost:8001/v1",
    "LOCAL_SGLANG_API_KEY": "token-ecomind-sglang",
    # LiteLLM
    "LITELLM_MASTER_KEY": "sk-ecomind-litellm-local",
}


def get_all_model_ids() -> list[str]:
    """获取所有已注册的模型 ID。"""
    model_ids: list[str] = []
    for models in TIER_MODEL_MAP.values():
        for model in models:
            if model["model_id"] not in model_ids:
                model_ids.append(model["model_id"])
    return model_ids


def get_model_by_id(model_id: str) -> dict[str, Any] | None:
    """根据 model_id 查找模型定义。"""
    for models in TIER_MODEL_MAP.values():
        for model in models:
            if model["model_id"] == model_id:
                return model
    return None
