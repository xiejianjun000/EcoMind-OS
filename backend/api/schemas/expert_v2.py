"""
L1/L2/L3 升级 — 新增 Pydantic Schema
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


# ============================================================
# L1: CrewAI 角色模型 Schema
# ============================================================

class SoulRoleSchema(BaseModel):
    """CrewAI 风格的角色定义"""
    role: str = Field(..., description="角色头衔（一句话）")
    goal: str = Field(..., description="核心目标（2-3句）")
    backstory: str = Field(..., description="详细背景故事（3-4句）")

class SoulSkillSchema(BaseModel):
    name: str
    description: Optional[str] = None

class SoulWorkflowPhase(BaseModel):
    phase: int
    title: str
    agents: list[str]
    mode: str = "sequential"  # sequential | parallel
    depends_on: list[int] = []

class SoulWorkflowSchema(BaseModel):
    name: str
    trigger: str
    phases: list[SoulWorkflowPhase]

class SoulV2Schema(BaseModel):
    """Soul v2 完整模型"""
    id: str
    name: str
    version: int = 2
    role: SoulRoleSchema
    skills: list[str] = []
    constraints: list[str] = []
    knowledge_domains: list[str] = []
    workflows: list[SoulWorkflowSchema] = []


# ============================================================
# L2: Agent 评审 Schema
# ============================================================

class ReviewVerdict(str, Enum):
    APPROVED = "approved"
    REJECTED = "rejected"
    NEEDS_REVISION = "needs_revision"
    DISPUTED = "disputed"

class ReviewType(str, Enum):
    CROSS_REVIEW = "cross_review"
    PEER_REVIEW = "peer_review"
    SUPERVISORY = "supervisory"
    TECHNICAL = "technical"

class ReviewCommentCreate(BaseModel):
    reviewer_id: str
    reviewee_id: str
    task_id: str
    review_type: ReviewType = ReviewType.CROSS_REVIEW
    verdict: ReviewVerdict
    confidence: float = Field(..., ge=0.0, le=1.0)
    issues: list[str] = []
    suggestions: list[str] = []
    agreements: list[str] = []
    data_challenge: Optional[str] = None
    law_challenge: Optional[str] = None

class ReviewCommentResponse(BaseModel):
    id: str
    reviewer_id: str
    reviewee_id: str
    task_id: str
    review_type: ReviewType
    verdict: ReviewVerdict
    confidence: float
    issues: list[str]
    suggestions: list[str]
    agreements: list[str]
    data_challenge: Optional[str] = None
    law_challenge: Optional[str] = None
    created_at: str

class ReviewSessionResponse(BaseModel):
    id: str
    task_id: str
    round: int
    comments: list[ReviewCommentResponse]
    consensus_reached: bool
    final_confidence: float
    rounds_max: int
    disagreements: list[dict] = []


# ============================================================
# L3: 技能沉淀 + 看板 Schema
# ============================================================

class SkillCategory(str, Enum):
    ANALYSIS = "analysis"
    REPORT = "report"
    LEGAL = "legal"
    TECHNICAL = "technical"
    COMMUNICATION = "communication"
    EMERGENCY = "emergency"

class SkillCreate(BaseModel):
    name: str
    description: str
    category: SkillCategory
    tags: list[str] = []
    created_by: str
    created_from_task: str = ""
    content: str
    reusable_by: list[str] = []

class SkillResponse(BaseModel):
    id: str
    name: str
    description: str
    category: SkillCategory
    tags: list[str]
    created_by: str
    created_from_task: str
    content: str
    reusable_by: list[str]
    usage_count: int
    avg_rating: float
    version: int
    created_at: str
    updated_at: str

class TaskBoardStatus(str, Enum):
    QUEUED = "queued"        # 排队
    ASSIGNED = "assigned"    # 已指派
    IN_PROGRESS = "in_progress"  # 执行中
    IN_REVIEW = "in_review"     # 评审中
    COMPLETED = "completed"
    FAILED = "failed"
    BLOCKED = "blocked"

class TaskBoardItem(BaseModel):
    id: str
    title: str
    description: str = ""
    assigned_to: Optional[str] = None  # 指派的专家 ID
    assigned_by: Optional[str] = None  # 指派人 ID
    status: TaskBoardStatus = TaskBoardStatus.QUEUED
    priority: str = "medium"
    tags: list[str] = []
    phase: int = 1
    team_id: str = ""
    review_session_id: Optional[str] = None
    skill_ids: list[str] = []
    created_at: str = ""
    updated_at: str = ""

class TaskBoardResponse(BaseModel):
    columns: dict[str, list[TaskBoardItem]]  # status → tasks
    total: int
