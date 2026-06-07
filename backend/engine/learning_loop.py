"""
EcoMind 闭环学习引擎 — 让 Agent "越办案越老练"

三层闭环：
  1. 即时纠正 — 用户不满意立刻换说法
  2. 会话总结 — 每次对话结束生成 Session Digest
  3. 夜间反思 — 每日聚合模式发现

Usage:
    from engine.learning_loop import LearningLoop
    loop = LearningLoop()
    loop.record_feedback(session_id, question, answer, rating, correction)
    digest = loop.session_digest(session_id)
    insights = loop.nightly_discovery()
"""
from __future__ import annotations

import json
import logging
import sqlite3
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Optional

from engine.memory_evolution import MemoryEvolution

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
        CREATE TABLE IF NOT EXISTS learning_feedback (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            expert_id TEXT DEFAULT '',
            question TEXT NOT NULL,
            answer TEXT NOT NULL,
            rating INTEGER DEFAULT 0,
            correction TEXT DEFAULT '',
            tags TEXT DEFAULT '[]',
            recorded_at REAL NOT NULL
        );
        CREATE TABLE IF NOT EXISTS session_digests (
            session_id TEXT PRIMARY KEY,
            expert_id TEXT DEFAULT '',
            summary TEXT NOT NULL,
            key_decisions TEXT DEFAULT '[]',
            lessons_learned TEXT DEFAULT '[]',
            tools_used TEXT DEFAULT '[]',
            errors_made TEXT DEFAULT '[]',
            created_at REAL NOT NULL
        );
        CREATE TABLE IF NOT EXISTS discovered_patterns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pattern_type TEXT NOT NULL,
            description TEXT NOT NULL,
            sample_ids TEXT DEFAULT '[]',
            confidence REAL DEFAULT 0.5,
            action_taken TEXT DEFAULT '',
            discovered_at REAL NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_feedback_session ON learning_feedback(session_id);
        CREATE INDEX IF NOT EXISTS idx_feedback_expert ON learning_feedback(expert_id);
        CREATE INDEX IF NOT EXISTS idx_feedback_rating ON learning_feedback(rating);
    """)
    conn.commit()
    conn.close()


_init()


@dataclass
class FeedbackRecord:
    session_id: str
    question: str
    answer: str
    rating: int = 0       # 1-5 星
    correction: str = ""  # 用户纠正的内容
    expert_id: str = ""
    tags: list[str] = field(default_factory=list)


@dataclass
class SessionDigest:
    session_id: str
    summary: str
    key_decisions: list[str]
    lessons_learned: list[str]
    tools_used: list[str]
    errors_made: list[str]


class LearningLoop:
    """闭环学习引擎"""

    def __init__(self):
        self._evo = MemoryEvolution()

    # ── 即时纠正 ──

    def record_feedback(self, record: FeedbackRecord) -> int:
        """
        记录一次用户反馈。

        当用户纠正 Agent 的回答时：
          - rating 低 → 触发自我反思
          - 有 correction → 记录纠正面，更新记忆
        """
        conn = _get_conn()
        try:
            cursor = conn.execute(
                """INSERT INTO learning_feedback
                   (session_id, expert_id, question, answer, rating, correction, tags, recorded_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    record.session_id, record.expert_id,
                    record.question, record.answer,
                    record.rating, record.correction,
                    json.dumps(record.tags), time.time(),
                ),
            )
            conn.commit()
            feedback_id = cursor.lastrowid

            if record.rating <= 2 and record.correction:
                self._learn_from_correction(record)

            level = "ERROR" if record.rating <= 2 else "INFO"
            logger.log(
                logging.ERROR if record.rating <= 2 else logging.INFO,
                "反馈记录: rating=%d/5, session=%s, correction=%s",
                record.rating, record.session_id[:8],
                record.correction[:60] if record.correction else "(无)",
            )

            return feedback_id
        finally:
            conn.close()

    def _learn_from_correction(self, record: FeedbackRecord) -> None:
        """从用户纠正中学习——永久更新相关记忆"""
        conn = _get_conn()
        try:
            keywords = " ".join(set((record.question + " " + record.correction).lower().split()[:10]))
            conn.execute(
                """INSERT INTO memories (content, category, trust, expert_id, session_id, created_at, updated_at)
                   VALUES (?, 'correction', 0.9, ?, ?, ?, ?)""",
                (
                    f"[纠正] 用户问: {record.question[:200]}, 回答有误: {record.answer[:200]}, "
                    f"正确应为: {record.correction[:200]}",
                    record.expert_id, record.session_id, time.time(), time.time(),
                ),
            )
            conn.commit()
            logger.info("已从用户纠正中学习: %s", record.correction[:80])
        finally:
            conn.close()

    def get_feedback_stats(self, expert_id: str = "", days: int = 30) -> dict[str, Any]:
        """获取反馈统计"""
        conn = _get_conn()
        try:
            since = time.time() - days * 86400
            params = (since,)
            sql = "SELECT COUNT(*) as total, AVG(rating) as avg_rating FROM learning_feedback WHERE recorded_at >= ?"
            if expert_id:
                sql += " AND expert_id = ?"
                params = (since, expert_id)
            row = conn.execute(sql, params).fetchone()
            return {
                "total_feedback": row["total"] or 0,
                "avg_rating": round(row["avg_rating"] or 0, 2),
                "period_days": days,
                "expert_id": expert_id or "all",
            }
        finally:
            conn.close()

    # ── 会话总结 ──

    def session_digest(self, session_id: str, expert_id: str = "") -> SessionDigest:
        """
        会话结束后生成 Digest。

        分析内容:
          1. 本次会话的关键决策
          2. 学到的经验教训
          3. 使用的工具列表
          4. 犯的错误
        """
        conn = _get_conn()
        try:
            # 1. 收集反馈
            feedbacks = conn.execute(
                "SELECT * FROM learning_feedback WHERE session_id = ? ORDER BY id",
                (session_id,),
            ).fetchall()

            # 2. 收集记忆
            memories = conn.execute(
                "SELECT content FROM memories WHERE session_id = ?",
                (session_id,),
            ).fetchall()

            key_decisions: list[str] = []
            lessons: list[str] = []
            errors: list[str] = []

            for fb in feedbacks:
                if fb["rating"] >= 4:
                    key_decisions.append(fb["question"][:100])
                elif fb["rating"] <= 2:
                    errors.append(fb["correction"] or fb["answer"][:100])

            for mem in memories:
                content = mem["content"]
                if "[纠正]" in content:
                    lessons.append(content[:150])

            digest = SessionDigest(
                session_id=session_id,
                summary=f"会话 {session_id[:8]}: {len(feedbacks)} 次交互, "
                        f"平均评分 {sum(f['rating'] for f in feedbacks) / max(len(feedbacks), 1):.1f}/5",
                key_decisions=key_decisions,
                lessons_learned=lessons,
                tools_used=[],  # 后续可以从 tool 日志中提取
                errors_made=errors,
            )

            conn.execute(
                """INSERT OR REPLACE INTO session_digests
                   (session_id, expert_id, summary, key_decisions, lessons_learned,
                    tools_used, errors_made, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    digest.session_id, expert_id,
                    digest.summary,
                    json.dumps(digest.key_decisions),
                    json.dumps(digest.lessons_learned),
                    json.dumps(digest.tools_used),
                    json.dumps(digest.errors_made),
                    time.time(),
                ),
            )
            conn.commit()

            logger.info("会话总结完成: %s", digest.summary)
            return digest
        finally:
            conn.close()

    # ── 夜间反思 ──

    def nightly_discovery(self, days_back: int = 1) -> dict[str, Any]:
        """
        夜间反思——聚合最近 N 天的会话，发现模式。

        分析:
          1. 最常被纠正的问题类型
          2. 高频工具使用模式
          3. 用户满意度趋势
          4. 跨会话的共性错误
        """
        since = time.time() - days_back * 86400
        conn = _get_conn()
        report = {
            "timestamp": datetime.now().isoformat(),
            "period": f"{days_back}d",
            "sessions_analyzed": 0,
            "patterns_found": [],
            "feedback_trend": "",
            "recommendations": [],
        }

        try:
            # 统计
            feedbacks = conn.execute(
                "SELECT * FROM learning_feedback WHERE recorded_at >= ?",
                (since,),
            ).fetchall()

            if not feedbacks:
                report["feedback_trend"] = "近期无用户反馈"
                return report

            sessions = set(f["session_id"] for f in feedbacks)
            report["sessions_analyzed"] = len(sessions)

            avg = sum(f["rating"] for f in feedbacks) / len(feedbacks)
            if avg >= 4.0:
                report["feedback_trend"] = f"满意度高 (平均 {avg:.1f}/5)"
            elif avg >= 2.5:
                report["feedback_trend"] = f"满意度中性 (平均 {avg:.1f}/5)"
            else:
                report["feedback_trend"] = f"⚠️ 满意度低 (平均 {avg:.1f}/5)"

            # 高频纠正
            corrections = [f for f in feedbacks if f["correction"]]
            if len(corrections) >= 3:
                report["patterns_found"].append(
                    f"发现 {len(corrections)} 条纠正——Agent 在 {len(sessions)} 个会话中被纠正"
                )
                report["recommendations"].append("建议审查最近纠正记录，更新 Agent 提示词")

            # 模式发现
            low_ratings = [f for f in feedbacks if f["rating"] <= 2]
            if len(low_ratings) >= 5:
                # 分析低分问题的共性
                questions = [f["question"].lower() for f in low_ratings]
                keyword_counts: dict[str, int] = {}
                for q in questions:
                    for w in q.split():
                        if len(w) >= 2:
                            keyword_counts[w] = keyword_counts.get(w, 0) + 1
                top_kw = sorted(keyword_counts.items(), key=lambda x: -x[1])[:5]
                report["patterns_found"].append(
                    f"低分问题高频关键词: {', '.join(f'{k}({v})' for k, v in top_kw)}"
                )

            # 写入发现的模式
            for pattern in report["patterns_found"]:
                conn.execute(
                    """INSERT INTO discovered_patterns
                       (pattern_type, description, confidence, discovered_at)
                       VALUES ('nightly', ?, 0.7, ?)""",
                    (pattern, time.time()),
                )
            conn.commit()

            # 同时执行记忆进化
            evo_report = self._evo.nightly_reflection(list(sessions))
            report["memory_evolution"] = evo_report

            # Layer 3 知识图谱: 交叉会话聚合
            try:
                from graph.engine import get_graph_engine
                graph_stats = get_graph_engine().build_layer3_from_sessions(list(sessions))
                report["knowledge_graph_layer3"] = graph_stats
            except Exception as e:
                logger.warning("Layer 3 构建失败: %s", e)

        finally:
            conn.close()

        logger.info("夜间反思完成: %d 会话, %d 模式", len(sessions), len(report["patterns_found"]))
        return report

    # ── 快速 API ──

    def rate_answer(self, session_id: str, question: str, answer: str, rating: int, correction: str = "") -> int:
        """便捷方法：快速评分"""
        return self.record_feedback(FeedbackRecord(
            session_id=session_id,
            question=question,
            answer=answer,
            rating=rating,
            correction=correction,
        ))

    def get_my_insights(self, expert_id: str = "", limit: int = 20) -> list[dict]:
        """获取该 Expert 的反思洞察"""
        conn = _get_conn()
        try:
            rows = conn.execute(
                "SELECT * FROM discovered_patterns ORDER BY discovered_at DESC LIMIT ?",
                (limit,),
            ).fetchall()
            return [dict(r) for r in rows]
        finally:
            conn.close()
