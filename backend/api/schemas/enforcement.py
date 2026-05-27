"""
Enforcement Pydantic Schemas — 环保执法案件相关的请求/响应模型定义
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Optional

from pydantic import BaseModel, Field, ConfigDict


class CaseStage(str, Enum):
    """案件办理阶段枚举"""
    CLUE = "线索"
    ACCEPT = "受理"
    FILING = "立案"
    INVESTIGATE = "调查"
    INFORM = "告知"
    DECISION = "决定"
    EXECUTE = "执行"
    ARCHIVE = "归档"


class CaseSource(str, Enum):
    """案件来源枚举"""
    MONITOR = "monitor"
    REPORT = "report"
    PATROL = "patrol"
    ASSIGN = "assign"
    OTHER = "other"


class CaseSeverity(str, Enum):
    """案件严重程度枚举"""
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class CaseCreateRequest(BaseModel):
    """创建案件请求体"""
    title: str = Field(..., min_length=1, max_length=256, description="案件标题")
    source: CaseSource = Field(..., description="案件来源")
    severity: CaseSeverity = Field(..., description="严重程度")
    enterprise_name: str = Field(..., min_length=1, max_length=256, description="企业名称")
    credit_code: Optional[str] = Field(default=None, max_length=64, description="统一社会信用代码")
    legal_person: Optional[str] = Field(default=None, max_length=64, description="法定代表人")
    violation: str = Field(..., min_length=1, description="违法事实描述")
    city: str = Field(..., min_length=1, max_length=64, description="所属城市")
    officers: list[str] = Field(default_factory=list, description="执法人员列表")

    model_config = ConfigDict(json_schema_extra={
        "examples": [
            {
                "title": "某化工企业超标排放废水案",
                "source": "monitor",
                "severity": "high",
                "enterprise_name": "XX化工有限公司",
                "credit_code": "91110000XXXXXXXXXX",
                "legal_person": "张三",
                "violation": "在线监测数据显示COD连续超标排放",
                "city": "长沙市",
                "officers": ["李四", "王五"],
            }
        ]
    })


class CaseTransitionRequest(BaseModel):
    """案件阶段流转请求体"""
    target_stage: CaseStage = Field(..., description="目标阶段")
    comment: Optional[str] = Field(default=None, description="流转备注")
    operator: str = Field(..., min_length=1, max_length=64, description="操作人")


class CaseResponse(BaseModel):
    """案件详情响应"""
    id: str = Field(..., description="案件唯一标识")
    case_number: str = Field(..., description="案件编号")
    title: str = Field(..., description="案件标题")
    source: CaseSource = Field(..., description="案件来源")
    stage: CaseStage = Field(default=CaseStage.CLUE, description="当前阶段")
    severity: CaseSeverity = Field(..., description="严重程度")
    enterprise_name: str = Field(..., description="企业名称")
    credit_code: Optional[str] = Field(default=None, description="统一社会信用代码")
    legal_person: Optional[str] = Field(default=None, description="法定代表人")
    violation: str = Field(..., description="违法事实描述")
    law_clauses: list[str] = Field(default_factory=list, description="适用法律条款")
    city: str = Field(..., description="所属城市")
    amount: Optional[float] = Field(default=None, description="处罚金额")
    officers: list[str] = Field(default_factory=list, description="执法人员列表")
    approval_request_id: Optional[str] = Field(default=None, description="关联审批请求 ID")
    timeline: list[dict[str, Any]] = Field(default_factory=list, description="案件时间线")
    attachments: list[dict[str, Any]] = Field(default_factory=list, description="附件列表")
    created_at: datetime = Field(default_factory=datetime.now, description="创建时间")
    updated_at: datetime = Field(default_factory=datetime.now, description="更新时间")

    model_config = ConfigDict(from_attributes=True)
