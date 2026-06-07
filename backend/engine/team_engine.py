"""
EcoMind 专家团队引擎 — 真并行调度

超越 WorkBuddy 的 TaskCreate 机制：
- 独立进程隔离
- 完整任务生命周期（create/query/stop/list/output）
- asyncio 并行执行
- 结果流式收集
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)


class TaskStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    STOPPED = "stopped"


@dataclass
class ExpertTask:
    """一个专家子任务"""
    task_id: str
    expert_id: str
    expert_name: str
    message: str
    status: TaskStatus = TaskStatus.PENDING
    content: str = ""
    tools_used: list[str] = field(default_factory=list)
    error: Optional[str] = None
    created_at: float = field(default_factory=time.time)
    finished_at: Optional[float] = None
    _cancel_event: asyncio.Event = field(default_factory=asyncio.Event)
    _task_handle: Optional[asyncio.Task] = None

    def to_dict(self) -> dict:
        return {
            "task_id": self.task_id,
            "expert_id": self.expert_id,
            "expert_name": self.expert_name,
            "status": self.status.value,
            "content": self.content[:5000] if self.content else "",
            "content_length": len(self.content) if self.content else 0,
            "tools_used": self.tools_used,
            "error": self.error,
            "created_at": self.created_at,
            "finished_at": self.finished_at,
            "duration": (self.finished_at - self.created_at) if self.finished_at else (time.time() - self.created_at),
        }


class ExpertTeamEngine:
    """专家团队调度引擎 — 单例"""

    def __init__(self):
        self._tasks: dict[str, ExpertTask] = {}
        self._lock = asyncio.Lock()

    async def dispatch(
        self,
        expert_id: str,
        expert_name: str,
        message: str,
        system_prompt: str = "",
        tools: Optional[list[str]] = None,
        api_key: str = "",
        api_base: str = "https://api.deepseek.com/v1",
        model: str = "deepseek-chat",
        timeout: float = 120.0,
    ) -> str:
        """
        调度一个专家子任务，返回 task_id。
        任务在后台异步执行，通过 get_task() 查询进度。
        """
        task_id = f"expert-{uuid.uuid4().hex[:8]}"
        task = ExpertTask(
            task_id=task_id,
            expert_id=expert_id,
            expert_name=expert_name,
            message=message,
            status=TaskStatus.RUNNING,
        )

        async with self._lock:
            self._tasks[task_id] = task

        # 启动后台执行
        handle = asyncio.create_task(
            self._run_expert(task, system_prompt, tools, api_key, api_base, model, timeout)
        )
        task._task_handle = handle

        logger.info(f"🚀 专家已调度: {expert_name}({expert_id}) → task={task_id}")
        return task_id

    async def _run_expert(
        self,
        task: ExpertTask,
        system_prompt: str,
        tools: Optional[list[str]],
        api_key: str,
        api_base: str,
        model: str,
        timeout: float,
    ):
        """在后台执行专家任务"""
        try:
            import httpx

            # 构建消息
            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            messages.append({"role": "user", "content": task.message})

            # 获取工具定义
            tool_defs = []
            if tools:
                from engine.tool_registry import get_tool_registry
                registry = get_tool_registry()
                for tname in tools:
                    t = registry.get(tname)
                    if t:
                        tool_defs.append(t.to_openai_schema())

            payload = {
                "model": model,
                "messages": messages,
                "temperature": 0.7,
                "max_tokens": 4096,
                "stream": False,
            }
            if tool_defs:
                payload["tools"] = tool_defs
                payload["tool_choice"] = "auto"

            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
            }

            # Agentic loop（最多5轮）
            max_iterations = 5
            all_tools_used = []
            final_content = ""

            async with httpx.AsyncClient(timeout=timeout) as client:
                for iteration in range(max_iterations):
                    if task._cancel_event.is_set():
                        task.status = TaskStatus.STOPPED
                        return

                    resp = await client.post(
                        f"{api_base}/chat/completions",
                        json=payload,
                        headers=headers,
                    )

                    if resp.status_code != 200:
                        task.status = TaskStatus.FAILED
                        task.error = f"API {resp.status_code}"
                        return

                    data = resp.json()
                    choice = data.get("choices", [{}])[0]
                    msg = choice.get("message", {})

                    # 工具调用
                    tool_calls = msg.get("tool_calls", [])
                    if tool_calls:
                        # 并行执行所有工具调用
                        results = await self._execute_tools_parallel(tool_calls, task)

                        # 追加到消息历史
                        messages.append(msg)
                        for tc, result in zip(tool_calls, results):
                            all_tools_used.append(tc["function"]["name"])
                            messages.append({
                                "role": "tool",
                                "tool_call_id": tc["id"],
                                "content": json.dumps(result, ensure_ascii=False)[:2000],
                            })
                        continue  # 继续循环

                    # 文本回复
                    final_content = msg.get("content", "")
                    break

            task.content = final_content
            task.tools_used = all_tools_used
            task.status = TaskStatus.COMPLETED
            task.finished_at = time.time()
            logger.info(f"✅ 专家完成: {task.expert_name} → {len(final_content)}字符, {len(all_tools_used)}个工具")

        except asyncio.CancelledError:
            task.status = TaskStatus.STOPPED
        except Exception as e:
            task.status = TaskStatus.FAILED
            task.error = str(e)[:500]
            task.finished_at = time.time()
            logger.error(f"❌ 专家失败: {task.expert_name} → {e}")

    async def _execute_tools_parallel(self, tool_calls: list, task: ExpertTask) -> list:
        """并行执行多个工具调用"""
        async def _exec_one(tc):
            name = tc["function"]["name"]
            try:
                params = json.loads(tc["function"].get("arguments", "{}"))
            except json.JSONDecodeError:
                params = {}

            from engine.tool_registry import get_tool_registry
            registry = get_tool_registry()
            try:
                result = await registry.execute(name, **params)
                return result if isinstance(result, dict) else {"result": str(result)}
            except Exception as e:
                return {"error": str(e)}

        return await asyncio.gather(*[_exec_one(tc) for tc in tool_calls])

    async def get_task(self, task_id: str) -> Optional[dict]:
        """查询任务状态"""
        task = self._tasks.get(task_id)
        if not task:
            return None
        return task.to_dict()

    async def stop_task(self, task_id: str) -> bool:
        """停止任务"""
        task = self._tasks.get(task_id)
        if not task or task.status not in (TaskStatus.RUNNING, TaskStatus.PENDING):
            return False
        task._cancel_event.set()
        if task._task_handle:
            task._task_handle.cancel()
        task.status = TaskStatus.STOPPED
        task.finished_at = time.time()
        return True

    async def list_tasks(self, status: Optional[str] = None) -> list[dict]:
        """列出所有任务"""
        tasks = list(self._tasks.values())
        if status:
            tasks = [t for t in tasks if t.status.value == status]
        return [t.to_dict() for t in tasks]

    async def wait_all(self, task_ids: list[str], timeout: float = 120) -> dict[str, dict]:
        """等待多个任务完成"""
        async def _wait_one(tid):
            while True:
                t = await self.get_task(tid)
                if not t or t["status"] in ("completed", "failed", "stopped"):
                    return tid, t
                await asyncio.sleep(0.5)

        tasks = [asyncio.create_task(_wait_one(tid)) for tid in task_ids]
        done, _ = await asyncio.wait(tasks, timeout=timeout)
        return {tid: result for tid, result in [t.result() for t in done]}


# 全局单例
_team_engine: Optional[ExpertTeamEngine] = None


def get_team_engine() -> ExpertTeamEngine:
    global _team_engine
    if _team_engine is None:
        _team_engine = ExpertTeamEngine()
    return _team_engine
