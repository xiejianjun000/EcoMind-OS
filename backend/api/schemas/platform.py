"""
L5-L9 补齐 — Auth + Automation + KnowledgeBase + Workspace Schemas
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field, EmailStr


# ============================================================
# L9: 用户认证
# ============================================================
class UserRole(str, Enum):
    ADMIN = "admin"
    EDITOR = "editor"
    VIEWER = "viewer"

class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: str
    password: str = Field(..., min_length=8)
    display_name: str = ""

class UserLogin(BaseModel):
    username: str
    password: str

class UserProfile(BaseModel):
    id: str
    username: str
    email: str
    display_name: str
    avatar_url: str = ""
    role: UserRole = UserRole.VIEWER
    created_at: str = ""
    last_login: str = ""

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int = 3600
    user: UserProfile


# ============================================================
# L5: 自动化引擎
# ============================================================
class AutomationTrigger(str, Enum):
    CRON = "cron"
    INTERVAL = "interval"
    ONCE = "once"

class AutomationStatus(str, Enum):
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"

class AutomationCreate(BaseModel):
    name: str
    description: str = ""
    trigger_type: AutomationTrigger
    cron_expression: str = ""       # "0 8 * * *"
    interval_minutes: int = 0       # 间隔分钟
    scheduled_at: str = ""          # ISO datetime for ONCE
    task_prompt: str                # 要执行的任务提示
    workspace: str = ""             # 工作空间
    model_id: str = "qwen3-14b"

class AutomationResponse(BaseModel):
    id: str
    name: str
    description: str
    trigger_type: AutomationTrigger
    cron_expression: str
    interval_minutes: int
    scheduled_at: str
    task_prompt: str
    workspace: str
    status: AutomationStatus = AutomationStatus.ACTIVE
    last_run: str = ""
    next_run: str = ""
    created_at: str = ""
    updated_at: str = ""


# ============================================================
# L7: 资料库 / 知识管理
# ============================================================
class NoteCreate(BaseModel):
    title: str
    content: str
    tags: list[str] = []
    workspace: str = ""
    category: str = "general"  # general/law/case/template

class NoteResponse(BaseModel):
    id: str
    title: str
    content: str
    tags: list[str]
    workspace: str
    category: str
    created_by: str
    created_at: str
    updated_at: str


# ============================================================
# L8: 工作空间
# ============================================================
class WorkspaceCreate(BaseModel):
    name: str
    description: str = ""
    icon: str = "📁"

class WorkspaceResponse(BaseModel):
    id: str
    name: str
    description: str
    icon: str
    member_count: int = 1
    task_count: int = 0
    created_by: str
    created_at: str
    updated_at: str
