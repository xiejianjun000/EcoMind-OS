"""
Approval Pydantic Schemas — 环评审批模块请求/响应模型定义
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field, ConfigDict


class ApprovalType(str, Enum):
    """审批类型枚举"""
    EIA = "环评报告"
    DISCHARGE = "排污许可"
    COMPLETION = "竣工验收"


class ApprovalLevel(str, Enum):
    """审批级别枚举"""
    L1 = "L1-科员"
    L2 = "L2-处长"
    L3 = "L3-厅领导"


class ApprovalStatus(str, Enum):
    """审批状态枚举"""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    RETURNED = "returned"


class ApprovalCreate(BaseModel):
    """创建审批请求体"""
    title: str = Field(..., min_length=1, max_length=256, description="审批标题")
    approval_type: ApprovalType = Field(..., description="审批类型")
    applicant: str = Field(..., min_length=1, max_length=64, description="申请人")
    department: str = Field(..., min_length=1, max_length=128, description="申请部门")
    enterprise_name: str = Field(..., min_length=1, max_length=256, description="企业名称")
    credit_code: Optional[str] = Field(default=None, max_length=64, description="统一社会信用代码")
    content: str = Field(..., min_length=1, description="审批内容摘要")
    attachments: list[dict[str, Any]] = Field(default_factory=list, description="附件列表")

    model_config = ConfigDict(json_schema_extra={
        "examples": [
            {
                "title": "XX化工有限公司环评报告审批",
                "approval_type": "环评报告",
                "applicant": "张三",
                "department": "环评处",
                "enterprise_name": "XX化工有限公司",
                "credit_code": "91110000XXXXXXXXXX",
                "content": "年产10万吨化工产品项目环境影响评价报告书",
                "attachments": [],
            }
        ]
    })


class ApprovalTransition(BaseModel):
    """审批流转请求体"""
    action: str = Field(..., description="操作类型: approve/reject/return")
    comment: Optional[str] = Field(default=None, description="审批意见")
    operator: str = Field(..., min_length=1, max_length=64, description="操作人")


class ApprovalListParams(BaseModel):
    """审批列表查询参数"""
    approval_type: Optional[str] = Field(default=None, description="按审批类型过滤")
    status: Optional[str] = Field(default=None, description="按状态过滤")
    level: Optional[str] = Field(default=None, description="按审批级别过滤")
    department: Optional[str] = Field(default=None, description="按部门过滤")
    limit: int = Field(default=100, ge=1, le=500, description="返回数量上限")
    offset: int = Field(default=0, ge=0, description="偏移量")


class ApprovalResponse(BaseModel):
    """审批详情响应"""
    id: str = Field(..., description="审批唯一标识")
    approval_number: str = Field(..., description="审批编号")
    title: str = Field(..., description="审批标题")
    approval_type: ApprovalType = Field(..., description="审批类型")
    status: ApprovalStatus = Field(default=ApprovalStatus.PENDING, description="当前状态")
    level: ApprovalLevel = Field(default=ApprovalLevel.L1, description="当前审批级别")
    applicant: str = Field(..., description="申请人")
    department: str = Field(..., description="申请部门")
    enterprise_name: str = Field(..., description="企业名称")
    credit_code: Optional[str] = Field(default=None, description="统一社会信用代码")
    content: str = Field(..., description="审批内容摘要")
    attachments: list[dict[str, Any]] = Field(default_factory=list, description="附件列表")
    timeline: list[dict[str, Any]] = Field(default_factory=list, description="审批时间线")
    audit_log: list[dict[str, Any]] = Field(default_factory=list, description="审计日志")
    created_at: datetime = Field(default_factory=datetime.now, description="创建时间")
    updated_at: datetime = Field(default_factory=datetime.now, description="更新时间")

    model_config = ConfigDict(from_attributes=True)
