"""
EcoMind 记忆层 — SQLite 本地持久化记忆系统。

不依赖 Hermes/Mem0/Graphiti/GraphRAG 等外部框架。
提供会话记忆 + 长期记忆，SQLite 单文件零配置。
"""

from __future__ import annotations

import json
import logging
import sqlite3
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)


class EcoMemory:
    """
    EcoMind 本地记忆系统。

    三层结构：
    1. 会话记忆 (short_term): 当前对话上下文，存在内存中
    2. 持久记忆 (long_term): 跨会话保留，存在 SQLite 中
    3. 工作记忆 (working): 当前任务临时状态，存在内存中
    """

    def __init__(self, db_path: Optional[str] = None) -> None:
        if db_path is None:
            db_path = str(Path(__file__).parent.parent.parent / "data" / "ecomind_memory.db")

        self.db_path = db_path
        self.short_term: dict[str, list[dict]] = {}   # session_id → messages
        self.working: dict[str, Any] = {}              # 当前任务临时数据

        # 初始化数据库
        self._init_db()

    def _get_conn(self) -> sqlite3.Connection:
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        """初始化数据库表"""
        with self._get_conn() as conn:
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS long_term_memory (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    key TEXT UNIQUE NOT NULL,
                    value TEXT NOT NULL,
                    category TEXT DEFAULT 'general',
                    importance REAL DEFAULT 0.5,
                    created_at REAL NOT NULL,
                    updated_at REAL NOT NULL,
                    expires_at REAL,
                    tags TEXT DEFAULT '[]'
                );

                CREATE INDEX IF NOT EXISTS idx_memory_key ON long_term_memory(key);
                CREATE INDEX IF NOT EXISTS idx_memory_category ON long_term_memory(category);
                CREATE INDEX IF NOT EXISTS idx_memory_importance ON long_term_memory(importance DESC);
                CREATE INDEX IF NOT EXISTS idx_memory_expires ON long_term_memory(expires_at);

                CREATE TABLE IF NOT EXISTS session_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    metadata TEXT DEFAULT '{}',
                    created_at REAL NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_session_id ON session_history(session_id);
                CREATE INDEX IF NOT EXISTS idx_session_time ON session_history(created_at DESC);
            """)
            conn.commit()
        logger.info(f"EcoMind 记忆系统初始化完成: {self.db_path}")

    # ─── 长期记忆 ──────────────────────────────

    def remember(
        self,
        key: str,
        value: Any,
        *,
        category: str = "general",
        importance: float = 0.5,
        ttl_seconds: Optional[int] = None,
        tags: Optional[list[str]] = None,
    ) -> None:
        """存储长期记忆"""
        now = time.time()
        expires_at = now + ttl_seconds if ttl_seconds else None

        with self._get_conn() as conn:
            conn.execute(
                """INSERT OR REPLACE INTO long_term_memory
                   (key, value, category, importance, created_at, updated_at, expires_at, tags)
                   VALUES (?, ?, ?, ?, COALESCE((SELECT created_at FROM long_term_memory WHERE key=?), ?), ?, ?, ?)""",
                (
                    key,
                    json.dumps(value, ensure_ascii=False),
                    category,
                    importance,
                    key, now,
                    now,
                    expires_at,
                    json.dumps(tags or [], ensure_ascii=False),
                ),
            )
            conn.commit()

    def recall(self, key: str) -> Optional[Any]:
        """按 key 召回记忆"""
        with self._get_conn() as conn:
            row = conn.execute(
                "SELECT value, expires_at FROM long_term_memory WHERE key=?",
                (key,),
            ).fetchone()
            if not row:
                return None
            # 检查是否过期
            if row["expires_at"] and row["expires_at"] < time.time():
                self.forget(key)
                return None
            return json.loads(row["value"])

    def recall_by_category(self, category: str, limit: int = 50) -> list[dict]:
        """按类别召回记忆"""
        now = time.time()
        with self._get_conn() as conn:
            rows = conn.execute(
                """SELECT key, value, importance, created_at, tags
                   FROM long_term_memory
                   WHERE category=? AND (expires_at IS NULL OR expires_at > ?)
                   ORDER BY importance DESC, updated_at DESC
                   LIMIT ?""",
                (category, now, limit),
            ).fetchall()
            return [
                {
                    "key": r["key"],
                    "value": json.loads(r["value"]),
                    "importance": r["importance"],
                    "created_at": r["created_at"],
                    "tags": json.loads(r["tags"]),
                }
                for r in rows
            ]

    def search(self, keyword: str, limit: int = 20) -> list[dict]:
        """搜索记忆（关键词匹配）"""
        now = time.time()
        with self._get_conn() as conn:
            rows = conn.execute(
                """SELECT key, value, category, importance, created_at
                   FROM long_term_memory
                   WHERE (expires_at IS NULL OR expires_at > ?)
                     AND (key LIKE ? OR value LIKE ?)
                   ORDER BY importance DESC
                   LIMIT ?""",
                (now, f"%{keyword}%", f"%{keyword}%", limit),
            ).fetchall()
            return [
                {
                    "key": r["key"],
                    "value": json.loads(r["value"]),
                    "category": r["category"],
                    "importance": r["importance"],
                }
                for r in rows
            ]

    def forget(self, key: str) -> bool:
        """删除记忆"""
        with self._get_conn() as conn:
            cursor = conn.execute("DELETE FROM long_term_memory WHERE key=?", (key,))
            conn.commit()
            return cursor.rowcount > 0

    # ─── 会话记忆 ──────────────────────────────

    def start_session(self, session_id: str) -> None:
        """创建新会话"""
        self.short_term[session_id] = []

    def add_message(self, session_id: str, role: str, content: str, metadata: Optional[dict] = None) -> None:
        """添加消息到会话"""
        if session_id not in self.short_term:
            self.start_session(session_id)

        msg = {
            "role": role,
            "content": content,
            "metadata": metadata or {},
            "timestamp": time.time(),
        }
        self.short_term[session_id].append(msg)

        # 同时持久化到 SQLite
        with self._get_conn() as conn:
            conn.execute(
                "INSERT INTO session_history (session_id, role, content, metadata, created_at) VALUES (?, ?, ?, ?, ?)",
                (session_id, role, content, json.dumps(metadata or {}, ensure_ascii=False), time.time()),
            )
            conn.commit()

    def get_session_messages(self, session_id: str, limit: int = 50) -> list[dict]:
        """获取会话消息"""
        return self.short_term.get(session_id, [])[-limit:]

    def end_session(self, session_id: str) -> None:
        """结束会话，释放短期记忆"""
        self.short_term.pop(session_id, None)

    def get_session_history(self, session_id: str, limit: int = 100) -> list[dict]:
        """从 SQLite 获取会话历史"""
        with self._get_conn() as conn:
            rows = conn.execute(
                "SELECT role, content, metadata, created_at FROM session_history WHERE session_id=? ORDER BY id DESC LIMIT ?",
                (session_id, limit),
            ).fetchall()
            return [
                {
                    "role": r["role"],
                    "content": r["content"],
                    "metadata": json.loads(r["metadata"]),
                    "timestamp": r["created_at"],
                }
                for r in reversed(rows)
            ]

    # ─── 工作记忆 ──────────────────────────────

    def set_working(self, key: str, value: Any) -> None:
        """设置工作记忆"""
        self.working[key] = value

    def get_working(self, key: str, default: Any = None) -> Any:
        """获取工作记忆"""
        return self.working.get(key, default)

    def clear_working(self) -> None:
        """清空工作记忆"""
        self.working.clear()

    # ─── 维护 ──────────────────────────────────

    def cleanup_expired(self) -> int:
        """清理过期记忆"""
        now = time.time()
        with self._get_conn() as conn:
            cursor = conn.execute(
                "DELETE FROM long_term_memory WHERE expires_at IS NOT NULL AND expires_at < ?",
                (now,),
            )
            conn.commit()
            deleted = cursor.rowcount
            if deleted:
                logger.info(f"清理了 {deleted} 条过期记忆")
            return deleted

    def stats(self) -> dict:
        """获取记忆系统统计"""
        with self._get_conn() as conn:
            total = conn.execute("SELECT COUNT(*) FROM long_term_memory").fetchone()[0]
            active_sessions = len(self.short_term)
            working_keys = len(self.working)
        return {
            "long_term_memories": total,
            "active_sessions": active_sessions,
            "working_memory_keys": working_keys,
            "db_path": self.db_path,
        }


# 全局单例
_memory: Optional[EcoMemory] = None


def get_memory() -> EcoMemory:
    global _memory
    if _memory is None:
        _memory = EcoMemory()
    return _memory
