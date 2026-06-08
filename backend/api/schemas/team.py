"""
Team Pydantic Schemas — 团队协作相关的请求/响应模型定义
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field, ConfigDict


# ============================================================
# Enums
# ============================================================

class TeamStatus(str, Enum):
    """团队状态"""
    FORMING = "forming"
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    DISBANDED = "disbanded"


class PhaseType(str, Enum):
    """Phase 类型"""
    REQUIREMENT = "requirement"
    RESEARCH = "research"
    DESIGN = "design"
    DEVELOPMENT = "development"
    REVIEW = "review"


class TaskStatus(str, Enum):
    """任务状态"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    BLOCKED = "blocked"
    DELETED = "deleted"


class MemberRole(str, Enum):
    """成员角色"""
    LEAD = "lead"
    MEMBER = "member"
    REVIEWER = "reviewer"
    OBSERVER = "observer"


# ============================================================
# Request Models
# ============================================================

class TeamCreateRequest(BaseModel):
    """创建团队请求体"""
    name: str = Field(..., min_length=1, max_length=128, description="团队名称")
    description: str = Field(default="", max_length=512, description="团队描述")
    template_id: Optional[str] = Field(default=None, description="预设模板ID")
    lead_expert_id: str = Field(default="gaia", description="Lead 专家ID")
    member_expert_ids: list[str] = Field(default_factory=list, description="成员专家ID列表")
    metadata: dict[str, Any] = Field(default_factory=dict, description="扩展元数据")

    model_config = ConfigDict(json_schema_extra={
        "examples": [
            {
                "name": "湘江流域环评审批",
                "description": "湘江流域综合治理环评审批团队",
                "template_id": "eia-approval",
                "lead_expert_id": "gaia",
                "member_expert_ids": ["eia", "env-monitoring", "enforcement", "water"],
            }
        ]
    })


class TeamUpdateRequest(BaseModel):
    """更新团队请求体"""
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TeamStatus] = None
    metadata: Optional[dict[str, Any]] = None


class TaskCreateRequest(BaseModel):
    """创建任务请求体"""
    subject: str = Field(..., min_length=1, max_length=256, description="任务标题")
    description: str = Field(default="", description="任务详细描述")
    assigned_to: Optional[str] = Field(default=None, description="分配给(专家ID)")
    phase: Optional[PhaseType] = None
    priority: int = Field(default=1, ge=0, le=5, description="优先级 0-5")
    blocked_by: list[str] = Field(default_factory=list, description="前置任务ID列表")


class TaskUpdateRequest(BaseModel):
    """更新任务请求体"""
    subject: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    assigned_to: Optional[str] = None
    progress: Optional[int] = Field(default=None, ge=0, le=100)
    metadata: Optional[dict[str, Any]] = None


class PhaseAdvanceRequest(BaseModel):
    """推进 Phase 请求体"""
    next_phase: PhaseType = Field(..., description="目标 Phase")
    notes: str = Field(default="", description="推进备注")


# ============================================================
# Response Models
# ============================================================

class MemberResponse(BaseModel):
    """团队成员响应"""
    expert_id: str
    role: MemberRole
    status: str = "online"
    joined_at: datetime = Field(default_factory=datetime.now)

    model_config = ConfigDict(from_attributes=True)


class TaskResponse(BaseModel):
    """任务响应"""
    task_id: str
    team_id: str
    subject: str
    description: str = ""
    status: TaskStatus = TaskStatus.PENDING
    assigned_to: Optional[str] = None
    phase: Optional[PhaseType] = None
    priority: int = 1
    progress: int = 0
    blocked_by: list[str] = Field(default_factory=list)
    blocks: list[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    metadata: dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(from_attributes=True)


class TeamResponse(BaseModel):
    """团队详情响应"""
    team_id: str
    name: str
    description: str = ""
    status: TeamStatus = TeamStatus.FORMING
    current_phase: Optional[PhaseType] = None
    lead_expert_id: str = "gaia"
    members: list[MemberResponse] = Field(default_factory=list)
    tasks: list[TaskResponse] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    metadata: dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(from_attributes=True)


class TeamListResponse(BaseModel):
    """团队列表响应"""
    teams: list[TeamResponse] = Field(default_factory=list)
    total: int = 0


class TeamTemplateResponse(BaseModel):
    """团队模板响应"""
    template_id: str
    name: str
    description: str
    lead_expert_id: str
    member_expert_ids: list[str]
    phases: list[PhaseType]
    default_tasks: list[dict[str, Any]] = Field(default_factory=list)
