"""
模型路由映射 — opus/sonnet/haiku → 国产模型

根据任务类型、延迟要求、本地优先等策略，将 Claude/GPT 风格的模型请求
路由到对应的国产大模型。
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional

from inference.model_mapping import ModelTier, TIER_MODEL_MAP, TaskType

logger = logging.getLogger(__name__)


@dataclass
class RouteResult:
    """路由结果"""
    model_id: str
    provider: str
    tier: ModelTier
    api_base: str
    reason: str
    fallback: Optional[str] = None
    latency_estimate_ms: float = 0.0


class ModelRouter:
    """
    模型路由器

    路由策略：
    1. 根据 tier 确定候选模型列表
    2. 根据 task_type 调整优先级
    3. 如果 prefer_local=True，优先选择本地推理模型
    4. 如果有延迟要求，过滤超时模型
    5. 选择最优模型，设置备选
    """

    def __init__(self) -> None:
        self._health_status: dict[str, bool] = {}
        self._latency_cache: dict[str, float] = {}

    def update_health(self, model_id: str, healthy: bool) -> None:
        """更新模型健康状态。"""
        self._health_status[model_id] = healthy

    def update_latency(self, model_id: str, latency_ms: float) -> None:
        """更新模型延迟数据。"""
        self._latency_cache[model_id] = latency_ms

    def route(
        self,
        tier: ModelTier,
        task_type: TaskType = TaskType.CHAT,
        prefer_local: bool = False,
        max_latency_ms: Optional[float] = None,
    ) -> RouteResult:
        """
        执行模型路由。

        Args:
            tier: 目标层级 (opus/sonnet/haiku)
            task_type: 任务类型
            prefer_local: 是否优先使用本地模型
            max_latency_ms: 最大延迟要求

        Returns:
            路由结果
        """
        candidates = TIER_MODEL_MAP.get(tier, [])
        if not candidates:
            # 降级到 haiku
            candidates = TIER_MODEL_MAP.get(ModelTier.HAIKU, [])

        # 过滤不健康的模型
        healthy_candidates = [
            m for m in candidates
            if self._health_status.get(m["model_id"], True)
        ]
        if not healthy_candidates:
            healthy_candidates = candidates  # 如果全部不健康，仍然尝试

        # 如果优先本地，调整排序
        if prefer_local:
            healthy_candidates.sort(
                key=lambda m: 0 if m.get("is_local", False) else 1
            )

        # 根据任务类型调整优先级
        healthy_candidates = self._adjust_for_task(healthy_candidates, task_type)

        # 过滤延迟
        if max_latency_ms:
            latency_ok = [
                m for m in healthy_candidates
                if self._latency_cache.get(m["model_id"], 0) <= max_latency_ms
            ]
            if latency_ok:
                healthy_candidates = latency_ok

        # 选择首选和备选
        selected = healthy_candidates[0] if healthy_candidates else candidates[0]
        fallback = healthy_candidates[1]["model_id"] if len(healthy_candidates) > 1 else None

        return RouteResult(
            model_id=selected["model_id"],
            provider=selected["provider"],
            tier=tier,
            api_base=selected.get("api_base", ""),
            reason=self._build_reason(selected, tier, task_type, prefer_local),
            fallback=fallback,
            latency_estimate_ms=self._latency_cache.get(selected["model_id"], 0),
        )

    def _adjust_for_task(
        self,
        candidates: list[dict[str, Any]],
        task_type: TaskType,
    ) -> list[dict[str, Any]]:
        """根据任务类型调整候选模型优先级。"""
        task_preferences: dict[TaskType, list[str]] = {
            TaskType.CODE: ["deepseek-coder", "deepseek-chat", "qwen-plus"],
            TaskType.ANALYSIS: ["qwen-max", "deepseek-chat", "glm-4"],
            TaskType.GOV: ["qwen-max", "glm-4", "local-deepseek-671b"],
            TaskType.CHAT: [],  # 不调整
        }

        preferred = task_preferences.get(task_type, [])
        if not preferred:
            return candidates

        def sort_key(m: dict[str, Any]) -> int:
            mid = m["model_id"]
            if mid in preferred:
                return preferred.index(mid)
            return len(preferred)

        return sorted(candidates, key=sort_key)

    def _build_reason(
        self,
        selected: dict[str, Any],
        tier: ModelTier,
        task_type: TaskType,
        prefer_local: bool,
    ) -> str:
        """构建路由原因描述。"""
        parts = [f"tier={tier.value}"]
        if task_type != TaskType.CHAT:
            parts.append(f"task={task_type.value}")
        if prefer_local and selected.get("is_local"):
            parts.append("local_priority")
        parts.append(f"selected={selected['model_id']}")
        return ", ".join(parts)


# 全局单例
_model_router: Optional[ModelRouter] = None


def get_model_router() -> ModelRouter:
    """获取 ModelRouter 单例。"""
    global _model_router
    if _model_router is None:
        _model_router = ModelRouter()
    return _model_router
