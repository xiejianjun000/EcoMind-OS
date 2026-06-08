"""
TeamService — 团队协作业务逻辑服务

管理团队生命周期：创建 → 组装 → 执行 → 完成
支持 Phase 门禁、任务分配、进度追踪。
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime
from typing import Optional

from api.schemas.team import (
    MemberRole,
    MemberResponse,
    PhaseAdvanceRequest,
    PhaseType,
    TaskCreateRequest,
    TaskResponse,
    TaskStatus,
    TaskUpdateRequest,
    TeamCreateRequest,
    TeamListResponse,
    TeamResponse,
    TeamStatus,
    TeamTemplateResponse,
    TeamUpdateRequest,
)

logger = logging.getLogger(__name__)

# ============================================================
# Pre-defined Team Templates (3 templates)
# ============================================================

TEAM_TEMPLATES: dict[str, dict] = {
    "eia-approval": {
        "template_id": "eia-approval",
        "name": "环评审批团队",
        "description": "环境影响评价技术审查与审批协作",
        "lead_expert_id": "gaia",
        "member_expert_ids": ["eia", "env-monitoring", "enforcement", "public"],
        "phases": [PhaseType.REQUIREMENT, PhaseType.RESEARCH, PhaseType.DESIGN, PhaseType.REVIEW],
        "default_tasks": [
            {"subject": "需求澄清", "phase": "requirement", "assigned_to": "gaia"},
            {"subject": "竞品与标准调研", "phase": "research", "assigned_to": "eia"},
            {"subject": "技术审查设计", "phase": "design", "assigned_to": "eia"},
            {"subject": "合规性校验", "phase": "development", "assigned_to": "enforcement"},
            {"subject": "审查报告输出", "phase": "review", "assigned_to": "gaia"},
        ],
    },
    "emergency-response": {
        "template_id": "emergency-response",
        "name": "应急响应团队",
        "description": "突发环境事件快速响应与处置",
        "lead_expert_id": "emergency",
        "member_expert_ids": ["env-monitoring", "enforcement", "water", "public"],
        "phases": [PhaseType.REQUIREMENT, PhaseType.DESIGN, PhaseType.DEVELOPMENT, PhaseType.REVIEW],
        "default_tasks": [
            {"subject": "事件研判", "phase": "requirement", "assigned_to": "emergency"},
            {"subject": "应急方案制定", "phase": "design", "assigned_to": "emergency"},
            {"subject": "资源调度执行", "phase": "development", "assigned_to": "env-monitoring"},
            {"subject": "处置报告总结", "phase": "review", "assigned_to": "emergency"},
        ],
    },
    "ecological-inspection": {
        "template_id": "ecological-inspection",
        "name": "生态督察团队",
        "description": "生态环境保护督察辅助与整改跟踪",
        "lead_expert_id": "inspection",
        "member_expert_ids": ["enforcement", "eia", "env-monitoring", "water"],
        "phases": [PhaseType.REQUIREMENT, PhaseType.RESEARCH, PhaseType.DESIGN, PhaseType.DEVELOPMENT, PhaseType.REVIEW],
        "default_tasks": [
            {"subject": "线索梳理", "phase": "requirement", "assigned_to": "inspection"},
            {"subject": "问题调研", "phase": "research", "assigned_to": "env-monitoring"},
            {"subject": "整改方案设计", "phase": "design", "assigned_to": "eia"},
            {"subject": "整改跟踪执行", "phase": "development", "assigned_to": "enforcement"},
            {"subject": "督察报告输出", "phase": "review", "assigned_to": "inspection"},
        ],
    },
}


class TeamRecord:
    """团队运行时记录"""

    def __init__(
        self,
        team_id: str,
        name: str,
        description: str = "",
        lead_expert_id: str = "gaia",
        member_expert_ids: list[str] | None = None,
        metadata: dict | None = None,
    ):
        self.team_id = team_id
        self.name = name
        self.description = description
        self.status = TeamStatus.FORMING
        self.current_phase: Optional[PhaseType] = None
        self.lead_expert_id = lead_expert_id
        self.members: list[MemberResponse] = []
        self.tasks: list[TaskResponse] = []
        self.created_at = datetime.now()
        self.updated_at = datetime.now()
        self.metadata = metadata or {}

        # Build members
        all_ids = [lead_expert_id] + (member_expert_ids or [])
        for eid in all_ids:
            role = MemberRole.LEAD if eid == lead_expert_id else MemberRole.MEMBER
            self.members.append(
                MemberResponse(expert_id=eid, role=role, joined_at=datetime.now())
            )


class TaskRecord:
    """任务运行时记录"""

    def __init__(
        self,
        task_id: str,
        team_id: str,
        subject: str,
        description: str = "",
        assigned_to: str | None = None,
        phase: PhaseType | None = None,
        priority: int = 1,
        blocked_by: list[str] | None = None,
    ):
        self.task_id = task_id
        self.team_id = team_id
        self.subject = subject
        self.description = description
        self.status = TaskStatus.PENDING
        self.assigned_to = assigned_to
        self.phase = phase
        self.priority = priority
        self.progress = 0
        self.blocked_by = blocked_by or []
        self.blocks: list[str] = []
        self.created_at = datetime.now()
        self.updated_at = datetime.now()
        self.metadata: dict = {}


class TeamService:
    """
    团队协作服务

    管理 Team 的创建、组装、Phase 推进、任务分配。
    """

    def __init__(self):
        self._teams: dict[str, TeamRecord] = {}
        self._tasks: dict[str, TaskRecord] = {}

    # ============================================================
    # Team CRUD
    # ============================================================

    async def create_team(self, request: TeamCreateRequest) -> TeamResponse:
        """创建团队"""
        team_id = f"team-{uuid.uuid4().hex[:8]}"

        # If template specified, merge template members
        member_ids = request.member_expert_ids
        if request.template_id and request.template_id in TEAM_TEMPLATES:
            tmpl = TEAM_TEMPLATES[request.template_id]
            member_ids = tmpl["member_expert_ids"]
            if not request.name or request.name == request.template_id:
                request.name = tmpl["name"]

        record = TeamRecord(
            team_id=team_id,
            name=request.name,
            description=request.description,
            lead_expert_id=request.lead_expert_id,
            member_expert_ids=member_ids,
            metadata=request.metadata,
        )

        # If template, create default tasks
        if request.template_id and request.template_id in TEAM_TEMPLATES:
            tmpl = TEAM_TEMPLATES[request.template_id]
            for i, t in enumerate(tmpl.get("default_tasks", [])):
                task_id = f"task-{team_id}-{i}"
                task = TaskRecord(
                    task_id=task_id,
                    team_id=team_id,
                    subject=t["subject"],
                    phase=PhaseType(t["phase"]) if t.get("phase") else None,
                    assigned_to=t.get("assigned_to"),
                )
                self._tasks[task_id] = task
                record.tasks.append(self._task_to_response(task))

        self._teams[team_id] = record
        logger.info(f"团队已创建: {team_id} ({record.name})")
        return self._team_to_response(record)

    async def get_team(self, team_id: str) -> TeamResponse | None:
        """获取团队详情"""
        record = self._teams.get(team_id)
        if record is None:
            return None
        return self._team_to_response(record)

    async def list_teams(
        self,
        status: Optional[TeamStatus] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> TeamListResponse:
        """列出团队"""
        teams = list(self._teams.values())
        if status:
            teams = [t for t in teams if t.status == status]
        teams = teams[offset : offset + limit]
        return TeamListResponse(
            teams=[self._team_to_response(t) for t in teams],
            total=len(self._teams),
        )

    async def update_team(self, team_id: str, request: TeamUpdateRequest) -> TeamResponse | None:
        """更新团队"""
        record = self._teams.get(team_id)
        if record is None:
            return None

        if request.name is not None:
            record.name = request.name
        if request.description is not None:
            record.description = request.description
        if request.status is not None:
            record.status = request.status
        if request.metadata is not None:
            record.metadata.update(request.metadata)

        record.updated_at = datetime.now()
        return self._team_to_response(record)

    async def delete_team(self, team_id: str) -> bool:
        """解散团队"""
        record = self._teams.get(team_id)
        if record is None:
            return False
        record.status = TeamStatus.DISBANDED
        record.updated_at = datetime.now()
        return True

    def team_exists(self, team_id: str) -> bool:
        return team_id in self._teams

    # ============================================================
    # Phase Management
    # ============================================================

    async def advance_phase(
        self, team_id: str, request: PhaseAdvanceRequest
    ) -> TeamResponse | None:
        """推进 Phase"""
        record = self._teams.get(team_id)
        if record is None:
            return None

        # Phase gate: check all current phase tasks are completed
        current_tasks = [
            t for t in self._tasks.values()
            if t.team_id == team_id
            and t.phase == record.current_phase
            and t.status != TaskStatus.COMPLETED
            and t.status != TaskStatus.DELETED
        ]
        if current_tasks:
            logger.warning(
                f"Phase 门禁: 团队 {team_id} 还有 {len(current_tasks)} 个未完成任务"
            )
            # Still allow advance but log warning

        record.current_phase = request.next_phase
        record.updated_at = datetime.now()

        # Auto-activate tasks for new phase
        for task in self._tasks.values():
            if task.team_id == team_id and task.phase == request.next_phase and task.status == TaskStatus.PENDING:
                # Check if blocked_by tasks are all completed
                if all(
                    self._tasks[bid].status == TaskStatus.COMPLETED
                    for bid in task.blocked_by
                    if bid in self._tasks
                ):
                    task.status = TaskStatus.PENDING  # Ready to be claimed
                    task.updated_at = datetime.now()

        logger.info(f"团队 {team_id} Phase 推进至: {request.next_phase}")
        return self._team_to_response(record)

    # ============================================================
    # Task Management
    # ============================================================

    async def create_task(self, team_id: str, request: TaskCreateRequest) -> TaskResponse | None:
        """创建任务"""
        record = self._teams.get(team_id)
        if record is None:
            return None

        task_id = f"task-{uuid.uuid4().hex[:8]}"
        task = TaskRecord(
            task_id=task_id,
            team_id=team_id,
            subject=request.subject,
            description=request.description,
            assigned_to=request.assigned_to,
            phase=request.phase,
            priority=request.priority,
            blocked_by=request.blocked_by,
        )

        # Set up blocks relationship
        for bid in request.blocked_by:
            blocking_task = self._tasks.get(bid)
            if blocking_task:
                blocking_task.blocks.append(task_id)

        self._tasks[task_id] = task
        record.tasks.append(self._task_to_response(task))
        record.updated_at = datetime.now()
        return self._task_to_response(task)

    async def get_task(self, task_id: str) -> TaskResponse | None:
        """获取任务详情"""
        task = self._tasks.get(task_id)
        if task is None:
            return None
        return self._task_to_response(task)

    async def list_tasks(self, team_id: str) -> list[TaskResponse]:
        """列出团队所有任务"""
        return [
            self._task_to_response(t)
            for t in self._tasks.values()
            if t.team_id == team_id
        ]

    async def update_task(self, task_id: str, request: TaskUpdateRequest) -> TaskResponse | None:
        """更新任务"""
        task = self._tasks.get(task_id)
        if task is None:
            return None

        if request.subject is not None:
            task.subject = request.subject
        if request.description is not None:
            task.description = request.description
        if request.status is not None:
            task.status = request.status
        if request.assigned_to is not None:
            task.assigned_to = request.assigned_to
        if request.progress is not None:
            task.progress = request.progress
        if request.metadata is not None:
            task.metadata.update(request.metadata)

        task.updated_at = datetime.now()

        # Update parent team's task list
        team = self._teams.get(task.team_id)
        if team:
            team.updated_at = datetime.now()

        return self._task_to_response(task)

    # ============================================================
    # Templates
    # ============================================================

    async def list_templates(self) -> list[TeamTemplateResponse]:
        """列出所有团队模板"""
        result = []
        for tmpl in TEAM_TEMPLATES.values():
            result.append(
                TeamTemplateResponse(
                    template_id=tmpl["template_id"],
                    name=tmpl["name"],
                    description=tmpl["description"],
                    lead_expert_id=tmpl["lead_expert_id"],
                    member_expert_ids=tmpl["member_expert_ids"],
                    phases=tmpl["phases"],
                    default_tasks=tmpl.get("default_tasks", []),
                )
            )
        return result

    # ============================================================
    # Helpers
    # ============================================================

    def _team_to_response(self, record: TeamRecord) -> TeamResponse:
        """转换 TeamRecord 为 TeamResponse"""
        # Refresh tasks from _tasks store
        tasks = [
            self._task_to_response(self._tasks[t.task_id])
            for t in record.tasks
            if t.task_id in self._tasks
        ]
        return TeamResponse(
            team_id=record.team_id,
            name=record.name,
            description=record.description,
            status=record.status,
            current_phase=record.current_phase,
            lead_expert_id=record.lead_expert_id,
            members=record.members,
            tasks=tasks,
            created_at=record.created_at,
            updated_at=record.updated_at,
            metadata=record.metadata,
        )

    def _task_to_response(self, record: TaskRecord) -> TaskResponse:
        """转换 TaskRecord 为 TaskResponse"""
        return TaskResponse(
            task_id=record.task_id,
            team_id=record.team_id,
            subject=record.subject,
            description=record.description,
            status=record.status,
            assigned_to=record.assigned_to,
            phase=record.phase,
            priority=record.priority,
            progress=record.progress,
            blocked_by=record.blocked_by,
            blocks=record.blocks,
            created_at=record.created_at,
            updated_at=record.updated_at,
            metadata=record.metadata,
        )


# ============================================================
# Dependency Injection
# ============================================================

_service_instance: TeamService | None = None


def get_team_service() -> TeamService:
    """获取 TeamService 单例"""
    global _service_instance
    if _service_instance is None:
        _service_instance = TeamService()
    return _service_instance
