"""
EcoMind 输出验证层 — 自建轻量级验证，替代 TAIJI-VERIFY。

不做重型内容审核，而是做实用性检查：
1. 空响应检测
2. 幻觉风险自评（基于 LLM 输出中的不确定性标记）
3. 基础合规关键词检查
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Optional

logger = logging.getLogger(__name__)


@dataclass
class VerifyResult:
    """验证结果"""
    verify_id: str
    is_passing: bool
    verdict: str                  # "pass" | "warning" | "fail"
    confidence: float             # 0.0 - 1.0
    failure_modes: list[dict] = field(default_factory=list)
    violations: list[str] = field(default_factory=list)
    verified_at: datetime = field(default_factory=datetime.now)
    llm_output_hash: str = ""


class EcoVerifier:
    """
    EcoMind 轻量级输出验证器。

    替代 TAIJI-VERIFY 的重型验证，专注于：
    - 空/无效输出拦截
    - 不确定性标记检测（"可能"/"据称"/"有待核实" 等）
    - 合规敏感词告警
    """

    # 不确定性标记 — 这些词出现时降低置信度
    UNCERTAINTY_MARKERS = [
        "可能", "或许", "大概", "也许", "似乎", "应该", "据称",
        "据传", "据悉", "有待核实", "有待确认", "不确定", "无法确定",
        "probably", "maybe", "perhaps", "might be", "could be",
        "it seems", "reportedly", "allegedly",
    ]

    # 合规敏感词 — 出现时标记违反
    COMPLIANCE_SENSITIVE = [
        "伪造数据", "篡改数据", "偷排", "秘密排放",
        "绕过监管", "行贿", "贿赂",
    ]

    def __init__(self, min_confidence: float = 0.6) -> None:
        self.min_confidence = min_confidence

    def verify(
        self,
        user_input: str,
        llm_output: str,
        _context: Optional[dict[str, Any]] = None,
    ) -> VerifyResult:
        """
        验证 LLM 输出

        Args:
            user_input: 用户原始输入
            llm_output: LLM 生成的输出
            context: 额外上下文（可选）

        Returns:
            VerifyResult: 验证结果
        """
        import hashlib
        import uuid

        verify_id = str(uuid.uuid4())
        output_hash = hashlib.md5(llm_output.encode()).hexdigest()[:8]

        failure_modes: list[dict] = []
        violations: list[str] = []
        confidence = 1.0

        # 1. 空响应检测
        if not llm_output or not llm_output.strip():
            failure_modes.append({
                "mode": "empty_output",
                "severity": "high",
                "detail": "LLM 输出为空",
            })
            confidence = 0.0

        # 2. 过短响应检测（少于 5 个字符）
        elif len(llm_output.strip()) < 5:
            failure_modes.append({
                "mode": "too_short",
                "severity": "medium",
                "detail": f"输出过短: {len(llm_output.strip())} 字符",
            })
            confidence = max(0.0, confidence - 0.5)

        # 3. 不确定性标记检测
        uncertainty_count = 0
        for marker in self.UNCERTAINTY_MARKERS:
            count = len(re.findall(re.escape(marker), llm_output, re.IGNORECASE))
            uncertainty_count += count

        if uncertainty_count > 3:
            failure_modes.append({
                "mode": "high_uncertainty",
                "severity": "medium",
                "detail": f"检测到 {uncertainty_count} 处不确定性标记",
            })
            confidence = max(0.0, confidence - 0.2)
        elif uncertainty_count > 0:
            confidence = max(0.0, confidence - 0.05 * uncertainty_count)

        # 4. 合规敏感词检测
        for word in self.COMPLIANCE_SENSITIVE:
            if word in llm_output:
                violations.append(f"输出包含敏感词: {word}")
                confidence = max(0.0, confidence - 0.5)

        # 5. 幻觉标记检测（"[工具执行失败]" / "[错误]" 等系统错误标记）
        error_patterns = [
            r"\[工具执行失败\]",
            r"\[系统错误\]",
            r"\[错误\]",
            r"\[Error\]",
        ]
        for pattern in error_patterns:
            if re.search(pattern, llm_output):
                failure_modes.append({
                    "mode": "system_error_in_output",
                    "severity": "high",
                    "detail": f"输出包含系统错误标记: {pattern}",
                })
                confidence = max(0.0, confidence - 0.3)

        # 6. 判定
        is_passing = confidence >= self.min_confidence
        if confidence >= 0.9:
            verdict = "pass"
        elif confidence >= self.min_confidence:
            verdict = "warning"
        else:
            verdict = "fail"

        return VerifyResult(
            verify_id=verify_id,
            is_passing=is_passing,
            verdict=verdict,
            confidence=confidence,
            failure_modes=failure_modes,
            violations=violations,
            llm_output_hash=output_hash,
        )


# 全局单例
_verifier: Optional[EcoVerifier] = None


def get_verifier() -> EcoVerifier:
    global _verifier
    if _verifier is None:
        _verifier = EcoVerifier()
    return _verifier
