"""
EcoMind 记忆进化引擎 — 让记忆"越记越聪明"

实现三个核心能力对标 Hermes Curator + Openclaw Dreaming：
  1. 记忆蒸馏 — 从多次对话中自动提取模式，合并重复记忆
  2. 冲突检测 — 发现新旧记忆矛盾时自动标记
  3. 遗忘曲线 — 不常用的记忆自动降权

Usage:
    from engine.memory_evolution import MemoryEvolution
    evo = MemoryEvolution()
    await evo.distill(session_id)
    conflicts = evo.detect_conflicts()
    evo.apply_decay()
"""
from __future__ import annotations

import json
import logging
import math
import sqlite3
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "hermes_memory.db"


def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def _ensure_schema():
    conn = _get_conn()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS memory_embeddings (
            memory_id INTEGER PRIMARY KEY,
            embedding TEXT NOT NULL,
            model TEXT DEFAULT 'text-similarity',
            created_at REAL
        );
        CREATE TABLE IF NOT EXISTS memory_distillations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_ids TEXT NOT NULL,
            distilled_content TEXT NOT NULL,
            confidence REAL DEFAULT 0.5,
            created_at REAL,
            session_id TEXT
        );
        CREATE TABLE IF NOT EXISTS memory_conflicts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            memory_a_id INTEGER NOT NULL,
            memory_b_id INTEGER NOT NULL,
            conflict_type TEXT DEFAULT 'contradiction',
            description TEXT,
            resolved INTEGER DEFAULT 0,
            resolution TEXT,
            detected_at REAL,
            resolved_at REAL
        );
        CREATE TABLE IF NOT EXISTS memory_access_log (
            memory_id INTEGER NOT NULL,
            accessed_at REAL,
            context TEXT DEFAULT '',
            session_id TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_access_memory ON memory_access_log(memory_id);
        CREATE INDEX IF NOT EXISTS idx_access_time ON memory_access_log(accessed_at);
    """)
    conn.commit()
    conn.close()


_ensure_schema()


@dataclass
class MemoryScore:
    memory_id: int
    raw_trust: float
    decay_factor: float
    access_frequency: float
    recency_score: float
    final_score: float


class MemoryEvolution:
    """记忆进化引擎"""

    def __init__(self):
        pass

    # ── 记忆蒸馏 ──

    def distill(self, session_id: str, min_similarity: float = 0.75) -> list[int]:
        """
        从一次会话中提取可蒸馏的记忆模式。

        规则:
          1. 找到同一 session 中内容相似（关键词重叠度 > min_similarity）的记忆
          2. 合并为一条更精炼的记忆
          3. 置信度取多条记忆的平均 trust
        """
        conn = _get_conn()
        distilled_ids: list[int] = []

        try:
            rows = conn.execute(
                "SELECT id, content, trust FROM memories WHERE session_id = ? ORDER BY id",
                (session_id,),
            ).fetchall()

            if len(rows) < 2:
                return []

            merged = set()
            for i in range(len(rows)):
                if i in merged:
                    continue
                group = [rows[i]]
                words_i = set(rows[i]["content"].lower().split())

                for j in range(i + 1, len(rows)):
                    if j in merged:
                        continue
                    words_j = set(rows[j]["content"].lower().split())
                    if not words_i or not words_j:
                        continue
                    overlap = len(words_i & words_j) / min(len(words_i), len(words_j))
                    if overlap >= min_similarity:
                        group.append(rows[j])
                        merged.add(j)

                if len(group) >= 2:
                    merged.add(i)
                    source_ids = [r["id"] for r in group]
                    avg_trust = sum(r["trust"] for r in group) / len(group)
                    distilled = self._merge_content([r["content"] for r in group])

                    conn.execute(
                        """INSERT INTO memory_distillations
                           (source_ids, distilled_content, confidence, created_at, session_id)
                           VALUES (?, ?, ?, ?, ?)""",
                        (json.dumps(source_ids), distilled, avg_trust, time.time(), session_id),
                    )
                    conn.commit()
                    distilled_ids.extend(source_ids)
                    logger.info(
                        "蒸馏: %d条记忆→1条 (置信度=%.2f)", len(group), avg_trust
                    )

        finally:
            conn.close()

        return distilled_ids

    def _merge_content(self, contents: list[str]) -> str:
        """合并多条相似内容为一条精炼版本——取最全面的那条"""
        if not contents:
            return ""
        if len(contents) == 1:
            return contents[0]
        sorted_by_len = sorted(contents, key=len, reverse=True)
        longest = sorted_by_len[0]
        if len(longest) > 200:
            return longest
        return "; ".join(sorted_by_len[:3])

    # ── 冲突检测 ──

    def detect_conflicts(self) -> list[dict[str, Any]]:
        """
        扫描所有记忆，检测语义冲突。

        当前使用关键词级别的简单冲突检测：
          - 包含否定词（不/非/未/已取消/已废止）且之前有肯定版本
          - 或同一 entity 的 fact 互相矛盾
        """
        conn = _get_conn()
        conflicts: list[dict[str, Any]] = []

        try:
            all_memories = conn.execute(
                "SELECT id, content, category, trust FROM memories ORDER BY id"
            ).fetchall()

            NEGATION_WORDS = {"不", "非", "未", "已取消", "已废止", "已废除", "禁止", "严禁"}

            for i in range(len(all_memories)):
                a = all_memories[i]
                words_a = set(a["content"].lower().split())

                for j in range(i + 1, len(all_memories)):
                    b = all_memories[j]
                    words_b = set(b["content"].lower().split())

                    # 检测否定冲突：一条有否定词，另一条没有
                    has_neg_a = bool(words_a & NEGATION_WORDS)
                    has_neg_b = bool(words_b & NEGATION_WORDS)

                    if has_neg_a != has_neg_b:
                        # 主体相同但结论不同
                        common = words_a & words_b
                        if len(common) > 3 and common != NEGATION_WORDS:
                            desc = (
                                f"冲突: [{a['id']}] 「{a['content'][:80]}」 vs "
                                f"[{b['id']}] 「{b['content'][:80]}」"
                            )
                            conflicts.append({
                                "memory_a_id": a["id"],
                                "memory_b_id": b["id"],
                                "type": "contradiction",
                                "description": desc,
                                "trust_a": a["trust"],
                                "trust_b": b["trust"],
                            })

                            conn.execute(
                                """INSERT OR IGNORE INTO memory_conflicts
                                   (memory_a_id, memory_b_id, conflict_type, description, detected_at)
                                   VALUES (?, ?, 'contradiction', ?, ?)""",
                                (a["id"], b["id"], desc, time.time()),
                            )

                    if len(conflicts) >= 20:
                        break

            if conflicts:
                conn.commit()
                logger.warning("检测到 %d 处记忆冲突", len(conflicts))

        finally:
            conn.close()

        return conflicts

    # ── 遗忘曲线 ──

    def apply_decay(self, half_life_days: float = 30.0) -> list[MemoryScore]:
        """
        对最近未访问的记忆应用遗忘曲线。

        Ebbinghaus 遗忘曲线简化版：
          final_trust = raw_trust × (0.5 ^ (days_since / half_life_days))

        同时也考虑访问频率——被频繁回忆的记忆不应遗忘。
        """
        conn = _get_conn()
        scores: list[MemoryScore] = []
        now = time.time()

        try:
            rows = conn.execute(
                "SELECT id, content, trust FROM memories"
            ).fetchall()

            for row in rows:
                mid = row["id"]
                raw_trust = row["trust"] or 1.0

                # 计算最近访问时间
                access_row = conn.execute(
                    "SELECT MAX(accessed_at) as last_access, COUNT(*) as access_count "
                    "FROM memory_access_log WHERE memory_id = ?",
                    (mid,),
                ).fetchone()

                last_access = access_row["last_access"] if access_row else None
                if last_access is None:
                    last_access = 0
                access_count = access_row["access_count"] if access_row else 0
                if access_count is None:
                    access_count = 0

                # 衰减计算
                if last_access > 0:
                    days_since = (now - last_access) / 86400.0
                    decay = math.pow(0.5, days_since / half_life_days)
                    # 高频访问的记忆减缓衰减
                    freq_bonus = min(1.0 + math.log(1 + access_count) * 0.1, 1.5)
                    decay = min(decay * freq_bonus, 1.0)
                else:
                    # 从未被访问过的记忆——轻微衰减
                    decay = 0.9

                recency = 1.0 / (1.0 + (now - last_access) / 86400.0 / half_life_days)

                final_score = raw_trust * decay

                # 仅当显著变化时才更新
                if abs(final_score - raw_trust) > 0.05:
                    conn.execute(
                        "UPDATE memories SET trust = ?, updated_at = ? WHERE id = ?",
                        (round(final_score, 4), now, mid),
                    )

                scores.append(MemoryScore(
                    memory_id=mid,
                    raw_trust=raw_trust,
                    decay_factor=round(decay, 3),
                    access_frequency=access_count,
                    recency_score=round(recency, 3),
                    final_score=round(final_score, 4),
                ))

            conn.commit()

            low_score = [s for s in scores if s.final_score < 0.3]
            if low_score:
                logger.info(
                    "遗忘曲线: %d 条记忆 trust < 0.3 (将被忽略), %d 条总计",
                    len(low_score), len(scores),
                )

        finally:
            conn.close()

        return scores

    # ── 访问记录 ──

    def record_access(self, memory_id: int, context: str = "", session_id: str = "") -> None:
        """记录一次记忆被访问（用于计算遗忘曲线）"""
        conn = _get_conn()
        try:
            conn.execute(
                "INSERT INTO memory_access_log (memory_id, accessed_at, context, session_id) "
                "VALUES (?, ?, ?, ?)",
                (memory_id, time.time(), context, session_id),
            )
            conn.commit()
        finally:
            conn.close()

    # ── 夜间反思 ──

    def nightly_reflection(self, session_ids: list[str]) -> dict[str, Any]:
        """
        夜间反思（对标 Openclaw Dreaming）：
          1. 蒸馏最近会话的记忆
          2. 检测冲突
          3. 应用遗忘曲线
          4. 返回反思报告
        """
        report = {
            "timestamp": datetime.now().isoformat(),
            "distilled": 0,
            "conflicts": 0,
            "decayed": 0,
            "insights": [],
        }

        # 蒸馏
        for sid in session_ids:
            ids = self.distill(sid)
            report["distilled"] += len(ids)

        # 冲突检测
        conflicts = self.detect_conflicts()
        report["conflicts"] = len(conflicts)
        for c in conflicts:
            report["insights"].append(c["description"])

        # 遗忘
        scores = self.apply_decay()
        report["decayed"] = len([s for s in scores if s.final_score < s.raw_trust])

        logger.info("夜间反思完成: %s", {k: v for k, v in report.items() if k != "insights"})
        return report
