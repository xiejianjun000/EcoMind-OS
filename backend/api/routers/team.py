"""
EcoMind 专家团队 API — 任务生命周期管理

GET  /api/team/tasks          — 列出所有任务
GET  /api/team/tasks/{id}     — 查询任务状态
POST /api/team/tasks/{id}/stop — 停止任务
POST /api/team/dispatch       — 手动调度专家
POST /api/team/parallel       — 并行调度多个专家
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from engine.team_engine import get_team_engine

router = APIRouter()


class DispatchRequest(BaseModel):
    expert_id: str = Field(default="ecomind")
    expert_name: str = Field(default="")
    message: str
    tools: list[str] = Field(default_factory=list)


class ParallelDispatchRequest(BaseModel):
    tasks: list[DispatchRequest]


@router.get("/tasks", summary="列出所有任务")
async def list_tasks(
    status: str = Query(default=None, description="按状态过滤: pending/running/completed/failed/stopped"),
):
    engine = get_team_engine()
    tasks = await engine.list_tasks(status=status)
    return {"tasks": tasks, "total": len(tasks)}


@router.get("/tasks/{task_id}", summary="查询任务状态")
async def get_task(task_id: str):
    engine = get_team_engine()
    task = await engine.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"任务不存在: {task_id}")
    return task


@router.post("/tasks/{task_id}/stop", summary="停止任务")
async def stop_task(task_id: str):
    engine = get_team_engine()
    ok = await engine.stop_task(task_id)
    if not ok:
        raise HTTPException(status_code=400, detail=f"无法停止任务: {task_id}")
    return {"task_id": task_id, "status": "stopped"}


@router.post("/dispatch", summary="手动调度专家")
async def dispatch_expert(req: DispatchRequest):
    """手动调度一个专家子任务"""
    import os
    from api.routers.chat import build_engine_system_prompt
    from api.guardrails import EXPERT_TOOL_MATRIX

    engine = get_team_engine()
    expert_id = req.expert_id
    expert_name = req.expert_name or expert_id

    allowed_tools = req.tools or list(EXPERT_TOOL_MATRIX.get(expert_id, set()))
    system_prompt = build_engine_system_prompt(expert_id, expert_name)

    api_key = os.environ.get("DEEPSEEK_API_KEY", "")
    api_base = os.environ.get("DEEPSEEK_API_BASE", "https://api.deepseek.com/v1")

    task_id = await engine.dispatch(
        expert_id=expert_id,
        expert_name=expert_name,
        message=req.message,
        system_prompt=system_prompt,
        tools=allowed_tools,
        api_key=api_key,
        api_base=api_base,
    )

    return {"task_id": task_id, "status": "dispatched"}


@router.post("/parallel", summary="并行调度多个专家")
async def parallel_dispatch(req: ParallelDispatchRequest):
    """并行调度多个专家，等待全部完成"""
    import asyncio
    import os
    from api.routers.chat import build_engine_system_prompt
    from api.guardrails import EXPERT_TOOL_MATRIX

    engine = get_team_engine()
    api_key = os.environ.get("DEEPSEEK_API_KEY", "")
    api_base = os.environ.get("DEEPSEEK_API_BASE", "https://api.deepseek.com/v1")

    task_ids = []
    for t in req.tasks:
        expert_id = t.expert_id
        expert_name = t.expert_name or expert_id
        allowed_tools = t.tools or list(EXPERT_TOOL_MATRIX.get(expert_id, set()))
        system_prompt = build_engine_system_prompt(expert_id, expert_name)

        tid = await engine.dispatch(
            expert_id=expert_id,
            expert_name=expert_name,
            message=t.message,
            system_prompt=system_prompt,
            tools=allowed_tools,
            api_key=api_key,
            api_base=api_base,
        )
        task_ids.append(tid)

    # 等待全部完成
    results = await engine.wait_all(task_ids, timeout=180)

    return {
        "dispatched": len(task_ids),
        "results": results,
    }
