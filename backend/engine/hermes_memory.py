"""
EcoMind Hermes 记忆引擎

Hermes 级持久化记忆系统：
- SQLite 持久化存储（跨会话）
- 结构化事实存储（fact_store）
- 全文搜索（session_search）
- 置信度评分（trust scoring）
- 实体推理（entity reasoning）
"""

from __future__ import annotations

import json
import logging
import os
import sqlite3
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "hermes_memory.db"


def _get_conn() -> sqlite3.Connection:
    os.makedirs(DB_PATH.parent, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def _init_db():
    conn = _get_conn()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS memories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content TEXT NOT NULL,
            category TEXT DEFAULT 'general',
            tags TEXT DEFAULT '',
            trust REAL DEFAULT 1.0,
            expert_id TEXT DEFAULT 'ecomind',
            session_id TEXT,
            created_at REAL,
            updated_at REAL
        );
        CREATE TABLE IF NOT EXISTS facts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entity TEXT NOT NULL,
            fact TEXT NOT NULL,
            category TEXT DEFAULT 'general',
            trust REAL DEFAULT 1.0,
            source TEXT DEFAULT '',
            created_at REAL
        );
        CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(category);
        CREATE INDEX IF NOT EXISTS idx_memories_trust ON memories(trust);
        CREATE INDEX IF NOT EXISTS idx_facts_entity ON facts(entity);
        CREATE INDEX IF NOT EXISTS idx_facts_trust ON facts(trust);
        CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(content, category, tags);
    """)
    conn.commit()
    conn.close()


# 初始化
_init_db()


class HermesMemory:
    """Hermes 级记忆引擎"""

    # ─── Memory CRUD ───────────────────────────────

    @staticmethod
    def save(
        content: str,
        category: str = "general",
        tags: str = "",
        expert_id: str = "ecomind",
        session_id: str = "",
        trust: float = 1.0,
    ) -> int:
        """保存一条记忆"""
        now = time.time()
        conn = _get_conn()
        c = conn.execute(
            """INSERT INTO memories (content, category, tags, trust, expert_id, session_id, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (content, category, tags, trust, expert_id, session_id, now, now),
        )
        mid = c.lastrowid
        # 同步 FTS 索引
        conn.execute(
            "INSERT INTO memories_fts (rowid, content, category, tags) VALUES (?, ?, ?, ?)",
            (mid, content, category, tags),
        )
        conn.commit()
        conn.close()
        logger.debug(f"记忆已保存: #{mid} [{category}] {content[:60]}...")
        return mid

    @staticmethod
    def search(query: str, limit: int = 10, category: str = "") -> list[dict]:
        """全文搜索记忆"""
        conn = _get_conn()
        if category:
            rows = conn.execute(
                """SELECT m.* FROM memories m
                   JOIN memories_fts f ON m.id = f.rowid
                   WHERE memories_fts MATCH ? AND m.category = ?
                   ORDER BY rank LIMIT ?""",
                (query, category, limit),
            ).fetchall()
        else:
            rows = conn.execute(
                """SELECT m.* FROM memories m
                   JOIN memories_fts f ON m.id = f.rowid
                   WHERE memories_fts MATCH ?
                   ORDER BY rank LIMIT ?""",
                (query, limit),
            ).fetchall()
        conn.close()
        return [dict(r) for r in rows]

    @staticmethod
    def get_recent(limit: int = 20, category: str = "") -> list[dict]:
        """获取最近记忆"""
        conn = _get_conn()
        if category:
            rows = conn.execute(
                "SELECT * FROM memories WHERE category=? ORDER BY updated_at DESC LIMIT ?",
                (category, limit),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM memories ORDER BY updated_at DESC LIMIT ?",
                (limit,),
            ).fetchall()
        conn.close()
        return [dict(r) for r in rows]

    @staticmethod
    def update_trust(memory_id: int, delta: float) -> None:
        """调整记忆置信度"""
        conn = _get_conn()
        conn.execute(
            "UPDATE memories SET trust = MAX(0, MIN(1, trust + ?)), updated_at = ? WHERE id = ?",
            (delta, time.time(), memory_id),
        )
        conn.commit()
        conn.close()

    @staticmethod
    def delete(memory_id: int) -> bool:
        """删除记忆"""
        conn = _get_conn()
        conn.execute("DELETE FROM memories WHERE id = ?", (memory_id,))
        conn.execute("DELETE FROM memories_fts WHERE rowid = ?", (memory_id,))
        conn.commit()
        conn.close()
        return True

    # ─── Fact Store ────────────────────────────────

    @staticmethod
    def add_fact(
        entity: str, fact: str, category: str = "general", trust: float = 1.0, source: str = ""
    ) -> int:
        """添加结构化事实"""
        conn = _get_conn()
        c = conn.execute(
            "INSERT INTO facts (entity, fact, category, trust, source, created_at) VALUES (?,?,?,?,?,?)",
            (entity, fact, category, trust, source, time.time()),
        )
        fid = c.lastrowid
        conn.commit()
        conn.close()
        return fid

    @staticmethod
    def probe(entity: str, limit: int = 20) -> list[dict]:
        """查询某实体的所有事实"""
        conn = _get_conn()
        rows = conn.execute(
            "SELECT * FROM facts WHERE entity=? ORDER BY trust DESC LIMIT ?",
            (entity, limit),
        ).fetchall()
        conn.close()
        return [dict(r) for r in rows]

    @staticmethod
    def reason(entities: list[str], limit: int = 10) -> list[dict]:
        """多实体关联推理：查找同时关联多个实体的事实"""
        if not entities:
            return []
        conn = _get_conn()
        placeholders = ",".join(["?" for _ in entities])
        rows = conn.execute(
            f"SELECT * FROM facts WHERE entity IN ({placeholders}) ORDER BY trust DESC LIMIT ?",
            (*entities, limit),
        ).fetchall()
        conn.close()
        return [dict(r) for r in rows]

    @staticmethod
    def search_facts(query: str, limit: int = 10) -> list[dict]:
        """关键词搜索事实"""
        conn = _get_conn()
        rows = conn.execute(
            "SELECT * FROM facts WHERE fact LIKE ? OR entity LIKE ? ORDER BY trust DESC LIMIT ?",
            (f"%{query}%", f"%{query}%", limit),
        ).fetchall()
        conn.close()
        return [dict(r) for r in rows]

    @staticmethod
    def feedback(fact_id: int, helpful: bool) -> None:
        """反馈事实质量"""
        delta = 0.1 if helpful else -0.2
        conn = _get_conn()
        conn.execute("UPDATE facts SET trust = MAX(0, MIN(1, trust + ?)) WHERE id = ?", (delta, fact_id))
        conn.commit()
        conn.close()

    # ─── Session Context ───────────────────────────

    @staticmethod
    def get_session_context(session_id: str, limit: int = 10) -> list[dict]:
        """获取会话相关记忆"""
        conn = _get_conn()
        rows = conn.execute(
            "SELECT * FROM memories WHERE session_id=? ORDER BY created_at DESC LIMIT ?",
            (session_id, limit),
        ).fetchall()
        conn.close()
        return [dict(r) for r in rows]

    @staticmethod
    def inject_context(session_id: str, expert_id: str) -> str:
        """为 LLM 注入当前会话的历史记忆上下文"""
        recent = HermesMemory.get_session_context(session_id, 5)
        if not recent:
            return ""

        lines = ["\n## 📚 历史记忆（与本会话相关）"]
        for m in recent:
            trust_icon = "🟢" if m["trust"] > 0.7 else "🟡" if m["trust"] > 0.3 else "🔴"
            lines.append(f"- {trust_icon} [{m['category']}] {m['content'][:200]}")
        return "\n".join(lines)

    # ─── Stats ─────────────────────────────────────

    @staticmethod
    def stats() -> dict:
        """记忆统计"""
        conn = _get_conn()
        total_memories = conn.execute("SELECT COUNT(*) FROM memories").fetchone()[0]
        total_facts = conn.execute("SELECT COUNT(*) FROM facts").fetchone()[0]
        high_trust = conn.execute("SELECT COUNT(*) FROM memories WHERE trust >= 0.7").fetchone()[0]
        conn.close()
        return {
            "total_memories": total_memories,
            "total_facts": total_facts,
            "high_trust_memories": high_trust,
            "db_path": str(DB_PATH),
        }


# 全局单例
_memory_instance: Optional[HermesMemory] = None


def get_memory() -> HermesMemory:
    global _memory_instance
    if _memory_instance is None:
        _memory_instance = HermesMemory()
    return _memory_instance
