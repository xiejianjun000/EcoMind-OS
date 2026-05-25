"""
Security Pydantic Schemas — 安全治理相关请求/响应模型定义
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field, ConfigDict


class SecurityEventSeverity(str, Enum):
    """安全事件严重等级"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class SecurityEventType(str, Enum):
    """安全事件类型"""
    HALLUCINATION = "hallucination"
    UNAUTHORIZED_ACCESS = "unauthorized_access"
    DATA_LEAK = "data_leak"
    INJECTION = "injection"
    POLICY_VIOLATION = "policy_violation"
    RATE_LIMIT = "rate_limit"
    COMPLIANCE = "compliance"
    ENCRYPTION = "encryption"


class ApprovalStatusResponse(str, Enum):
    """审批状态响应枚举"""
    DRAFT = "draft"
    PENDING = "pending"
    IN_REVIEW = "in_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    RETURNED = "returned"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


class SecurityEventResponse(BaseModel):
    """安全事件响应"""
    event_id: str = Field(..., description="事件唯一标识")
    event_type: SecurityEventType = Field(..., description="事件类型")
    severity: SecurityEventSeverity = Field(..., description="严重等级")
    title: str = Field(..., description="事件标题")
    description: str = Field(default="", description="事件描述")
    agent_id: Optional[str] = Field(default=None, description="关联 Agent")
    source: str = Field(default="system", description="事件来源")
    metadata: dict[str, Any] = Field(default_factory=dict)
    resolved: bool = Field(default=False, description="是否已处理")
    created_at: datetime = Field(default_factory=datetime.now)

    model_config = ConfigDict(from_attributes=True)


class SecurityEventListResponse(BaseModel):
    """安全事件列表响应"""
    events: list[SecurityEventResponse] = Field(default_factory=list)
    total: int = Field(default=0)


class ApprovalStepResponse(BaseModel):
    """审批步骤响应"""
    step_id: str = Field(..., description="步骤标识")
    step_name: str = Field(..., description="步骤名称")
    approvers: list[dict[str, str]] = Field(default_factory=list, description="审批人列表")
    required_approvers: int = Field(default=1, description="需要批准人数")
    status: ApprovalStatusResponse = Field(default=ApprovalStatusResponse.DRAFT)
    approved_by: list[str] = Field(default_factory=list)
    rejected_by: list[str] = Field(default_factory=list)
    comments: list[dict[str, Any]] = Field(default_factory=list)


class ApprovalResponse(BaseModel):
    """审批请求响应"""
    approval_id: str = Field(..., description="审批请求唯一标识")
    title: str = Field(..., description="审批标题")
    description: str = Field(default="", description="审批描述")
    requester: str = Field(..., description="申请人")
    department: str = Field(default="", description="申请部门")
    status: ApprovalStatusResponse = Field(default=ApprovalStatusResponse.DRAFT)
    steps: list[ApprovalStepResponse] = Field(default_factory=list)
    current_step: int = Field(default=0)
    metadata: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    model_config = ConfigDict(from_attributes=True)


class ApprovalListResponse(BaseModel):
    """审批列表响应"""
    approvals: list[ApprovalResponse] = Field(default_factory=list)
    total: int = Field(default=0)


class ApprovalActionRequest(BaseModel):
    """审批操作请求（通过/驳回共用）"""
    approver_id: str = Field(..., min_length=1, description="审批人标识")
    comment: str = Field(default="", max_length=1024, description="审批意见")
    step_id: Optional[str] = Field(default=None, description="指定审批步骤 ID")


class AuditRecordResponse(BaseModel):
    """审计记录响应"""
    record_id: str = Field(..., description="记录标识")
    user_id: str = Field(..., description="操作人标识")
    action: str = Field(..., description="操作类型")
    resource: str = Field(..., description="操作资源")
    timestamp: datetime = Field(default_factory=datetime.now)
    success: bool = Field(default=True, description="操作是否成功")
    details: dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(from_attributes=True)


class AuditTrailResponse(BaseModel):
    """审计日志列表响应"""
    records: list[AuditRecordResponse] = Field(default_factory=list)
    total: int = Field(default=0)
    chain_valid: bool = Field(default=True, description="哈希链是否完整")
