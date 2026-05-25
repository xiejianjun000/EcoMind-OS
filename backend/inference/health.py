"""
模型健康检查

对配置的模型端点进行健康探测，返回可用性状态。
支持远程 API 端点检查和本地推理服务检查。
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Optional

import httpx

from inference.model_mapping import TIER_MODEL_MAP, ModelTier

logger = logging.getLogger(__name__)


@dataclass
class HealthCheckResult:
    """单个模型健康检查结果"""
    model_id: str
    healthy: bool
    latency_ms: float = 0.0
    error: str = ""
    details: dict[str, Any] = field(default_factory=dict)


@dataclass
class HealthCheckSummary:
    """健康检查汇总"""
    total_models: int = 0
    healthy_count: int = 0
    unhealthy_count: int = 0
    results: list[HealthCheckResult] = field(default_factory=list)
    checked_at: float = field(default_factory=time.time)


class ModelHealthChecker:
    """
    模型健康检查器

    定期或按需检查模型端点的可用性：
    - 远程 API：GET /v1/models 或 POST /v1/chat/completions (轻量测试)
    - 本地 vLLM/SGLang：检查进程和端口
    """

    def __init__(self, timeout: float = 10.0) -> None:
        self.timeout = timeout
        self._last_results: dict[str, HealthCheckResult] = {}

    async def check_model(self, model_id: str, api_base: str) -> HealthCheckResult:
        """
        检查单个模型端点的健康状态。

        Args:
            model_id: 模型标识
            api_base: API 基础 URL

        Returns:
            健康检查结果
        """
        start_time = time.time()

        if not api_base:
            result = HealthCheckResult(
                model_id=model_id,
                healthy=False,
                error="未配置 API 端点",
            )
            self._last_results[model_id] = result
            return result

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                # 尝试访问 /v1/models 端点
                url = f"{api_base.rstrip('/')}/models"
                response = await client.get(url)

                latency_ms = (time.time() - start_time) * 1000

                if response.status_code == 200:
                    result = HealthCheckResult(
                        model_id=model_id,
                        healthy=True,
                        latency_ms=round(latency_ms, 2),
                    )
                elif response.status_code == 401:
                    # 需要认证但端点可达
                    result = HealthCheckResult(
                        model_id=model_id,
                        healthy=True,
                        latency_ms=round(latency_ms, 2),
                        details={"auth_required": True},
                    )
                else:
                    result = HealthCheckResult(
                        model_id=model_id,
                        healthy=False,
                        latency_ms=round(latency_ms, 2),
                        error=f"HTTP {response.status_code}",
                    )

        except httpx.ConnectError:
            result = HealthCheckResult(
                model_id=model_id,
                healthy=False,
                error="连接失败（服务未启动或端口不可达）",
            )
        except httpx.TimeoutException:
            result = HealthCheckResult(
                model_id=model_id,
                healthy=False,
                error="连接超时",
            )
        except Exception as e:
            result = HealthCheckResult(
                model_id=model_id,
                healthy=False,
                error=str(e),
            )

        self._last_results[model_id] = result
        return result

    async def check_all(self) -> HealthCheckSummary:
        """
        检查所有已配置模型的健康状态。

        并发检查所有模型端点，汇总结果。

        Returns:
            健康检查汇总
        """
        tasks: list[asyncio.Task] = []
        models_to_check: list[tuple[str, str]] = []

        # 收集所有模型
        for tier, models in TIER_MODEL_MAP.items():
            for model in models:
                model_id = model["model_id"]
                api_base = model.get("api_base", "")
                if api_base:
                    models_to_check.append((model_id, api_base))

        # 并发检查
        results = await asyncio.gather(
            *[self.check_model(mid, base) for mid, base in models_to_check],
            return_exceptions=True,
        )

        health_results: list[HealthCheckResult] = []
        for r in results:
            if isinstance(r, HealthCheckResult):
                health_results.append(r)
            else:
                health_results.append(HealthCheckResult(
                    model_id="unknown",
                    healthy=False,
                    error=str(r),
                ))

        healthy_count = sum(1 for r in health_results if r.healthy)

        return HealthCheckSummary(
            total_models=len(health_results),
            healthy_count=healthy_count,
            unhealthy_count=len(health_results) - healthy_count,
            results=health_results,
        )

    async def check_local_inference(self, port: int = 8000) -> HealthCheckResult:
        """
        检查本地推理服务（vLLM/SGLang）的健康状态。

        Args:
            port: 推理服务端口

        Returns:
            健康检查结果
        """
        api_base = f"http://localhost:{port}"
        return await self.check_model(f"local-inference:{port}", api_base)

    def get_last_result(self, model_id: str) -> Optional[HealthCheckResult]:
        """获取上次检查结果。"""
        return self._last_results.get(model_id)

    def get_all_last_results(self) -> dict[str, HealthCheckResult]:
        """获取所有模型的最近检查结果。"""
        return self._last_results.copy()


# 全局单例
_health_checker: Optional[ModelHealthChecker] = None


def get_health_checker() -> ModelHealthChecker:
    """获取 ModelHealthChecker 单例。"""
    global _health_checker
    if _health_checker is None:
        _health_checker = ModelHealthChecker()
    return _health_checker
