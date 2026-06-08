"""
/api/skills — 技能沉淀 + 看板 API
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from api.schemas.expert_v2 import (
    SkillCreate, SkillResponse, SkillCategory,
    TaskBoardItem, TaskBoardResponse, TaskBoardStatus,
)
from api.services.skill_repository import (
    SkillRecord, SkillCategory as RSSkillCategory,
    get_skill_repository, SkillRepository,
)

router = APIRouter()


def _get_repo() -> SkillRepository:
    return get_skill_repository()


def _to_skill_response(s: SkillRecord) -> SkillResponse:
    return SkillResponse(
        id=s.id, name=s.name, description=s.description,
        category=SkillCategory(s.category.value), tags=s.tags,
        created_by=s.created_by, created_from_task=s.created_from_task,
        content=s.content, reusable_by=s.reusable_by,
        usage_count=s.usage_count, avg_rating=s.avg_rating,
        version=s.version, created_at=s.created_at, updated_at=s.updated_at,
    )


# === 技能 CRUD ===

@router.post("", response_model=SkillResponse)
def create_skill(body: SkillCreate):
    repo = _get_repo()
    skill = SkillRecord(
        name=body.name, description=body.description,
        category=RSSkillCategory(body.category.value), tags=body.tags,
        created_by=body.created_by, created_from_task=body.created_from_task,
        content=body.content, reusable_by=body.reusable_by,
    )
    return _to_skill_response(repo.create(skill))


@router.get("", response_model=list[SkillResponse])
def list_skills(tags: str = "", category: str = "", expert_id: str = ""):
    repo = _get_repo()
    tag_list = [t.strip() for t in tags.split(",")] if tags else None
    cat = SkillCategory(category) if category else None
    results = repo.search(tags=tag_list, category=cat, expert_id=expert_id if expert_id else None)
    return [_to_skill_response(s) for s in results]


@router.get("/{skill_id}", response_model=SkillResponse)
def get_skill(skill_id: str):
    repo = _get_repo()
    skill = repo.get(skill_id)
    if not skill:
        raise HTTPException(404, "技能不存在")
    return _to_skill_response(skill)


@router.post("/{skill_id}/use")
def use_skill(skill_id: str):
    repo = _get_repo()
    skill = repo.get(skill_id)
    if not skill:
        raise HTTPException(404, "技能不存在")
    repo.increment_usage(skill_id)
    return {"used": True, "usage_count": skill.usage_count + 1}


# === 看板 (内存版，后续升级DB) ===

_board_items: dict[str, TaskBoardItem] = {}


@router.get("/board", response_model=TaskBoardResponse)
def get_board(team_id: str = Query("")):
    items = list(_board_items.values())
    if team_id:
        items = [i for i in items if i.team_id == team_id]
    columns = {s.value: [] for s in TaskBoardStatus}
    for item in items:
        columns[item.status.value].append(item)
    return TaskBoardResponse(columns=columns, total=len(items))


@router.post("/board/items", response_model=TaskBoardItem)
def create_board_item(body: TaskBoardItem):
    _board_items[body.id] = body
    return body


@router.put("/board/items/{item_id}/status")
def update_board_status(item_id: str, status: TaskBoardStatus = Query(...)):
    if item_id not in _board_items:
        raise HTTPException(404, "任务不存在")
    _board_items[item_id].status = status
    return _board_items[item_id]
