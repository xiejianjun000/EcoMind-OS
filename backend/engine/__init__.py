"""
EcoMind Engine — 自建 Agent 核心引擎。

不依赖 taiji_agent、Claude Code、LangChain 等任何外部 Agent 框架。

模块:
- loop: Agent 对话循环引擎
- tool_registry: 工具注册与执行
- verify: 输出验证层
- memory: SQLite 本地记忆系统
"""

from .loop import (
    AgentConfig,
    AgentResult,
    AgentRunStatus,
    AgentTier,
    EcoAgentEngine,
    ProgressCallback,
)
from .tool_registry import (
    EcoTool,
    EcoToolRegistry,
    get_tool_registry,
)
from .verify import (
    EcoVerifier,
    VerifyResult,
    get_verifier,
)
from .memory import (
    EcoMemory,
    get_memory,
)

__all__ = [
    # Loop
    "AgentConfig",
    "AgentResult",
    "AgentRunStatus",
    "AgentTier",
    "EcoAgentEngine",
    "ProgressCallback",
    # Tool Registry
    "EcoTool",
    "EcoToolRegistry",
    "get_tool_registry",
    # Verify
    "EcoVerifier",
    "VerifyResult",
    "get_verifier",
    # Memory
    "EcoMemory",
    "get_memory",
]
