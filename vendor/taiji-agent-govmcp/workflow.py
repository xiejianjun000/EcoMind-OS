"""
政务审批工作流
实现多级审批、会签、电子签章等功能
"""

from __future__ import annotations

import asyncio
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Optional


class ApprovalStatus(Enum):
    """审批状态"""
    DRAFT = "draft"           # 草稿
    PENDING = "pending"       # 待审批
    IN_REVIEW = "in_review"   # 审批中
    APPROVED = "approved"     # 已批准
    REJECTED = "rejected"     # 已拒绝
    RETURNED = "returned"     # 已退回
    CANCELLED = "cancelled"   # 已取消
    COMPLETED = "completed"   # 已完成


class ApprovalAction(Enum):
    """审批操作"""
    SUBMIT = "submit"         # 提交
    APPROVE = "approve"       # 批准
    REJECT = "reject"         # 拒绝
    RETURN = "return"         # 退回
    CANCEL = "cancel"         # 取消
    ESCALATE = "escalate"     # 升级


@dataclass
class Approver:
    """审批人"""
    user_id: str
    name: str
    role: str
    department: str
    approval_order: int = 0


@dataclass
class ApprovalStep:
    """审批步骤"""
    step_id: str
    step_name: str
    approvers: list[Approver]
    required_approvers: int = 1  # 需要批准人数
    status: ApprovalStatus = ApprovalStatus.DRAFT
    approved_by: list[str] = field(default_factory=list)
    rejected_by: list[str] = field(default_factory=list)
    comments: list[dict] = field(default_factory=list)


@dataclass
class ApprovalRequest:
    """审批请求"""
    request_id: str
    title: str
    description: str
    requester: str
    department: str
    status: ApprovalStatus = ApprovalStatus.DRAFT
    steps: list[ApprovalStep] = field(default_factory=list)
    current_step: int = 0
    metadata: dict[str, Any] = field(default_factory=dict)
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)


@dataclass
class ApprovalDecision:
    """审批决策"""
    request_id: str
    step_id: str
    approver_id: str
    action: ApprovalAction
    comment: str
    timestamp: float = field(default_factory=time.time)
    digital_signature: Optional[str] = None


class ApprovalWorkflow:
    """审批工作流"""

    def __init__(self):
        self._requests: dict[str, ApprovalRequest] = {}
        self._decisions: dict[str, list[ApprovalDecision]] = {}
        self._workflows: dict[str, list[ApprovalStep]] = {}
        self._callbacks: dict[str, list[Callable]] = {}

    def register_workflow(self, workflow_id: str, steps: list[ApprovalStep]):
        """注册工作流模板"""
        self._workflows[workflow_id] = steps
        logger.info(f"Workflow registered: {workflow_id}")

    def create_request(
        self,
        title: str,
        description: str,
        requester: str,
        department: str,
        workflow_id: str = "default",
        metadata: Optional[dict[str, Any]] = None,
    ) -> ApprovalRequest:
        """创建审批请求"""
        request_id = str(uuid.uuid4())
        
        steps = self._workflows.get(workflow_id, [
            ApprovalStep(
                step_id="step-1",
                step_name="部门主管审批",
                approvers=[Approver(
                    user_id="manager",
                    name="部门主管",
                    role="manager",
                    department=department,
                    approval_order=0,
                )],
            )
        ])
        
        request = ApprovalRequest(
            request_id=request_id,
            title=title,
            description=description,
            requester=requester,
            department=department,
            status=ApprovalStatus.DRAFT,
            steps=steps,
            metadata=metadata or {},
        )
        
        self._requests[request_id] = request
        self._decisions[request_id] = []
        
        return request

    async def submit_request(self, request_id: str) -> ApprovalRequest:
        """提交审批请求"""
        request = self._requests.get(request_id)
        if not request:
            raise ValueError(f"Request not found: {request_id}")
        
        request.status = ApprovalStatus.PENDING
        request.current_step = 0
        
        if len(request.steps) > 0:
            request.steps[0].status = ApprovalStatus.IN_REVIEW
        
        request.updated_at = time.time()
        
        await self._trigger_callbacks("submit", request)
        
        logger.info(f"Request submitted: {request_id}")
        return request

    async def approve(
        self,
        request_id: str,
        approver_id: str,
        comment: str = "",
        step_id: Optional[str] = None,
    ) -> ApprovalDecision:
        """批准请求"""
        request = self._requests.get(request_id)
        if not request:
            raise ValueError(f"Request not found: {request_id}")
        
        step_index = self._find_step(request, step_id)
        if step_index is None:
            raise ValueError(f"Step not found: {step_id}")
        
        step = request.steps[step_index]
        decision = ApprovalDecision(
            request_id=request_id,
            step_id=step.step_id,
            approver_id=approver_id,
            action=ApprovalAction.APPROVE,
            comment=comment,
        )
        
        step.approved_by.append(approver_id)
        step.comments.append({
            "approver": approver_id,
            "action": "approve",
            "comment": comment,
            "timestamp": decision.timestamp,
        })
        
        self._decisions[request_id].append(decision)
        
        # 检查是否完成当前步骤
        if len(step.approved_by) >= step.required_approvers:
            step.status = ApprovalStatus.APPROVED
            
            # 进入下一步
            if step_index < len(request.steps) - 1:
                request.current_step = step_index + 1
                request.steps[step_index + 1].status = ApprovalStatus.IN_REVIEW
            else:
                # 所有步骤完成
                request.status = ApprovalStatus.COMPLETED
        
        request.updated_at = time.time()
        
        await self._trigger_callbacks("approve", request)
        
        return decision

    async def reject(
        self,
        request_id: str,
        approver_id: str,
        comment: str = "",
        step_id: Optional[str] = None,
    ) -> ApprovalDecision:
        """拒绝请求"""
        request = self._requests.get(request_id)
        if not request:
            raise ValueError(f"Request not found: {request_id}")
        
        step_index = self._find_step(request, step_id)
        if step_index is None:
            raise ValueError(f"Step not found: {step_id}")
        
        step = request.steps[step_index]
        decision = ApprovalDecision(
            request_id=request_id,
            step_id=step.step_id,
            approver_id=approver_id,
            action=ApprovalAction.REJECT,
            comment=comment,
        )
        
        step.rejected_by.append(approver_id)
        step.status = ApprovalStatus.REJECTED
        request.status = ApprovalStatus.REJECTED
        
        step.comments.append({
            "approver": approver_id,
            "action": "reject",
            "comment": comment,
            "timestamp": decision.timestamp,
        })
        
        self._decisions[request_id].append(decision)
        request.updated_at = time.time()
        
        await self._trigger_callbacks("reject", request)
        
        return decision

    async def return_request(
        self,
        request_id: str,
        approver_id: str,
        comment: str = "",
        return_to_step: int = 0,
    ) -> ApprovalDecision:
        """退回请求"""
        request = self._requests.get(request_id)
        if not request:
            raise ValueError(f"Request not found: {request_id}")
        
        decision = ApprovalDecision(
            request_id=request_id,
            step_id=request.steps[request.current_step].step_id,
            approver_id=approver_id,
            action=ApprovalAction.RETURN,
            comment=comment,
        )
        
        request.status = ApprovalStatus.RETURNED
        request.current_step = return_to_step
        request.steps[return_to_step].status = ApprovalStatus.DRAFT
        request.updated_at = time.time()
        
        self._decisions[request_id].append(decision)
        
        await self._trigger_callbacks("return", request)
        
        return decision

    async def cancel(self, request_id: str, requester_id: str):
        """取消请求"""
        request = self._requests.get(request_id)
        if not request:
            raise ValueError(f"Request not found: {request_id}")
        
        request.status = ApprovalStatus.CANCELLED
        request.updated_at = time.time()
        
        await self._trigger_callbacks("cancel", request)

    def get_request(self, request_id: str) -> Optional[ApprovalRequest]:
        """获取审批请求"""
        return self._requests.get(request_id)

    def list_requests(
        self,
        user_id: Optional[str] = None,
        status: Optional[ApprovalStatus] = None,
        department: Optional[str] = None,
    ) -> list[ApprovalRequest]:
        """列出审批请求"""
        requests = list(self._requests.values())
        
        if user_id:
            requests = [
                r for r in requests
                if r.requester == user_id
                or any(a.user_id == user_id for s in r.steps for a in s.approvers)
            ]
        
        if status:
            requests = [r for r in requests if r.status == status]
        
        if department:
            requests = [r for r in requests if r.department == department]
        
        return sorted(requests, key=lambda r: r.updated_at, reverse=True)

    def get_decisions(self, request_id: str) -> list[ApprovalDecision]:
        """获取审批决策历史"""
        return self._decisions.get(request_id, [])

    def on_event(self, event: str, callback: Callable):
        """注册事件回调"""
        if event not in self._callbacks:
            self._callbacks[event] = []
        self._callbacks[event].append(callback)

    async def _trigger_callbacks(self, event: str, request: ApprovalRequest):
        """触发事件回调"""
        if event in self._callbacks:
            for callback in self._callbacks[event]:
                if asyncio.iscoroutinefunction(callback):
                    await callback(request)
                else:
                    callback(request)

    def _find_step(
        self,
        request: ApprovalRequest,
        step_id: Optional[str] = None,
    ) -> Optional[int]:
        """查找步骤索引"""
        if step_id:
            for i, step in enumerate(request.steps):
                if step.step_id == step_id:
                    return i
            return None
        return request.current_step


class CounterSignManager:
    """会签管理器"""

    def __init__(self):
        self._countersign_requests: dict[str, dict] = {}

    def create_countersign(
        self,
        request_id: str,
        title: str,
        required_signers: list[str],
    ):
        """创建会签"""
        self._countersign_requests[request_id] = {
            "request_id": request_id,
            "title": title,
            "required_signers": required_signers,
            "signed_by": [],
            "status": "pending",
        }

    async def sign(self, request_id: str, signer_id: str):
        """签署"""
        cs = self._countersign_requests.get(request_id)
        if not cs:
            return
        
        if signer_id in cs["required_signers"] and signer_id not in cs["signed_by"]:
            cs["signed_by"].append(signer_id)
            
            if len(cs["signed_by"]) == len(cs["required_signers"]):
                cs["status"] = "completed"


# 日志配置
import logging
logger = logging.getLogger(__name__)


__all__ = [
    "ApprovalStatus",
    "ApprovalAction",
    "Approver",
    "ApprovalStep",
    "ApprovalRequest",
    "ApprovalDecision",
    "ApprovalWorkflow",
    "CounterSignManager",
]
