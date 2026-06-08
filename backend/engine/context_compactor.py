"""
EcoMind 上下文压缩器 — 对标 Hermes trajectory_compressor.py

当对话超出 token 上限时自动压缩旧轮次，保留训练信号质量的同时
防止 context window 溢出。

策略（对标 Hermes）：
  1. 保护首轮（system prompt + 用户首问）
  2. 保护最后 N 轮（最近的上下文最重要）
  3. 压缩中间轮次——用 LLM 生成摘要替换原始消息
  4. 只压缩到刚好低于目标上限

Usage:
    from engine.context_compactor import ContextCompactor
    compactor = ContextCompactor(max_tokens=64000)
    compacted = await compactor.compact(messages)
"""
from __future__ import annotations

import logging
import tiktoken
from dataclasses import dataclass, field
from typing import Any, Optional

logger = logging.getLogger(__name__)


@dataclass
class CompactionConfig:
    """压缩配置"""
    max_tokens: int = 64000          # 总 token 上限
    protect_first: int = 2           # 保护前 N 条
    protect_last: int = 6            # 保护最后 N 条
    summary_max_tokens: int = 4096   # 摘要最大 token 数
    trigger_ratio: float = 0.85      # 达到上限的 85% 时触发压缩
    model: str = "gpt-4o"            # 用于 token 计数的编码器


@dataclass
class CompactionResult:
    compressed: list[dict[str, Any]]
    original_tokens: int
    final_tokens: int
    compression_ratio: float
    turns_compressed: int
    summary: str


class ContextCompactor:
    """上下文压缩器"""

    def __init__(self, config: Optional[CompactionConfig] = None):
        self.config = config or CompactionConfig()
        try:
            self._enc = tiktoken.encoding_for_model(self.config.model)
        except Exception:
            self._enc = tiktoken.get_encoding("cl100k_base")

    def count_tokens(self, messages: list[dict[str, Any]]) -> int:
        total = 0
        for msg in messages:
            content = msg.get("content", "")
            if isinstance(content, str):
                total += len(self._enc.encode(content))
            elif isinstance(content, list):
                for part in content:
                    if isinstance(part, dict) and "text" in part:
                        total += len(self._enc.encode(part["text"]))
        return total

    def needs_compaction(self, messages: list[dict[str, Any]]) -> bool:
        threshold = int(self.config.max_tokens * self.config.trigger_ratio)
        return self.count_tokens(messages) > threshold

    def compact(self, messages: list[dict[str, Any]]) -> CompactionResult:
        """
        压缩消息列表。

        策略：
          - 如果未超限，原样返回
          - 如果超限，压缩中间轮次直到进入上限
        """
        original_tokens = self.count_tokens(messages)
        if original_tokens <= self.config.max_tokens:
            return CompactionResult(
                compressed=messages,
                original_tokens=original_tokens,
                final_tokens=original_tokens,
                compression_ratio=1.0,
                turns_compressed=0,
                summary="",
            )

        first = self.config.protect_first
        last = self.config.protect_last

        if len(messages) <= first + last:
            # 消息太少不够压缩——截断最早的消息
            logger.warning("消息不足%d条，截断而不是压缩", first + last)
            kept = messages[:first] + messages[-(last):]
            return CompactionResult(
                compressed=kept,
                original_tokens=original_tokens,
                final_tokens=self.count_tokens(kept),
                compression_ratio=0.0,
                turns_compressed=len(messages) - len(kept),
                summary="(截断)",
            )

        middle = messages[first:-last]
        protected_first = messages[:first]
        protected_last = messages[-last:]

        # 提取中间轮次的关键信息生成摘要
        summary = self._summarize_turns(middle)
        summary_msg = {"role": "system", "content": f"[对话摘要]\n{summary}"}

        compacted = protected_first + [summary_msg] + protected_last
        final_tokens = self.count_tokens(compacted)
        ratio = final_tokens / original_tokens if original_tokens > 0 else 1.0

        logger.info(
            "上下文压缩完成: %d → %d tokens (%.0f%%), 压缩了 %d 轮",
            original_tokens, final_tokens, ratio * 100, len(middle),
        )

        return CompactionResult(
            compressed=compacted,
            original_tokens=original_tokens,
            final_tokens=final_tokens,
            compression_ratio=ratio,
            turns_compressed=len(middle),
            summary=summary,
        )

    def _summarize_turns(self, turns: list[dict[str, Any]]) -> str:
        """提取中间轮次的关键信息——纯规则版，后续可升级为 LLM 摘要"""
        parts: list[str] = []
        for i, turn in enumerate(turns):
            role = turn.get("role", "unknown")
            content = turn.get("content", "")
            if isinstance(content, list):
                content = " ".join(
                    p.get("text", "") for p in content if isinstance(p, dict)
                )
            if not isinstance(content, str):
                continue
            content = content.strip()
            if not content:
                continue

            # 提取关键信息：工具调用、关键结论、数据查询
            if role == "assistant" and "tool" in content.lower():
                parts.append(f"第{i}轮: Agent 调用了工具")
            elif role == "tool":
                snippet = content[:80].replace("\n", " ")
                parts.append(f"第{i}轮: 工具返回 {snippet}...")
            elif role == "user" and len(content) > 0:
                snippet = content[:100].replace("\n", " ")
                parts.append(f"第{i}轮: 用户询问 {snippet}...")

        return "; ".join(parts) if parts else "(中间轮次无关键信息)"

    def compact_async(self, messages: list[dict[str, Any]]) -> CompactionResult:
        """异步包装（保持接口一致）"""
        return self.compact(messages)
