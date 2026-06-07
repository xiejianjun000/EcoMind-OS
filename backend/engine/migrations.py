"""
EcoMind 数据库迁移系统

对标 OpenClaw 的 SQLAlchemy + migration 方案。
轻量实现：基于 SQLite 的版本化 schema 管理。
"""
from __future__ import annotations

import logging
import os
import sqlite3
import time
from pathlib import Path
from typing import Callable

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
MIGRATIONS_TABLE = "schema_migrations"


def _get_migration_conn() -> sqlite3.Connection:
    """获取迁移记录数据库连接"""
    db_path = DATA_DIR / "hermes_memory.db"
    os.makedirs(DATA_DIR, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    return conn


def ensure_migrations_table(conn: sqlite3.Connection) -> None:
    """确保迁移记录表存在"""
    conn.execute(f"""
        CREATE TABLE IF NOT EXISTS {MIGRATIONS_TABLE} (
            version TEXT PRIMARY KEY,
            applied_at REAL NOT NULL,
            description TEXT DEFAULT ''
        )
    """)
    conn.commit()


def get_applied_versions(conn: sqlite3.Connection) -> set[str]:
    """获取已应用的迁移版本"""
    rows = conn.execute(f"SELECT version FROM {MIGRATIONS_TABLE} ORDER BY version").fetchall()
    return {r["version"] for r in rows}


def apply_migration(conn: sqlite3.Connection, version: str, description: str, up: Callable) -> None:
    """应用单个迁移"""
    try:
        up(conn)
        conn.execute(
            f"INSERT INTO {MIGRATIONS_TABLE} (version, applied_at, description) VALUES (?, ?, ?)",
            (version, time.time(), description),
        )
        conn.commit()
        logger.info(f"✅ 迁移完成: {version} — {description}")
    except Exception as e:
        conn.rollback()
        logger.error(f"❌ 迁移失败 {version}: {e}")
        raise


# ─── 迁移定义 ────────────────────────────────────────

MIGRATIONS = [
    {
        "version": "001",
        "description": "初始化记忆系统表（memories + facts + FTS5）",
        "up": lambda conn: _migration_001(conn),
    },
    {
        "version": "002",
        "description": "添加 conversations 会话持久化表",
        "up": lambda conn: _migration_002(conn),
    },
]


def _migration_001(conn: sqlite3.Connection) -> None:
    """创建记忆和事实表"""
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS memories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content TEXT NOT NULL,
            category TEXT DEFAULT 'general',
            tags TEXT DEFAULT '',
            trust REAL DEFAULT 1.0,
            expert_id TEXT DEFAULT '',
            session_id TEXT DEFAULT '',
            created_at REAL NOT NULL,
            updated_at REAL NOT NULL
        );

        CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
            content,
            content_rowid='id'
        );

        CREATE TABLE IF NOT EXISTS facts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            entity TEXT NOT NULL,
            fact TEXT NOT NULL,
            category TEXT DEFAULT 'general',
            created_at REAL NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_facts_entity ON facts(entity);
        CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(category);
    """)


def _migration_002(conn: sqlite3.Connection) -> None:
    """创建会话表"""
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY,
            expert_id TEXT NOT NULL DEFAULT 'ecomind',
            title TEXT DEFAULT '',
            created_at REAL NOT NULL,
            updated_at REAL NOT NULL,
            message_count INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            tool_calls TEXT DEFAULT '[]',
            created_at REAL NOT NULL,
            FOREIGN KEY (conversation_id) REFERENCES conversations(id)
        );

        CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
    """)


# ─── 公开 API ────────────────────────────────────────

def run_migrations() -> int:
    """执行所有未应用的迁移。返回应用的迁移数量。"""
    conn = _get_migration_conn()
    try:
        ensure_migrations_table(conn)
        applied = get_applied_versions(conn)
        count = 0
        for mig in MIGRATIONS:
            if mig["version"] not in applied:
                logger.info(f"🔄 执行迁移: {mig['version']} — {mig['description']}")
                apply_migration(conn, mig["version"], mig["description"], mig["up"])
                count += 1

        if count == 0:
            logger.info("✅ 数据库已是最新版本")
        else:
            logger.info(f"✅ 全部迁移完成: {count}个")
        return count
    finally:
        conn.close()


def get_migration_status() -> list[dict]:
    """获取迁移状态"""
    conn = _get_migration_conn()
    try:
        ensure_migrations_table(conn)
        applied = get_applied_versions(conn)
        status = []
        for mig in MIGRATIONS:
            status.append({
                "version": mig["version"],
                "description": mig["description"],
                "applied": mig["version"] in applied,
            })
        return status
    finally:
        conn.close()
