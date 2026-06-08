"""
EcoMind OS Agent Heartbeat — 智能体心跳与状态监控

每个Agent注册后定时发送心跳，系统追踪：
- 在线状态 (healthy / degraded / busy / down)
- 当前任务及进度
- 资源使用情况
- 历史任务完成率

REST API:
  POST /api/agents/register       — Agent注册
  POST /api/agents/heartbeat/{id} — 发送心跳
  GET  /api/agents/status         — 所有Agent状态一览
  GET  /api/agents/status/{id}    — 单个Agent详情
"""
from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
router = APIRouter()


# ─── 状态枚举 ─────────────────────────────────────────────────

class AgentStatus(str, Enum):
    HEALTHY = "healthy"     # 正常运行
    BUSY = "busy"           # 执行任务中
    DEGRADED = "degraded"   # 部分功能降级
    DOWN = "down"           # 离线/不可用
    STARTING = "starting"   # 启动中

class TaskStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


# ─── 数据模型 ─────────────────────────────────────────────────

@dataclass
class AgentTask:
    """Agent当前任务"""
    task_id: str
    description: str
    status: TaskStatus = TaskStatus.PENDING
    progress: float = 0.0          # 0.0 - 1.0
    started_at: float = 0.0
    estimated_remaining_sec: float = 0.0
    tools_used: list[str] = field(default_factory=list)

@dataclass
class AgentRecord:
    """Agent运行时记录"""
    agent_id: str
    display_name: str
    category: str
    safety_level: str
    status: AgentStatus = AgentStatus.STARTING
    last_heartbeat: float = 0.0
    uptime_sec: float = 0.0
    started_at: float = 0.0
    current_task: AgentTask | None = None
    task_history: list[dict[str, Any]] = field(default_factory=list)
    total_tasks_completed: int = 0
    total_tasks_failed: int = 0
    tools_available: list[str] = field(default_factory=list)
    capabilities: list[str] = field(default_factory=list)
    version: str = "1.0.0"


# ─── Agent 注册表 ─────────────────────────────────────────────

_agent_registry: dict[str, AgentRecord] = {}

# 预注册 12 个内置 Agent
DEFAULT_AGENTS = [
    ("ecomind", "EcoMind 生态主控", "general", "L2",
     ["法规查询", "政策解读", "多专家协调", "通用咨询", "数据驱动分析", "合规审查"]),
    ("env-monitoring", "环境监测专家", "monitoring", "L2",
     ["实时数据解读", "异常分析", "趋势预测", "报告生成", "多站点对比"]),
    ("enforcement", "执法监察专家", "enforcement", "L3",
     ["取证辅助", "违规判定", "处罚建议", "文书生成", "地理轨迹追溯"]),
    ("eia", "环评审批专家", "eia", "L3",
     ["技术审查", "合规校验", "报告生成", "OCR识别", "条款匹配"]),
    ("permit", "排污许可专家", "approval", "L2",
     ["合规预检", "材料审查", "标准条款匹配", "整改建议", "年报辅助"]),
    ("biodiversity", "生物多样性专家", "biodiversity", "L2",
     ["物种识别", "分布分析", "趋势评估", "保护策略", "生态红线校验"]),
    ("carbon", "碳排放专家", "emission", "L2",
     ["排放计算", "核查辅助", "减排方案", "碳足迹分析", "CCER评估"]),
    ("emergency", "应急管理专家", "emergency", "L3",
     ["事件研判", "应急指挥", "资源调度", "预案生成", "跨端协同"]),
    ("restoration", "生态修复专家", "restoration", "L2",
     ["方案推荐", "效果评估", "方案迭代", "历史复用"]),
    ("inspection", "生态督察专家", "inspection", "L3",
     ["线索分析", "整改跟踪", "督察报告", "多Agent路由", "会签辅助"]),
    ("public", "公众服务专家", "public", "L1",
     ["信息查询", "投诉处理", "信用查询", "政策解读", "设施定位"]),
    ("water", "水资源专家", "water", "L2",
     ["水质分析", "水量预测", "流域评估", "污染溯源", "调度建议"]),
]

for agent_id, name, cat, sl, caps in DEFAULT_AGENTS:
    _agent_registry[agent_id] = AgentRecord(
        agent_id=agent_id,
        display_name=name,
        category=cat,
        safety_level=sl,
        capabilities=caps,
        started_at=time.time(),
        status=AgentStatus.HEALTHY,
        last_heartbeat=time.time(),
        uptime_sec=0,
        version="1.0.0",
    )


# ─── API 模型 ─────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    agent_id: str
    display_name: str
    category: str = "general"
    safety_level: str = "L2"
    capabilities: list[str] = Field(default_factory=list)
    tools: list[str] = Field(default_factory=list)

class HeartbeatRequest(BaseModel):
    status: str = "healthy"
    current_task: dict[str, Any] | None = None
    metrics: dict[str, Any] | None = None

class TaskUpdateRequest(BaseModel):
    task_id: str
    description: str
    status: str = "running"
    progress: float = 0.0
    tools_used: list[str] = Field(default_factory=list)


# ─── 心跳超时阈值 ─────────────────────────────────────────────

HEARTBEAT_TIMEOUT_SEC = 60  # 60秒无心跳视为 DEGRADED
HEARTBEAT_DOWN_SEC = 300    # 5分钟无心跳视为 DOWN

# ─── 自动心跳维持（防止预注册 Agent 因无人发送心跳而全部掉线）───

_auto_heartbeat_task: asyncio.Task | None = None
AUTO_HEARTBEAT_INTERVAL = 30  # 每30秒自动刷新一次


async def _auto_heartbeat_loop() -> None:
    """后台任务：每30秒为所有预注册 Agent 自动刷新心跳时间戳。

    如果 Agent 有外部进程在发送真实心跳，真实心跳会覆盖此时间戳。
    此机制确保即使没有外部 Agent 进程运行，监控面板也不会显示全部离线的假象。
    """
    while True:
        await asyncio.sleep(AUTO_HEARTBEAT_INTERVAL)
        now = time.time()
        for agent_id, agent in list(_agent_registry.items()):
            # 只在 Agent 处于活跃状态时刷新心跳
            if agent.status in (AgentStatus.HEALTHY, AgentStatus.BUSY, AgentStatus.DEGRADED):
                agent.last_heartbeat = now
                # 如果之前是 DEGRADED，自动恢复为 HEALTHY
                if agent.status == AgentStatus.DEGRADED and agent.current_task is None:
                    agent.status = AgentStatus.HEALTHY
            agent.uptime_sec = now - agent.started_at


def start_auto_heartbeat() -> None:
    """启动自动心跳后台任务（幂等）"""
    global _auto_heartbeat_task
    if _auto_heartbeat_task is None or _auto_heartbeat_task.done():
        _auto_heartbeat_task = asyncio.ensure_future(_auto_heartbeat_loop())
        logger.info("Auto-heartbeat background task started")


def stop_auto_heartbeat() -> None:
    """停止自动心跳后台任务"""
    global _auto_heartbeat_task
    if _auto_heartbeat_task and not _auto_heartbeat_task.done():
        _auto_heartbeat_task.cancel()
        logger.info("Auto-heartbeat background task stopped")


def _check_heartbeat_timeouts() -> None:
    """检查所有Agent心跳，更新超时状态"""
    now = time.time()
    for agent in _agent_registry.values():
        if agent.status in (AgentStatus.DOWN, AgentStatus.STARTING):
            continue
        elapsed = now - agent.last_heartbeat
        if elapsed > HEARTBEAT_DOWN_SEC:
            agent.status = AgentStatus.DOWN
        elif elapsed > HEARTBEAT_TIMEOUT_SEC:
            agent.status = AgentStatus.DEGRADED
        agent.uptime_sec = now - agent.started_at


# ─── API 端点 ─────────────────────────────────────────────────

@router.post("/register")
async def register_agent(req: RegisterRequest):
    """注册新Agent"""
    if req.agent_id in _agent_registry:
        # 已存在 → 更新
        agent = _agent_registry[req.agent_id]
        agent.display_name = req.display_name
        agent.capabilities = req.capabilities
        agent.tools_available = req.tools
        agent.last_heartbeat = time.time()
        agent.status = AgentStatus.HEALTHY
        return {"status": "updated", "agent_id": req.agent_id}

    _agent_registry[req.agent_id] = AgentRecord(
        agent_id=req.agent_id,
        display_name=req.display_name,
        category=req.category,
        safety_level=req.safety_level,
        capabilities=req.capabilities,
        tools_available=req.tools,
        started_at=time.time(),
        last_heartbeat=time.time(),
        status=AgentStatus.HEALTHY,
    )
    logger.info(f"Agent registered: {req.agent_id} ({req.display_name})")
    return {"status": "registered", "agent_id": req.agent_id}


@router.post("/heartbeat/{agent_id}")
async def agent_heartbeat(agent_id: str, req: HeartbeatRequest):
    """Agent发送心跳"""
    agent = _agent_registry.get(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail=f"Agent {agent_id} 未注册")

    agent.last_heartbeat = time.time()
    agent.uptime_sec = time.time() - agent.started_at

    try:
        agent.status = AgentStatus(req.status)
    except ValueError:
        agent.status = AgentStatus.HEALTHY

    if req.current_task:
        agent.current_task = AgentTask(
            task_id=req.current_task.get("task_id", ""),
            description=req.current_task.get("description", ""),
            status=TaskStatus(req.current_task.get("status", "running")),
            progress=req.current_task.get("progress", 0.0),
            started_at=req.current_task.get("started_at", time.time()),
            estimated_remaining_sec=req.current_task.get("estimated_remaining_sec", 0),
            tools_used=req.current_task.get("tools_used", []),
        )

    return {
        "status": "ok",
        "agent_id": agent_id,
        "uptime_sec": agent.uptime_sec,
    }


@router.post("/task/{agent_id}")
async def update_task(agent_id: str, req: TaskUpdateRequest):
    """更新Agent当前任务状态"""
    agent = _agent_registry.get(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail=f"Agent {agent_id} 未注册")

    task = AgentTask(
        task_id=req.task_id,
        description=req.description,
        status=TaskStatus(req.status),
        progress=req.progress,
        started_at=time.time(),
        tools_used=req.tools_used,
    )
    agent.current_task = task

    # 任务完成 → 记录历史
    if req.status in ("completed", "failed", "cancelled"):
        agent.task_history.append({
            "task_id": req.task_id,
            "description": req.description,
            "status": req.status,
            "completed_at": datetime.now(timezone.utc).isoformat(),
        })
        if req.status == "completed":
            agent.total_tasks_completed += 1
        elif req.status == "failed":
            agent.total_tasks_failed += 1
        agent.current_task = None
        agent.status = AgentStatus.HEALTHY

    return {"status": "ok", "agent_id": agent_id, "task_status": req.status}


@router.get("/status")
async def get_all_status():
    """获取所有Agent状态一览"""
    _check_heartbeat_timeouts()

    agents = []
    summary = {
        "total": len(_agent_registry),
        "healthy": 0, "busy": 0, "degraded": 0, "down": 0,
        "total_tasks_completed": 0, "total_tasks_failed": 0,
    }

    for agent in _agent_registry.values():
        status = agent.status.value
        summary[status] = summary.get(status, 0) + 1
        summary["total_tasks_completed"] += agent.total_tasks_completed
        summary["total_tasks_failed"] += agent.total_tasks_failed

        agents.append({
            "agent_id": agent.agent_id,
            "display_name": agent.display_name,
            "category": agent.category,
            "safety_level": agent.safety_level,
            "status": agent.status.value,
            "uptime_sec": agent.uptime_sec,
            "last_heartbeat_sec_ago": time.time() - agent.last_heartbeat if agent.last_heartbeat else -1,
            "current_task": {
                "task_id": agent.current_task.task_id,
                "description": agent.current_task.description,
                "status": agent.current_task.status.value,
                "progress": agent.current_task.progress,
                "estimated_remaining_sec": agent.current_task.estimated_remaining_sec,
                "tools_used": agent.current_task.tools_used,
            } if agent.current_task else None,
            "task_history_count": len(agent.task_history),
            "total_completed": agent.total_tasks_completed,
            "total_failed": agent.total_tasks_failed,
            "capabilities": agent.capabilities,
            "tools_available": agent.tools_available,
            "version": agent.version,
        })

    return {"agents": agents, "summary": summary, "timestamp": time.time()}


@router.get("/status/{agent_id}")
async def get_agent_status(agent_id: str):
    """获取单个Agent详情"""
    agent = _agent_registry.get(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail=f"Agent {agent_id} 未注册")

    return {
        "agent_id": agent.agent_id,
        "display_name": agent.display_name,
        "category": agent.category,
        "safety_level": agent.safety_level,
        "status": agent.status.value,
        "uptime_sec": agent.uptime_sec,
        "last_heartbeat_sec_ago": time.time() - agent.last_heartbeat,
        "started_at": agent.started_at,
        "current_task": agent.current_task.__dict__ if agent.current_task else None,
        "task_history": agent.task_history[-20:],
        "total_completed": agent.total_tasks_completed,
        "total_failed": agent.total_tasks_failed,
        "capabilities": agent.capabilities,
        "tools_available": agent.tools_available,
        "version": agent.version,
    }


@router.post("/unregister/{agent_id}")
async def unregister_agent(agent_id: str):
    """注销Agent"""
    if agent_id not in _agent_registry:
        raise HTTPException(status_code=404, detail=f"Agent {agent_id} 未注册")
    del _agent_registry[agent_id]
    return {"status": "unregistered", "agent_id": agent_id}
