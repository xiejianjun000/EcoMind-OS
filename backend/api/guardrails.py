"""
EcoMind OS Guardrails — 边界硬约束引擎

L1/L2/L3 三级权限拦截 + Human-in-the-Loop + 审计日志。

2026-06-07 系统修复：移除5个空壳工具 + 2个未注册工具，诚实化专家能力。
- 移除: case_search, compliance_check, data_analyze, map_visualize, alert_check (全部返回"对接中")
- 移除: query_emission_data, search_regulation (未在TOOL_REGISTRY注册)
- enforcement 能力诚实化：保留实际可用的文件读取+技能+记忆工具
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

logger = logging.getLogger(__name__)


class SafetyLevel(str, Enum):
    L1 = "L1"  # 公众服务：只读公开数据
    L2 = "L2"  # 一般公务：可读写业务数据
    L3 = "L3"  # 执法督察：关键操作须人工确认


@dataclass
class GuardrailResult:
    """边界校验结果"""
    allowed: bool
    reason: str = ""
    require_human_confirm: bool = False
    audit_entry: dict[str, Any] | None = None


# ─── 工具权限矩阵 ─────────────────────────────────────────────
# 🔴 已移除空壳: case_search, compliance_check, data_analyze, map_visualize, alert_check

TOOL_WHITELIST: dict[SafetyLevel, set[str]] = {
    SafetyLevel.L1: {
        "env_query", "regulation_search",
        "knowledge_query", "document_ocr",
        "hunan_policy_search", "hunan_policy_latest", "hunan_policy_detail",
    },
    SafetyLevel.L2: {
        "env_query", "regulation_search",
        "document_parse", "knowledge_query", "skill_execute",
        "dispatch_expert",
        "code_read", "code_edit", "code_write", "git_status", "git_commit",
        "image_analyze", "video_analyze", "voice_transcribe",
        "terminal", "write_file", "patch_file", "read_file", "search_files",
        "web_search", "web_fetch", "send_message",
        "memory_save", "memory_search", "fact_add", "fact_probe", "memory_stats",
        "skill_create", "skill_search", "skill_install",
        "hunan_policy_search", "hunan_policy_latest", "hunan_policy_detail",
        "hunan_policy_crawl",
    },
    SafetyLevel.L3: {
        "env_query", "regulation_search",
        "document_parse", "dispatch_expert", "knowledge_query", "skill_execute",
        "code_read", "code_edit", "code_write",
        "shell_exec", "git_status", "git_commit",
        "image_analyze", "video_analyze", "voice_transcribe",
        "terminal", "write_file", "patch_file", "read_file", "search_files",
        "web_search", "web_fetch", "send_message",
        "memory_save", "memory_search", "fact_add", "fact_probe", "memory_stats",
        "skill_create", "skill_search", "skill_install",
        "hunan_policy_search", "hunan_policy_latest", "hunan_policy_detail",
        "hunan_policy_crawl",
    },
}

L3_HUMAN_CONFIRM_TOOLS: set[str] = {
    "dispatch_expert",
    "document_parse", "code_edit", "code_write", "shell_exec", "git_commit",
}

# ─── 专家工具权限矩阵 ─────────────────────────────────────────
# 🔴 已移除空壳: case_search, compliance_check, data_analyze, map_visualize, alert_check
# 🔴 已移除未注册: query_emission_data, search_regulation

_MULTIMODAL_TOOLS = {"image_analyze", "video_analyze", "voice_transcribe"}  # document_ocr 由 document_parse 内部降级覆盖
_HUNAN_POLICY_TOOLS = {"hunan_policy_search", "hunan_policy_latest", "hunan_policy_detail", "hunan_policy_crawl"}
_HERMES_MEMORY_TOOLS = {"memory_save", "memory_search", "fact_add", "fact_probe", "memory_stats"}
_HERMES_MASTER_TOOLS = {"terminal", "write_file", "patch_file", "read_file", "search_files",
                         "web_search", "web_fetch", "send_message", "skill_create"}
_HERMES_SKILL_TOOLS = {"skill_execute", "skill_search", "skill_install"}

EXPERT_TOOL_MATRIX: dict[str, set[str]] = {
    # 🔑 ecomind 主控：调度 + 技能广场 + 自维护 + 记忆
    "ecomind": {"dispatch_expert", "code_read", "code_edit", "code_write",
                 "git_status", "git_commit"} | _HERMES_SKILL_TOOLS | _MULTIMODAL_TOOLS | _HERMES_MEMORY_TOOLS,

    # 📊 env-monitoring：环境数据 + 报告 + 策略
    "env-monitoring": {"env_query", "regulation_search",
                        "knowledge_query"} | _HERMES_SKILL_TOOLS | _MULTIMODAL_TOOLS | _HUNAN_POLICY_TOOLS | _HERMES_MEMORY_TOOLS,

    # 🔍 enforcement：文件读取 + 技能广场 + 法规查询 + 记忆（已诚实化，document_ocr 由 document_parse 内部降级覆盖）
    "enforcement": {"regulation_search", "knowledge_query",
                    "code_read", "search_files", "document_parse",
                    "image_analyze", "video_analyze", "voice_transcribe"
                    } | _HERMES_SKILL_TOOLS | _HUNAN_POLICY_TOOLS | _HERMES_MEMORY_TOOLS,

    # 📋 eia：法规 + 文档 + 技能
    "eia": {"regulation_search", "document_parse", "knowledge_query",
            } | _HERMES_SKILL_TOOLS | _MULTIMODAL_TOOLS | _HUNAN_POLICY_TOOLS | _HERMES_MEMORY_TOOLS,

    # 📝 permit：法规 + 文档 + 技能
    "permit": {"regulation_search", "document_parse", "knowledge_query",
               } | _HERMES_SKILL_TOOLS | _MULTIMODAL_TOOLS | _HUNAN_POLICY_TOOLS | _HERMES_MEMORY_TOOLS,

    # 🌿 biodiversity：环境数据 + 知识库 + 技能
    "biodiversity": {"env_query", "knowledge_query",
                     } | _HERMES_SKILL_TOOLS | _MULTIMODAL_TOOLS | _HUNAN_POLICY_TOOLS | _HERMES_MEMORY_TOOLS,

    # 🏭 carbon：环境数据 + 知识库 + 报告 + 技能
    "carbon": {"env_query", "regulation_search", "knowledge_query",
               } | _HERMES_SKILL_TOOLS | _MULTIMODAL_TOOLS | _HUNAN_POLICY_TOOLS | _HERMES_MEMORY_TOOLS,

    # 🚨 emergency：环境数据 + 调度 + 报告 + 策略 + 技能
    "emergency": {"env_query", "knowledge_query", "dispatch_expert",
                  } | _HERMES_SKILL_TOOLS | _MULTIMODAL_TOOLS | _HUNAN_POLICY_TOOLS | _HERMES_MEMORY_TOOLS,

    # 🧪 restoration：知识库 + 技能
    "restoration": {"knowledge_query",
                    } | _HERMES_SKILL_TOOLS | _MULTIMODAL_TOOLS | _HUNAN_POLICY_TOOLS | _HERMES_MEMORY_TOOLS,

    # 🔎 inspection：法规 + 技能
    "inspection": {"regulation_search", "knowledge_query",
                   } | _HERMES_SKILL_TOOLS | _MULTIMODAL_TOOLS | _HUNAN_POLICY_TOOLS | _HERMES_MEMORY_TOOLS,

    # 📢 public：环境数据 + 法规 + 知识库 + 策略
    "public": {"env_query", "regulation_search", "knowledge_query",
               "hunan_policy_search", "hunan_policy_latest", "hunan_policy_detail"},

    # 💧 water：环境数据 + 知识库 + 技能
    "water": {"env_query", "knowledge_query",
              } | _HERMES_SKILL_TOOLS | _MULTIMODAL_TOOLS | _HUNAN_POLICY_TOOLS | _HERMES_MEMORY_TOOLS,
}


# ─── 速率限制 ─────────────────────────────────────────────────

@dataclass
class RateLimiter:
    window_seconds: float = 60.0
    max_requests: int = 30
    _requests: list[float] = field(default_factory=list)

    def allow(self) -> bool:
        now = time.time()
        cutoff = now - self.window_seconds
        self._requests = [t for t in self._requests if t > cutoff]
        if len(self._requests) >= self.max_requests:
            return False
        self._requests.append(now)
        return True


RATE_LIMITERS: dict[SafetyLevel, RateLimiter] = {
    SafetyLevel.L1: RateLimiter(max_requests=100),
    SafetyLevel.L2: RateLimiter(max_requests=30),
    SafetyLevel.L3: RateLimiter(max_requests=10),
}


# ─── 审计日志 ─────────────────────────────────────────────────

_audit_log: list[dict[str, Any]] = []


def write_audit_log(entry: dict[str, Any]) -> None:
    entry["timestamp"] = time.time()
    _audit_log.append(entry)
    logger.info(f"[Audit] {entry.get('tool_name')} by {entry.get('expert_id')} "
                f"(L{entry.get('safety_level')}) — {entry.get('result', 'N/A')}")


def get_audit_logs(limit: int = 100) -> list[dict[str, Any]]:
    return _audit_log[-limit:]


# ─── 核心校验函数 ──────────────────────────────────────────────

def check_guardrail(
    expert_id: str,
    tool_name: str,
    tool_params: dict[str, Any],
    safety_level: SafetyLevel = SafetyLevel.L2,
    user_id: str = "anonymous",
) -> GuardrailResult:
    # 1. 工具白名单校验
    allowed_tools = TOOL_WHITELIST.get(safety_level, set())
    if tool_name not in allowed_tools:
        return GuardrailResult(
            allowed=False,
            reason=f"工具 '{tool_name}' 在 {safety_level.value} 级别不允许使用",
        )

    # 2. 专家权限校验
    expert_tools = EXPERT_TOOL_MATRIX.get(expert_id, set())
    if tool_name not in expert_tools:
        return GuardrailResult(
            allowed=False,
            reason=f"专家 '{expert_id}' 无权调用工具 '{tool_name}'",
        )

    # 3. 速率限制
    limiter = RATE_LIMITERS.get(safety_level, RATE_LIMITERS[SafetyLevel.L2])
    if not limiter.allow():
        return GuardrailResult(
            allowed=False,
            reason=f"{safety_level.value} 级别速率限制已达上限",
        )

    # 4. L3 人工确认判定
    require_human = (
        safety_level == SafetyLevel.L3
        and tool_name in L3_HUMAN_CONFIRM_TOOLS
    )

    audit_entry = {
        "user_id": user_id,
        "expert_id": expert_id,
        "safety_level": safety_level.value,
        "tool_name": tool_name,
        "tool_params": tool_params,
        "require_human_confirm": require_human,
    }

    return GuardrailResult(
        allowed=True,
        require_human_confirm=require_human,
        audit_entry=audit_entry,
    )


def confirm_execution(audit_entry: dict[str, Any], result: str) -> None:
    audit_entry["human_confirmed"] = True
    audit_entry["result"] = result
    write_audit_log(audit_entry)


def reject_execution(audit_entry: dict[str, Any]) -> None:
    audit_entry["human_confirmed"] = False
    audit_entry["result"] = "rejected_by_user"
    write_audit_log(audit_entry)
