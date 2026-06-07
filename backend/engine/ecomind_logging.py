"""
EcoMind 分级日志系统 — 对标 Hermes hermes_logging.py

三级日志：
  agent.log   — 所有 Agent 对话、思考链、工具调用 (INFO+)
  errors.log  — 异常、超时、LLM API 错误、幻觉告警 (WARNING+)
  system.log  — 启动、关闭、健康检查、配置变更 (INFO+)

设计原则：
  - 每个文件自带轮转（RotatingFileHandler），单文件上限 50MB，保留 5 个备份
  - 日志格式统一：[时间] [级别] [模块] 消息
  - 不阻塞主线程（异步写入）
"""
from __future__ import annotations

import logging
import logging.handlers
import os
import sys
from pathlib import Path
from datetime import datetime
from typing import Optional

LOG_DIR = Path(__file__).resolve().parent.parent / "logs"
MAX_BYTES = 50 * 1024 * 1024  # 50MB
BACKUP_COUNT = 5

_FORMAT = logging.Formatter(
    "[%(asctime)s] [%(levelname)-8s] [%(name)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

_initialized = False


def _make_handler(filename: str, level: int) -> logging.Handler:
    os.makedirs(LOG_DIR, exist_ok=True)
    handler = logging.handlers.RotatingFileHandler(
        LOG_DIR / filename,
        maxBytes=MAX_BYTES,
        backupCount=BACKUP_COUNT,
        encoding="utf-8",
    )
    handler.setLevel(level)
    handler.setFormatter(_FORMAT)
    return handler


def init_logging() -> None:
    """初始化 EcoMind 三级日志系统。幂等——多次调用不重复创建。"""
    global _initialized
    if _initialized:
        return

    os.makedirs(LOG_DIR, exist_ok=True)

    root = logging.getLogger()
    root.setLevel(logging.DEBUG)
    root.handlers.clear()

    # 终端始终输出（便于 Docker logs / systemd journal）
    console = logging.StreamHandler(sys.stdout)
    console.setLevel(logging.INFO)
    console.setFormatter(_FORMAT)
    root.addHandler(console)

    # 三级文件日志
    agent_handler = _make_handler("agent.log", logging.INFO)
    agent_handler.addFilter(_AgentFilter())
    root.addHandler(agent_handler)

    errors_handler = _make_handler("errors.log", logging.WARNING)
    root.addHandler(errors_handler)

    system_handler = _make_handler("system.log", logging.INFO)
    system_handler.addFilter(_SystemFilter())
    root.addHandler(system_handler)

    _initialized = True
    logging.getLogger(__name__).info("EcoMind 分级日志系统已启动 | 日志目录: %s", LOG_DIR)


class _AgentFilter(logging.Filter):
    """只允许 agent/engine/chat 相关日志写入 agent.log"""
    _allowed = {"engine", "api.routers.chat", "api.services.agent_service", "agent"}

    def filter(self, record: logging.LogRecord) -> bool:
        return any(record.name.startswith(p) for p in self._allowed)


class _SystemFilter(logging.Filter):
    """系统级日志——排除 agent 噪音"""
    _excluded = {"engine.loop", "api.routers.chat"}

    def filter(self, record: logging.LogRecord) -> bool:
        return not any(record.name.startswith(p) for p in self._excluded)


# ── 便捷 getter ──

def get_logger(name: str) -> logging.Logger:
    """获取 Logger，确保日志系统已初始化"""
    init_logging()
    return logging.getLogger(name)


def get_agent_logger() -> logging.Logger:
    return get_logger("engine.agent")


def get_error_logger() -> logging.Logger:
    return get_logger("engine.errors")


def get_system_logger() -> logging.Logger:
    return get_logger("engine.system")


# ── 日志浏览工具 ──

def tail_log(log_name: str, lines: int = 50) -> str:
    """读取日志最后 N 行"""
    path = LOG_DIR / log_name
    if not path.exists():
        return f"(日志文件 {log_name} 不存在)"
    with open(path, encoding="utf-8") as f:
        all_lines = f.readlines()
    return "".join(all_lines[-lines:])


def grep_log(log_name: str, pattern: str, lines: int = 30) -> str:
    """在日志中搜索匹配行"""
    path = LOG_DIR / log_name
    if not path.exists():
        return f"(日志文件 {log_name} 不存在)"
    import re
    pat = re.compile(pattern, re.IGNORECASE)
    matched = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            if pat.search(line):
                matched.append(line.rstrip())
            if len(matched) >= lines:
                break
    return "\n".join(matched) if matched else "(未找到匹配行)"


def log_stats() -> dict:
    """返回日志统计信息"""
    stats = {}
    for name in ["agent.log", "errors.log", "system.log"]:
        path = LOG_DIR / name
        if path.exists():
            stat = path.stat()
            with open(path, encoding="utf-8") as f:
                line_count = sum(1 for _ in f)
            stats[name] = {
                "size_mb": round(stat.st_size / (1024 * 1024), 2),
                "lines": line_count,
                "modified": datetime.fromtimestamp(stat.st_mtime).isoformat(),
            }
        else:
            stats[name] = None
    return stats
