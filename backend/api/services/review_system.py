"""
AgentReviewSystem — Agent 间互相评审回路

实现 OpenCrew 风格的"Agent 间真协作"：
- 专家可以互相质疑、评审、确认彼此的产出
- 支持 cross_review（交叉评审）模式
- 对 disagreement 进行置信度打分
- 评审结果自动反馈给原始专家进行修正

这是 EcoMind OS L2 升级的核心模块。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional
import uuid
import logging

logger = logging.getLogger(__name__)


class ReviewVerdict(str, Enum):
    APPROVED = "approved"       # 审核通过
    REJECTED = "rejected"       # 审核不通过
    NEEDS_REVISION = "needs_revision"  # 需修正后重审
    DISPUTED = "disputed"       # 存在争议


class ReviewType(str, Enum):
    CROSS_REVIEW = "cross_review"      # 交叉评审（A审B, B审A）
    PEER_REVIEW = "peer_review"        # 同级评审
    SUPERVISORY = "supervisory"        # 上级审查（GAIA审成员）
    TECHNICAL = "technical"            # 技术审查（对口专家）


@dataclass
class ReviewComment:
    """评审意见"""
    id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    reviewer_id: str = ""           # 评审专家 ID
    reviewee_id: str = ""           # 被评审专家 ID
    task_id: str = ""               # 关联任务
    review_type: ReviewType = ReviewType.CROSS_REVIEW
    verdict: ReviewVerdict = ReviewVerdict.NEEDS_REVISION
    confidence: float = 1.0         # 评审置信度 (0-1)
    issues: list[str] = field(default_factory=list)      # 发现的问题
    suggestions: list[str] = field(default_factory=list)  # 改进建议
    agreements: list[str] = field(default_factory=list)   # 认可的点
    data_challenge: Optional[str] = None   # 数据质疑（如有）
    law_challenge: Optional[str] = None    # 法律依据质疑（如有）
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "reviewer_id": self.reviewer_id,
            "reviewee_id": self.reviewee_id,
            "task_id": self.task_id,
            "review_type": self.review_type.value,
            "verdict": self.verdict.value,
            "confidence": self.confidence,
            "issues": self.issues,
            "suggestions": self.suggestions,
            "agreements": self.agreements,
            "data_challenge": self.data_challenge,
            "law_challenge": self.law_challenge,
            "created_at": self.created_at,
        }


@dataclass
class ReviewSession:
    """一次评审会话"""
    id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    task_id: str = ""
    round: int = 0                      # 评审轮次
    comments: list[ReviewComment] = field(default_factory=list)
    consensus_reached: bool = False
    final_confidence: float = 0.0
    rounds_max: int = 3                 # 最多评审轮次
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "task_id": self.task_id,
            "round": self.round,
            "comments": [c.to_dict() for c in self.comments],
            "consensus_reached": self.consensus_reached,
            "final_confidence": self.final_confidence,
            "rounds_max": self.rounds_max,
            "created_at": self.created_at,
        }


class AgentReviewSystem:
    """
    Agent 间评审系统

    核心原则（来自 OpenCrew）：
    1. Agent 之间可以互相触发 — A 产出 → B 评审 → A 修正
    2. 评审不是单向流水线 — 被评审方可对评审意见提出反驳
    3. 最多 3 轮评审 — 防止无限循环
    4. 置信度驱动 — 低置信度产出自动触发评审
    """

    def __init__(self, max_rounds: int = 3):
        self.max_rounds = max_rounds
        self._sessions: dict[str, ReviewSession] = {}

    def start_review(self, task_id: str, reviewer_ids: list[str], reviewee_id: str) -> ReviewSession:
        """发起一次评审会话"""
        session = ReviewSession(task_id=task_id, rounds_max=self.max_rounds)
        self._sessions[session.id] = session
        logger.info(f"评审会话启动: {session.id} | 评审人: {reviewer_ids} | 被评: {reviewee_id}")
        return session

    def add_comment(self, session_id: str, comment: ReviewComment) -> ReviewSession:
        """添加评审意见"""
        session = self._sessions.get(session_id)
        if not session:
            raise ValueError(f"评审会话不存在: {session_id}")

        session.comments.append(comment)
        session.round = len(session.comments)

        # 检查是否达成共识
        approvals = [c for c in session.comments if c.verdict == ReviewVerdict.APPROVED]
        rejections = [c for c in session.comments if c.verdict == ReviewVerdict.REJECTED]

        if len(approvals) == len(session.comments):
            session.consensus_reached = True
            session.final_confidence = sum(c.confidence for c in approvals) / len(approvals)
            logger.info(f"评审达成共识: {session.id} | 置信度: {session.final_confidence:.2f}")
        elif session.round >= self.max_rounds:
            session.consensus_reached = False
            logger.warning(f"评审达到最大轮次: {session.id} | 仍存在分歧")

        return session

    def get_disagreements(self, session_id: str) -> list[dict]:
        """提取评审中的分歧点"""
        session = self._sessions.get(session_id)
        if not session:
            return []

        disagreements = []
        for c in session.comments:
            if c.data_challenge:
                disagreements.append({"type": "data", "reviewer": c.reviewer_id, "detail": c.data_challenge})
            if c.law_challenge:
                disagreements.append({"type": "law", "reviewer": c.reviewer_id, "detail": c.law_challenge})
        return disagreements

    def get_session(self, session_id: str) -> Optional[ReviewSession]:
        return self._sessions.get(session_id)


# 全局单例
_review_system: Optional[AgentReviewSystem] = None


def get_review_system() -> AgentReviewSystem:
    global _review_system
    if _review_system is None:
        _review_system = AgentReviewSystem()
    return _review_system
