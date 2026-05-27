"""
部门智能体管理 API Router

提供:
  GET  /api/departments/bindings  — 获取所有部门智能体绑定
  GET  /api/departments/{dept}    — 获取部门智能体详情
  POST /api/departments/{dept}/message — 向部门智能体发送消息
  POST /api/departments/init      — 一键初始化全部19个部门智能体
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException

from api.services.agent_service import get_agent_service
from skills.ecc_bridge import get_dept_loader, DepartmentAgent

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/bindings")
async def list_department_bindings():
    """获取所有19个部门智能体的绑定配置（含优先级、技能等）"""
    loader = get_dept_loader()
    dept_agents = loader.get_all_dept_agents()
    service = get_agent_service()

    result = []
    for da in dept_agents:
        agent_resp = await service.get_agent_by_department(da.department)
        result.append({
            "department": da.department,
            "agentName": da.display_name,
            "agentKey": da.key,
            "priority": da.priority,
            "skills": da.skill.tools if da.skill else [],
            "model": "deepseek-671B",
            "color": da.skill.color if da.skill else "#475569",
            "emoji": da.skill.emoji if da.skill else "",
            "agentId": agent_resp.agent_id if agent_resp else None,
            "status": agent_resp.status.value if agent_resp else "uninitialized",
        })

    return result


@router.get("/{department}")
async def get_department_agent(department: str):
    """获取指定部门的智能体信息"""
    loader = get_dept_loader()
    da = loader.get_dept_agent(department)
    if not da:
        raise HTTPException(status_code=404, detail=f"未找到部门: {department}")

    service = get_agent_service()
    agent_resp = await service.get_agent_by_department(department)

    return {
        "department": da.department,
        "agentName": da.display_name,
        "agentKey": da.key,
        "priority": da.priority,
        "skills": da.skill.tools if da.skill else [],
        "instinctRules": da.skill.instinct_rules if da.skill else [],
        "systemPrompt": da.skill.instructions[:500] if da.skill else "",
        "agentId": agent_resp.agent_id if agent_resp else None,
        "status": agent_resp.status.value if agent_resp else "uninitialized",
    }


@router.post("/{department}/message")
async def send_department_message(department: str, body: dict):
    """向部门智能体发送消息"""
    message = body.get("message", "")
    session_id = body.get("session_id")

    if not message:
        raise HTTPException(status_code=400, detail="消息内容不能为空")

    service = get_agent_service()
    result = await service.send_to_department(department, message, session_id)
    return result


@router.post("/init")
async def init_all_departments():
    """一键初始化全部19个部门智能体"""
    service = get_agent_service()
    result = await service.init_all_dept_agents()
    return {
        "message": f"已初始化 {result['initialized']} 个部门智能体",
        "initialized": result["initialized"],
        "total_departments": 19,
    }
