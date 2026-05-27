"""
Claude-Mem Bridge — 将 thedotmack/claude-mem (78K ⭐) 记忆理念接入 EcoMind OS。

Claude-Mem 核心理念:
  - Persistent Context: 跨会话持久化上下文
  - AI Compression: 用 AI 压缩会话摘要
  - Context Injection: 自动注入相关历史到新会话

本模块提供 4 层记忆:
  L1 短期记忆 — 会话内上下文 (类比 Hermes)
  L2 中期记忆 — 用户偏好与历史 (类比 Mem0)
  L3 关联记忆 — 知识图谱关系 (类比 Graphiti)
  L4 长期记忆 — 全局知识检索 (类比 GraphRAG)
"""

from __future__ import annotations

import json
import logging
import sqlite3
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)

DB_PATH = Path.home() / ".hermes" / "ecomind_memory.db"


@dataclass
class MemoryMessage:
    role: str  # user / assistant / system / tool
    content: str
    timestamp: float = field(default_factory=time.time)
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class MemorySession:
    session_id: str
    agent_id: str
    messages: list[MemoryMessage] = field(default_factory=list)
    summary: str = ""
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    metadata: dict[str, Any] = field(default_factory=dict)


class EcoMemory:
    """EcoMind 持久化记忆系统 — 自建，零外部依赖"""

    def __init__(self, db_path: Optional[str] = None) -> None:
        self._db_path = db_path or str(DB_PATH)
        self._sessions: dict[str, MemorySession] = {}
        self._init_db()

    def _init_db(self) -> None:
        Path(self._db_path).parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(self._db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS sessions (
                    session_id TEXT PRIMARY KEY,
                    agent_id TEXT NOT NULL,
                    summary TEXT DEFAULT '',
                    messages_json TEXT DEFAULT '[]',
                    metadata_json TEXT DEFAULT '{}',
                    created_at REAL,
                    updated_at REAL
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS user_preferences (
                    key TEXT PRIMARY KEY,
                    value TEXT,
                    updated_at REAL
                )
            """)
            conn.commit()

    # ─── L1 短期记忆 ──────────────────────────────

    def create_session(self, agent_id: str, session_id: Optional[str] = None) -> str:
        sid = session_id or str(uuid.uuid4())
        session = MemorySession(session_id=sid, agent_id=agent_id)
        self._sessions[sid] = session
        self._persist_session(session)
        return sid

    def add_message(self, session_id: str, role: str, content: str, **meta) -> None:
        session = self._sessions.get(session_id)
        if not session:
            session = MemorySession(session_id=session_id, agent_id="unknown")
            self._sessions[session_id] = session
        msg = MemoryMessage(role=role, content=content, metadata=meta)
        session.messages.append(msg)
        session.updated_at = time.time()
        self._persist_session(session)

    def get_context(self, session_id: str, last_n: int = 50) -> list[dict]:
        session = self._sessions.get(session_id)
        if not session:
            return []
        return [
            {"role": m.role, "content": m.content}
            for m in session.messages[-last_n:]
        ]

    # ─── L2 中期记忆 ──────────────────────────────

    def set_preference(self, key: str, value: str) -> None:
        with sqlite3.connect(self._db_path) as conn:
            conn.execute(
                "INSERT OR REPLACE INTO user_preferences (key, value, updated_at) VALUES (?, ?, ?)",
                (key, value, time.time()),
            )
            conn.commit()

    def get_preference(self, key: str) -> Optional[str]:
        with sqlite3.connect(self._db_path) as conn:
            row = conn.execute(
                "SELECT value FROM user_preferences WHERE key = ?", (key,)
            ).fetchone()
            return row[0] if row else None

    def get_all_preferences(self) -> dict[str, str]:
        with sqlite3.connect(self._db_path) as conn:
            rows = conn.execute("SELECT key, value FROM user_preferences").fetchall()
            return {r[0]: r[1] for r in rows}

    # ─── L3 关联记忆 ──────────────────────────────

    def get_related_sessions(self, keyword: str, limit: int = 5) -> list[MemorySession]:
        related = []
        for session in self._sessions.values():
            for msg in session.messages:
                if keyword in msg.content:
                    related.append(session)
                    break
        return related[:limit]

    # ─── L4 长期记忆 ──────────────────────────────

    def compress_session(self, session_id: str, summary: str) -> None:
        """AI 压缩会话 -> 存储摘要"""
        session = self._sessions.get(session_id)
        if session:
            session.summary = summary
            self._persist_session(session)

    def get_session_summaries(self, agent_id: Optional[str] = None) -> list[dict]:
        summaries = []
        for s in self._sessions.values():
            if agent_id and s.agent_id != agent_id:
                continue
            if s.summary:
                summaries.append({
                    "session_id": s.session_id,
                    "summary": s.summary,
                    "message_count": len(s.messages),
                    "updated_at": s.updated_at,
                })
        return summaries[-20:]  # 最近 20 条

    # ─── 内部持久化 ──────────────────────────────

    def _persist_session(self, session: MemorySession) -> None:
        try:
            with sqlite3.connect(self._db_path) as conn:
                conn.execute(
                    """INSERT OR REPLACE INTO sessions
                       (session_id, agent_id, summary, messages_json, metadata_json, created_at, updated_at)
                       VALUES (?, ?, ?, ?, ?, ?, ?)""",
                    (
                        session.session_id,
                        session.agent_id,
                        session.summary,
                        json.dumps([{"role": m.role, "content": m.content, "timestamp": m.timestamp, "metadata": m.metadata} for m in session.messages]),
                        json.dumps(session.metadata),
                        session.created_at,
                        session.updated_at,
                    ),
                )
                conn.commit()
        except Exception as e:
            logger.error(f"持久化会话失败: {e}")

    def load_all(self) -> int:
        """从数据库加载所有会话到内存"""
        count = 0
        try:
            with sqlite3.connect(self._db_path) as conn:
                rows = conn.execute("SELECT * FROM sessions ORDER BY updated_at DESC").fetchall()
                for row in rows:
                    sid, agent_id, summary, msgs_json, meta_json, created, updated = row
                    msgs = [MemoryMessage(**m) for m in json.loads(msgs_json)]
                    session = MemorySession(
                        session_id=sid,
                        agent_id=agent_id,
                        messages=msgs,
                        summary=summary,
                        metadata=json.loads(meta_json),
                        created_at=created,
                        updated_at=updated,
                    )
                    self._sessions[sid] = session
                    count += 1
            logger.info(f"从数据库加载了 {count} 个会话")
        except Exception as e:
            logger.warning(f"加载会话失败: {e}")
        return count

    def get_stats(self) -> dict:
        return {
            "total_sessions": len(self._sessions),
            "total_messages": sum(len(s.messages) for s in self._sessions.values()),
            "total_summaries": sum(1 for s in self._sessions.values() if s.summary),
            "preferences": len(self.get_all_preferences()),
            "db_path": self._db_path,
        }


_memory: Optional[EcoMemory] = None


def get_memory() -> EcoMemory:
    global _memory
    if _memory is None:
        _memory = EcoMemory()
        _memory.load_all()
    return _memory
