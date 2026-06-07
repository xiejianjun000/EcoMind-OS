"""
EcoMind OS Guardrails — 边界硬约束引擎

L1/L2/L3 三级权限拦截 + Human-in-the-Loop + 审计日志。
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

# 每个安全级别的工具白名单
TOOL_WHITELIST: dict[SafetyLevel, set[str]] = {
    SafetyLevel.L1: {
        "env_query", "regulation_search", "case_search",
        "map_visualize", "alert_check", "data_analyze",
        "knowledge_query", "document_ocr",  # 只读文字提取
        "hunan_policy_search", "hunan_policy_latest", "hunan_policy_detail",
    },
    SafetyLevel.L2: {
        "env_query", "regulation_search", "report_generate",
        "case_search", "map_visualize", "alert_check",
        "document_parse", "compliance_check", "data_analyze",
        "dispatch_expert", "knowledge_query", "skill_execute",
        "code_read", "code_edit", "code_write", "git_status", "git_commit",
        # 多模态分析
        "image_analyze", "video_analyze", "voice_transcribe", "document_ocr",
        # Hermes 级工具
        "terminal", "write_file", "patch_file", "read_file", "search_files",
        "web_search", "web_fetch", "send_message",
        "memory_save", "memory_search", "fact_add", "fact_probe", "memory_stats",
        "skill_create",
        # 湖南政策 MCP
        "hunan_policy_search", "hunan_policy_latest", "hunan_policy_detail",
        "hunan_policy_crawl",
    },
    SafetyLevel.L3: {
        "env_query", "regulation_search", "report_generate",
        "case_search", "map_visualize", "alert_check",
        "document_parse", "compliance_check", "data_analyze",
        "dispatch_expert", "knowledge_query", "skill_execute",
        "code_read", "code_edit", "code_write",
        "shell_exec", "git_status", "git_commit",
        # 多模态分析（全权限）
        "image_analyze", "video_analyze", "voice_transcribe", "document_ocr",
        # Hermes 级工具（全权限）
        "terminal", "write_file", "patch_file", "read_file", "search_files",
        "web_search", "web_fetch", "send_message",
        "memory_save", "memory_search", "fact_add", "fact_probe", "memory_stats",
        "skill_create",
        # 湖南政策 MCP（全权限）
        "hunan_policy_search", "hunan_policy_latest", "hunan_policy_detail",
        "hunan_policy_crawl",
    },
}

# L3 级别需要人工确认的工具
L3_HUMAN_CONFIRM_TOOLS: set[str] = {
    "report_generate",      # 生成执法文书
    "compliance_check",     # 合规结论
    "dispatch_expert",      # 调度专家
    "document_parse",       # 解析敏感文档
    "code_edit",            # 修改代码文件
    "code_write",           # 创建新文件
    "shell_exec",           # 执行shell命令
    "git_commit",           # 提交代码
}

# ─── 专家工具权限矩阵 ─────────────────────────────────────────

# 所有专家共享的基础多模态工具
_MULTIMODAL_TOOLS = {"image_analyze", "video_analyze", "voice_transcribe", "document_ocr"}

# 湖南政策 MCP 工具
_HUNAN_POLICY_TOOLS = {"hunan_policy_search", "hunan_policy_latest", "hunan_policy_detail", "hunan_policy_crawl"}

# Hermes 级工具（主控专用 + 所有专家共享的记忆工具）
_HERMES_MEMORY_TOOLS = {"memory_save", "memory_search", "fact_add", "fact_probe", "memory_stats"}
_HERMES_MASTER_TOOLS = {"terminal", "write_file", "patch_file", "read_file", "search_files",
                         "web_search", "web_fetch", "send_message", "skill_create"}

EXPERT_TOOL_MATRIX: dict[str, set[str]] = {
    "ecomind": {"env_query", "regulation_search", "report_generate", "case_search",
                 "map_visualize", "alert_check", "dispatch_expert", "knowledge_query",
                 "skill_execute", "code_read", "code_edit", "code_write",
                 "shell_exec", "git_status", "git_commit"} | _MULTIMODAL_TOOLS | _HUNAN_POLICY_TOOLS | _HERMES_MEMORY_TOOLS | _HERMES_MEMORY_TOOLS | _HERMES_MASTER_TOOLS,
    "env-monitoring": {"env_query", "report_generate", "map_visualize", "alert_check",
                        "data_analyze", "skill_execute"} | _MULTIMODAL_TOOLS | _HUNAN_POLICY_TOOLS | _HERMES_MEMORY_TOOLS,
    "enforcement": {"regulation_search", "report_generate", "case_search",
                    "document_parse", "compliance_check", "knowledge_query", "skill_execute"} | _MULTIMODAL_TOOLS | _HUNAN_POLICY_TOOLS | _HERMES_MEMORY_TOOLS,
    "eia": {"regulation_search", "report_generate", "document_parse",
            "compliance_check", "knowledge_query", "skill_execute"} | _MULTIMODAL_TOOLS | _HUNAN_POLICY_TOOLS | _HERMES_MEMORY_TOOLS,
    "permit": {"regulation_search", "document_parse", "compliance_check",
               "knowledge_query", "skill_execute"} | _MULTIMODAL_TOOLS | _HUNAN_POLICY_TOOLS | _HERMES_MEMORY_TOOLS,
    "biodiversity": {"env_query", "map_visualize", "knowledge_query", "skill_execute"} | _MULTIMODAL_TOOLS | _HUNAN_POLICY_TOOLS | _HERMES_MEMORY_TOOLS,
    "carbon": {"env_query", "query_emission_data", "report_generate", "data_analyze", "search_regulation", "knowledge_query", "skill_execute"} | _MULTIMODAL_TOOLS | _HUNAN_POLICY_TOOLS | _HERMES_MEMORY_TOOLS,
    "emergency": {"env_query", "report_generate", "map_visualize", "alert_check",
                   "dispatch_expert", "knowledge_query", "skill_execute"} | _MULTIMODAL_TOOLS | _HUNAN_POLICY_TOOLS | _HERMES_MEMORY_TOOLS,
    "restoration": {"report_generate", "case_search", "map_visualize",
                    "knowledge_query", "skill_execute"} | _MULTIMODAL_TOOLS | _HUNAN_POLICY_TOOLS | _HERMES_MEMORY_TOOLS,
    "inspection": {"regulation_search", "report_generate", "case_search",
                   "compliance_check", "knowledge_query", "skill_execute"} | _MULTIMODAL_TOOLS | _HUNAN_POLICY_TOOLS | _HERMES_MEMORY_TOOLS,
    "public": {"env_query", "regulation_search", "knowledge_query", "document_ocr",
               "hunan_policy_search", "hunan_policy_latest", "hunan_policy_detail"},
    "water": {"env_query", "map_visualize", "data_analyze", "knowledge_query", "skill_execute"} | _MULTIMODAL_TOOLS | _HUNAN_POLICY_TOOLS | _HERMES_MEMORY_TOOLS,
}


# ─── 速率限制 ─────────────────────────────────────────────────

@dataclass
class RateLimiter:
    """简易内存速率限制器"""
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


# 每个安全级别的速率限制器
RATE_LIMITERS: dict[SafetyLevel, RateLimiter] = {
    SafetyLevel.L1: RateLimiter(max_requests=100),
    SafetyLevel.L2: RateLimiter(max_requests=30),
    SafetyLevel.L3: RateLimiter(max_requests=10),
}


# ─── 审计日志 ─────────────────────────────────────────────────

_audit_log: list[dict[str, Any]] = []


def write_audit_log(entry: dict[str, Any]) -> None:
    """写入审计日志"""
    entry["timestamp"] = time.time()
    _audit_log.append(entry)
    logger.info(f"[Audit] {entry.get('tool_name')} by {entry.get('expert_id')} "
                f"(L{entry.get('safety_level')}) — {entry.get('result', 'N/A')}")


def get_audit_logs(limit: int = 100) -> list[dict[str, Any]]:
    """获取最近 N 条审计日志"""
    return _audit_log[-limit:]


# ─── 核心校验函数 ──────────────────────────────────────────────

def check_guardrail(
    expert_id: str,
    tool_name: str,
    tool_params: dict[str, Any],
    safety_level: SafetyLevel = SafetyLevel.L2,
    user_id: str = "anonymous",
) -> GuardrailResult:
    """
    对工具调用执行边界校验。

    返回 GuardrailResult，包含是否允许、是否需要人工确认、审计日志条目。
    """
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

    # 5. 构建审计日志
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
    """人工确认后记录审计日志"""
    audit_entry["human_confirmed"] = True
    audit_entry["result"] = result
    write_audit_log(audit_entry)


def reject_execution(audit_entry: dict[str, Any]) -> None:
    """人工拒绝后记录审计日志"""
    audit_entry["human_confirmed"] = False
    audit_entry["result"] = "rejected_by_user"
    write_audit_log(audit_entry)
