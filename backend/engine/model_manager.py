"""
EcoMind 模型管理器 — 多模型路由 + 健康检查 + 自动降级

对标 LangGraph 的 BaseChatModel 抽象层。
支持：模型选择、provider 切换、fallback 降级、健康检查、热加载。
"""
from __future__ import annotations

import asyncio
import logging
import os
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

import yaml

logger = logging.getLogger(__name__)

CONFIG_PATH = Path(__file__).resolve().parent.parent / "config" / "model_config.yaml"


@dataclass
class ModelInfo:
    """单个模型信息"""
    id: str
    name: str
    provider: str
    max_tokens: int = 8192
    temperature: float = 0.7
    supports_tools: bool = True
    supports_streaming: bool = True
    priority: int = 1


@dataclass
class ProviderInfo:
    """Provider 信息"""
    name: str
    base_url: str
    api_key_env: str = ""
    health_url: str = ""


@dataclass
class ModelState:
    """模型运行时状态"""
    model_id: str
    healthy: bool = True
    last_check: float = 0.0
    consecutive_failures: int = 0
    last_error: str = ""


class ModelManager:
    """
    模型管理器 — 单例。

    职责：
    1. 管理可用模型列表
    2. 根据模型 ID 返回正确的 provider/base_url/api_key
    3. 当模型不可用时自动降级到 fallback_chain
    4. 定期健康检查
    5. 配置热加载（监控文件变化）
    """

    _instance: Optional[ModelManager] = None
    _lock = asyncio.Lock()

    def __init__(self):
        self.models: dict[str, ModelInfo] = {}
        self.providers: dict[str, ProviderInfo] = {}
        self.fallback_chain: list[str] = []
        self.default_model: str = "deepseek-chat"
        self.states: dict[str, ModelState] = {}
        self._config_mtime: float = 0.0
        self._health_task: Optional[asyncio.Task] = None
        self._loaded = False

    @classmethod
    async def get_instance(cls) -> ModelManager:
        if cls._instance is None:
            async with cls._lock:
                if cls._instance is None:
                    mgr = ModelManager()
                    await mgr._load_config()
                    cls._instance = mgr
        return cls._instance

    async def _load_config(self) -> None:
        """加载/重载配置"""
        try:
            if CONFIG_PATH.exists():
                with open(CONFIG_PATH, "r") as f:
                    cfg = yaml.safe_load(f)

                # Providers
                self.providers.clear()
                for pid, pinfo in cfg.get("models", {}).get("providers", {}).items():
                    self.providers[pid] = ProviderInfo(
                        name=pinfo.get("name", pid),
                        base_url=pinfo.get("base_url", ""),
                        api_key_env=pinfo.get("api_key_env", ""),
                        health_url=pinfo.get("health_url", ""),
                    )

                # Models
                self.models.clear()
                for m in cfg.get("models", {}).get("available", []):
                    self.models[m["id"]] = ModelInfo(
                        id=m["id"],
                        name=m.get("name", m["id"]),
                        provider=m.get("provider", ""),
                        max_tokens=m.get("max_tokens", 8192),
                        temperature=m.get("temperature", 0.7),
                        supports_tools=m.get("supports_tools", True),
                        supports_streaming=m.get("supports_streaming", True),
                        priority=m.get("priority", 1),
                    )

                self.fallback_chain = cfg.get("models", {}).get("fallback_chain", [])
                self.default_model = cfg.get("models", {}).get("default", "deepseek-chat")

                # Initialize states
                for mid in self.models:
                    if mid not in self.states:
                        self.states[mid] = ModelState(model_id=mid)

                self._config_mtime = CONFIG_PATH.stat().st_mtime if CONFIG_PATH.exists() else 0
                self._loaded = True

                logger.info(f"📡 ModelManager 已加载: {len(self.models)}个模型, "
                           f"默认={self.default_model}, 降级链={self.fallback_chain}")
            else:
                logger.warning(f"模型配置文件不存在: {CONFIG_PATH}，使用内置默认值")
                self._setup_defaults()
        except Exception as e:
            logger.error(f"加载模型配置失败: {e}，使用内置默认值")
            self._setup_defaults()

    def _setup_defaults(self):
        """内置默认配置（DeepSeek直连）"""
        self.providers["deepseek"] = ProviderInfo(
            name="DeepSeek", base_url="https://api.deepseek.com/v1",
            api_key_env="DEEPSEEK_API_KEY", health_url="https://api.deepseek.com/v1/models",
        )
        self.models["deepseek-chat"] = ModelInfo(
            id="deepseek-chat", name="DeepSeek-V3", provider="deepseek",
            max_tokens=8192, supports_tools=True, supports_streaming=True,
        )
        self.fallback_chain = ["deepseek-chat"]
        self.default_model = "deepseek-chat"
        self.states["deepseek-chat"] = ModelState(model_id="deepseek-chat")
        self._loaded = True

    async def _check_reload(self) -> None:
        """检查配置文件是否变更，如有则重载"""
        if CONFIG_PATH.exists():
            mtime = CONFIG_PATH.stat().st_mtime
            if mtime > self._config_mtime:
                logger.info("🔄 检测到模型配置变更，热加载中...")
                await self._load_config()

    def get_model(self, model_id: Optional[str] = None) -> ModelInfo:
        """
        获取模型信息，自动降级。

        返回：(ModelInfo, provider_base_url, api_key)
        """
        target = model_id or self.default_model
        model = self.models.get(target)
        if model:
            return model
        # 降级到 default
        logger.warning(f"模型 '{target}' 未找到，降级到默认模型 '{self.default_model}'")
        return self.models.get(self.default_model)

    def get_fallback_model(self, failed_model_id: str) -> Optional[ModelInfo]:
        """获取降级链中的下一个可用模型"""
        try:
            idx = self.fallback_chain.index(failed_model_id)
        except ValueError:
            idx = -1

        for mid in self.fallback_chain[idx + 1:]:
            model = self.models.get(mid)
            state = self.states.get(mid)
            if model and (state is None or state.healthy):
                logger.warning(f"🔄 降级: {failed_model_id} → {mid}")
                return model
        return None

    def get_provider_config(self, model: ModelInfo) -> tuple[str, str]:
        """返回 (base_url, api_key)"""
        provider = self.providers.get(model.provider)
        if not provider:
            return ("", "")
        api_key = ""
        if provider.api_key_env:
            api_key = os.environ.get(provider.api_key_env, "")
        return (provider.base_url, api_key)

    def mark_failure(self, model_id: str, error: str = "") -> None:
        """标记模型调用失败"""
        state = self.states.get(model_id)
        if not state:
            state = ModelState(model_id=model_id)
            self.states[model_id] = state
        state.consecutive_failures += 1
        state.last_error = error
        if state.consecutive_failures >= 3:
            state.healthy = False
            logger.error(f"❌ 模型 {model_id} 连续失败3次，标记为不健康: {error}")

    def mark_success(self, model_id: str) -> None:
        """标记模型调用成功，恢复健康状态"""
        state = self.states.get(model_id)
        if state:
            state.consecutive_failures = 0
            if not state.healthy:
                state.healthy = True
                logger.info(f"✅ 模型 {model_id} 已恢复健康")

    async def health_check_all(self) -> dict[str, bool]:
        """检查所有模型的健康状态"""
        await self._check_reload()
        results = {}
        for mid, model in self.models.items():
            provider = self.providers.get(model.provider)
            if not provider or not provider.health_url:
                results[mid] = True  # 无法检查，假设健康
                continue

            try:
                import httpx
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.get(provider.health_url)
                    healthy = resp.status_code < 500
                    results[mid] = healthy
                    if healthy:
                        self.mark_success(mid)
                    else:
                        self.mark_failure(mid, f"HTTP {resp.status_code}")
            except Exception as e:
                results[mid] = False
                self.mark_failure(mid, str(e))

        return results

    def get_all_model_ids(self) -> list[str]:
        return list(self.models.keys())

    def is_tool_capable(self, model_id: str) -> bool:
        model = self.models.get(model_id)
        return model.supports_tools if model else False


# 便捷函数
async def get_model_manager() -> ModelManager:
    return await ModelManager.get_instance()
