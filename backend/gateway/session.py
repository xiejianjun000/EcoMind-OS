"""
EcoMind 消息网关 — 会话管理

对标 Hermes gateway/session.py

跨平台统一会话：
  - 每个 (platform, user_id) → 一个会话
  - 会话超时自动清理
  - 会话上下文持久化到 SQLite
"""
from __future__ import annotations

import json
import logging
import sqlite3
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from gateway.base import Message, Platform

logger = logging.getLogger(__name__)

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "gateway_sessions.db"


def _get_conn() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def _init():
    conn = _get_conn()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS gateway_sessions (
            session_id TEXT PRIMARY KEY,
            platform TEXT NOT NULL,
            user_id TEXT NOT NULL,
            chat_id TEXT NOT NULL DEFAULT '',
            display_name TEXT DEFAULT '',
            metadata TEXT DEFAULT '{}',
            message_count INTEGER DEFAULT 0,
            created_at REAL NOT NULL,
            last_active_at REAL NOT NULL,
            closed INTEGER DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS gateway_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            tool_calls TEXT DEFAULT '[]',
            timestamp REAL NOT NULL,
            FOREIGN KEY (session_id) REFERENCES gateway_sessions(session_id)
        );
        CREATE INDEX IF NOT EXISTS idx_gw_sessions_user ON gateway_sessions(platform, user_id);
        CREATE INDEX IF NOT EXISTS idx_gw_sessions_active ON gateway_sessions(last_active_at);
        CREATE INDEX IF NOT EXISTS idx_gw_messages_session ON gateway_messages(session_id);
    """)
    conn.commit()
    conn.close()


_init()


@dataclass
class GatewaySession:
    session_id: str
    platform: str
    user_id: str
    chat_id: str
    display_name: str
    metadata: dict[str, Any]
    message_count: int
    created_at: float
    last_active_at: float
    closed: bool = False


class GatewaySessionManager:
    """网关会话管理器"""

    def __init__(self, session_timeout: int = 3600):
        self._timeout = session_timeout

    def get_or_create(self, message: Message) -> GatewaySession:
        """根据消息获取或创建会话"""
        conn = _get_conn()
        try:
            sid = self._make_session_id(message.source)
            row = conn.execute(
                "SELECT * FROM gateway_sessions WHERE session_id = ? AND closed = 0",
                (sid,),
            ).fetchone()

            now = time.time()
            if row:
                conn.execute(
                    "UPDATE gateway_sessions SET last_active_at = ?, message_count = message_count + 1 WHERE session_id = ?",
                    (now, sid),
                )
                conn.commit()
                return GatewaySession(
                    session_id=row["session_id"],
                    platform=row["platform"],
                    user_id=row["user_id"],
                    chat_id=row["chat_id"],
                    display_name=row["display_name"] or "",
                    metadata=json.loads(row["metadata"]) if row["metadata"] else {},
                    message_count=row["message_count"] + 1,
                    created_at=row["created_at"],
                    last_active_at=now,
                )

            conn.execute(
                """INSERT INTO gateway_sessions
                   (session_id, platform, user_id, chat_id, display_name, metadata, message_count, created_at, last_active_at)
                   VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)""",
                (
                    sid, message.source.platform.value, message.source.user_id,
                    message.source.chat_id, message.source.display_name,
                    json.dumps(message.source.metadata), now, now,
                ),
            )
            conn.commit()
            return GatewaySession(
                session_id=sid, platform=message.source.platform.value,
                user_id=message.source.user_id, chat_id=message.source.chat_id,
                display_name=message.source.display_name,
                metadata=message.source.metadata, message_count=1,
                created_at=now, last_active_at=now,
            )
        finally:
            conn.close()

    def add_history(self, session_id: str, role: str, content: str) -> None:
        """添加一条会话历史"""
        conn = _get_conn()
        try:
            conn.execute(
                "INSERT INTO gateway_messages (session_id, role, content, timestamp) VALUES (?, ?, ?, ?)",
                (session_id, role, content, time.time()),
            )
            conn.commit()
        finally:
            conn.close()

    def get_history(self, session_id: str, limit: int = 50) -> list[dict]:
        """获取会话历史"""
        conn = _get_conn()
        try:
            rows = conn.execute(
                "SELECT role, content, timestamp FROM gateway_messages WHERE session_id = ? ORDER BY id DESC LIMIT ?",
                (session_id, limit),
            ).fetchall()
            return [{"role": r["role"], "content": r["content"]} for r in reversed(rows)]
        finally:
            conn.close()

    def end_session(self, session_id: str) -> None:
        """结束会话"""
        conn = _get_conn()
        try:
            conn.execute(
                "UPDATE gateway_sessions SET closed = 1 WHERE session_id = ?",
                (session_id,),
            )
            conn.commit()
        finally:
            conn.close()

    def cleanup_expired(self) -> int:
        """清理过期会话"""
        cutoff = time.time() - self._timeout
        conn = _get_conn()
        try:
            cursor = conn.execute(
                "UPDATE gateway_sessions SET closed = 1 WHERE last_active_at < ? AND closed = 0",
                (cutoff,),
            )
            conn.commit()
            return cursor.rowcount
        finally:
            conn.close()

    def list_active(self, platform: str = "") -> list[GatewaySession]:
        """列出活跃会话"""
        conn = _get_conn()
        try:
            sql = "SELECT * FROM gateway_sessions WHERE closed = 0"
            params: list = []
            if platform:
                sql += " AND platform = ?"
                params.append(platform)
            rows = conn.execute(sql + " ORDER BY last_active_at DESC LIMIT 100", params).fetchall()
            return [GatewaySession(
                session_id=r["session_id"], platform=r["platform"],
                user_id=r["user_id"], chat_id=r["chat_id"],
                display_name=r["display_name"] or "",
                metadata=json.loads(r["metadata"]) if r["metadata"] else {},
                message_count=r["message_count"],
                created_at=r["created_at"], last_active_at=r["last_active_at"],
            ) for r in rows]
        finally:
            conn.close()

    @staticmethod
    def _make_session_id(source: MessageSource) -> str:
        """生成稳定会话 ID: platform+user_id 哈希"""
        import hashlib
        raw = f"{source.platform.value}:{source.user_id}:{source.chat_id}"
        return hashlib.sha256(raw.encode()).hexdigest()[:16]
