"""
EcoMind 用户画像引擎 — 让 Agent 记住"你是谁"

构建每个用户的隐式/显式偏好模型，实现千人千面。

数据分类:
  ✅ 主动学习: 用户显式告诉我们的偏好（语言、详细程度、通知偏好）
  ✅ 被动观察: 从行为中学习的偏好（常用查询类型、采纳率）
  ❌ 不推断: 政治倾向、收入水平、宗教信仰

Privacy by Design:
  - 用户可随时查看/删除/导出自己的 Profile
  - 不跨用户共享画像
  - Profile 仅用于提升服务质量，不用于任何商业目的
"""
from __future__ import annotations

import json
import logging
import sqlite3
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "hermes_memory.db"


def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def _init():
    conn = _get_conn()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS user_profiles (
            user_id TEXT PRIMARY KEY,
            display_name TEXT DEFAULT '',
            organization TEXT DEFAULT '',
            department TEXT DEFAULT '',
            role TEXT DEFAULT '',
            expertise_level TEXT DEFAULT 'intermediate',
            preferences TEXT DEFAULT '{}',
            interaction_stats TEXT DEFAULT '{}',
            created_at REAL NOT NULL,
            updated_at REAL NOT NULL
        );
        CREATE TABLE IF NOT EXISTS user_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            session_id TEXT NOT NULL,
            query_count INTEGER DEFAULT 0,
            avg_rating REAL DEFAULT 0,
            domain TEXT DEFAULT '',
            started_at REAL NOT NULL,
            ended_at REAL
        );
        CREATE INDEX IF NOT EXISTS idx_us_user ON user_sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_us_session ON user_sessions(session_id);
    """)
    conn.commit()
    conn.close()


_init()


@dataclass
class UserPreferences:
    language: str = "zh"                          # 语言偏好
    detail_level: str = "standard"               # 详细程度: brief / standard / detailed
    citation_style: str = "inline"               # 引用方式: inline / footnote / minimal
    output_format: str = "text"                  # 输出格式: text / markdown / structured
    primary_domain: str = ""                     # 主要业务领域
    jurisdiction: str = ""                       # 管辖区域
    notification_enabled: bool = True             # 是否接收通知
    auto_approve_minor: bool = False              # 是否自动批准低风险操作
    theme: str = "light"                         # UI 主题


@dataclass
class InteractionStats:
    total_queries: int = 0
    avg_session_length: float = 0.0
    suggestion_acceptance_rate: float = 0.0
    correction_rate: float = 0.0
    most_used_tools: list[str] = field(default_factory=list)
    peak_hours: list[int] = field(default_factory=list)
    favorite_experts: list[str] = field(default_factory=list)
    avg_response_time_ms: float = 0.0


class UserProfileEngine:
    """用户画像引擎"""

    # ── Profile CRUD ──

    def get_or_create(self, user_id: str) -> dict[str, Any]:
        conn = _get_conn()
        try:
            row = conn.execute(
                "SELECT * FROM user_profiles WHERE user_id = ?", (user_id,)
            ).fetchone()

            if row:
                return dict(row)
            else:
                now = time.time()
                conn.execute(
                    """INSERT INTO user_profiles (user_id, created_at, updated_at)
                       VALUES (?, ?, ?)""",
                    (user_id, now, now),
                )
                conn.commit()
                return {
                    "user_id": user_id,
                    "display_name": "",
                    "organization": "",
                    "preferences": "{}",
                    "interaction_stats": "{}",
                    "created_at": now,
                    "updated_at": now,
                }
        finally:
            conn.close()

    def update_profile(self, user_id: str, **kwargs) -> dict[str, Any]:
        conn = _get_conn()
        try:
            profile = self.get_or_create(user_id)
            for k, v in kwargs.items():
                if k in profile:
                    profile[k] = v
            conn.execute(
                """UPDATE user_profiles SET
                   display_name=?, organization=?, department=?,
                   role=?, expertise_level=?, preferences=?,
                   updated_at=?
                   WHERE user_id=?""",
                (
                    profile.get("display_name", ""),
                    profile.get("organization", ""),
                    profile.get("department", ""),
                    profile.get("role", ""),
                    profile.get("expertise_level", "intermediate"),
                    json.dumps(profile.get("preferences", {}))
                    if isinstance(profile.get("preferences"), dict)
                    else profile.get("preferences", "{}"),
                    time.time(),
                    user_id,
                ),
            )
            conn.commit()
            return self.get_or_create(user_id)
        finally:
            conn.close()

    def delete_profile(self, user_id: str) -> bool:
        """删除用户画像（用户主动请求）"""
        conn = _get_conn()
        try:
            conn.execute("DELETE FROM user_profiles WHERE user_id = ?", (user_id,))
            conn.execute("DELETE FROM user_sessions WHERE user_id = ?", (user_id,))
            conn.commit()
            return True
        finally:
            conn.close()

    # ── 偏好管理 ──

    def get_preferences(self, user_id: str) -> UserPreferences:
        profile = self.get_or_create(user_id)
        raw = profile.get("preferences", {})
        if isinstance(raw, str):
            try:
                raw = json.loads(raw)
            except (json.JSONDecodeError, TypeError):
                raw = {}
        return UserPreferences(**{k: v for k, v in raw.items() if k in UserPreferences.__dataclass_fields__})

    def set_preferences(self, user_id: str, preferences: UserPreferences) -> None:
        conn = _get_conn()
        try:
            conn.execute(
                "UPDATE user_profiles SET preferences = ?, updated_at = ? WHERE user_id = ?",
                (json.dumps(preferences.__dict__), time.time(), user_id),
            )
            conn.commit()
        finally:
            conn.close()

    # ── 被动学习 ──

    def record_session(
        self, user_id: str, session_id: str, domain: str = "",
        query_count: int = 0, avg_rating: float = 0,
    ) -> None:
        """记录一次会话，用于被动学习用户行为"""
        conn = _get_conn()
        try:
            conn.execute(
                """INSERT INTO user_sessions
                   (user_id, session_id, query_count, avg_rating, domain, started_at)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (user_id, session_id, query_count, avg_rating, domain, time.time()),
            )
            conn.commit()
        finally:
            conn.close()

    def end_session(self, session_id: str) -> None:
        conn = _get_conn()
        try:
            conn.execute(
                "UPDATE user_sessions SET ended_at = ? WHERE session_id = ?",
                (time.time(), session_id),
            )
            conn.commit()
        finally:
            conn.close()

    def get_interaction_stats(self, user_id: str) -> InteractionStats:
        """计算用户的交互统计"""
        conn = _get_conn()
        try:
            rows = conn.execute(
                "SELECT * FROM user_sessions WHERE user_id = ? AND ended_at IS NOT NULL "
                "ORDER BY started_at DESC LIMIT 100",
                (user_id,),
            ).fetchall()

            stats = InteractionStats()
            if not rows:
                return stats

            stats.total_queries = sum(r["query_count"] or 0 for r in rows)
            stats.avg_session_length = sum(
                ((r["ended_at"] or 0) - (r["started_at"] or 0)) for r in rows
            ) / len(rows) / 60.0  # 分钟
            stats.avg_response_time_ms = 0  # 需从工具日志计算

            if stats.total_queries > 0:
                stats.suggestion_acceptance_rate = 0.7  # placeholder
                stats.correction_rate = 0.05

            return stats
        finally:
            conn.close()

    # ── 注入到系统提示词 ──

    def inject_context(self, user_id: str) -> str:
        """
        生成注入到系统提示词的用户偏好片段。

        示例:
          用户偏好: 详细回答, 标注法规出处, 湖南省执法口
        """
        profile = self.get_or_create(user_id)
        prefs = self.get_preferences(user_id)

        parts = []
        if profile.get("role"):
            parts.append(f"角色: {profile['role']}")
        if prefs.primary_domain:
            parts.append(f"主要业务: {prefs.primary_domain}")
        if prefs.jurisdiction:
            parts.append(f"管辖区域: {prefs.jurisdiction}")
        if prefs.detail_level == "brief":
            parts.append("偏好简洁回答")
        elif prefs.detail_level == "detailed":
            parts.append("偏好详细回答，包含法规引用")
        if prefs.citation_style == "inline":
            parts.append("请在内文中直接标注法规出处")

        if not parts:
            return ""
        return "[用户偏好]" + ", ".join(parts) + "\n"

    def export_profile(self, user_id: str) -> dict:
        """导出用户画像（用户有权获取自己的数据）"""
        return {
            "profile": self.get_or_create(user_id),
            "preferences": vars(self.get_preferences(user_id)),
            "stats": vars(self.get_interaction_stats(user_id)),
            "exported_at": time.time(),
        }


# 单例
_instance: Optional[UserProfileEngine] = None


def get_user_profile() -> UserProfileEngine:
    global _instance
    if _instance is None:
        _instance = UserProfileEngine()
    return _instance
