"""
EcoMind 专家团队协作引擎 — 自建，不依赖任何外部 Agent 框架。
支持异步 dispatch、结果等待、多专家并行。
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable, Optional

import httpx

logger = logging.getLogger(__name__)


class TaskStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    STOPPED = "stopped"


@dataclass
class ExpertTask:
    task_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    expert_id: str = ""
    expert_name: str = ""
    message: str = ""
    status: TaskStatus = TaskStatus.PENDING
    content: str = ""
    tools_used: list[str] = field(default_factory=list)
    error: Optional[str] = None
    started_at: float = 0.0
    finished_at: float = 0.0
    _cancel_event: asyncio.Event = field(default_factory=asyncio.Event)
    _task_handle: Optional[asyncio.Task] = None

    def to_dict(self) -> dict:
        return {
            "task_id": self.task_id,
            "expert_id": self.expert_id,
            "expert_name": self.expert_name,
            "status": self.status.value,
            "content": self.content,
            "content_length": len(self.content),
            "tools_used": self.tools_used,
            "error": self.error,
            "duration": round(self.finished_at - self.started_at, 2) if self.finished_at else 0,
        }


class ExpertTeamEngine:
    def __init__(self) -> None:
        self._tasks: dict[str, ExpertTask] = {}

    async def dispatch(self, *, expert_id: str, expert_name: str, message: str,
                       system_prompt: str, tools: Optional[list[str]] = None,
                       api_key: str = "", api_base: str = "", model: str = "deepseek-chat",
                       timeout: float = 60.0) -> ExpertTask:
        task = ExpertTask(expert_id=expert_id, expert_name=expert_name, message=message)
        self._tasks[task.task_id] = task
        task.started_at = time.time()
        task.status = TaskStatus.RUNNING
        task._task_handle = asyncio.create_task(
            self._run_expert(task, system_prompt, tools, api_key, api_base, model, timeout)
        )
        return task

    async def dispatch_and_wait(self, *, expert_id: str, expert_name: str, message: str,
                                system_prompt: str, tools: Optional[list[str]] = None,
                                api_key: str = "", api_base: str = "", model: str = "deepseek-chat",
                                timeout: float = 120.0) -> dict:
        task = await self.dispatch(
            expert_id=expert_id, expert_name=expert_name, message=message,
            system_prompt=system_prompt, tools=tools,
            api_key=api_key, api_base=api_base, model=model, timeout=timeout,
        )
        result = await self._wait_one_task(task.task_id, timeout=timeout)
        if result:
            result["content"] = task.content
            result["content_length"] = len(task.content)
            result["duration"] = result.get("duration", 0)
        return result

    async def _run_expert(self, task: ExpertTask, system_prompt: str,
                          tools: Optional[list[str]], api_key: str,
                          api_base: str, model: str, timeout: float):
        try:
            messages = []
            if system_prompt:
                messages.append({"role": "system", "content": system_prompt})
            messages.append({"role": "user", "content": task.message})

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
                "max_tokens": 16384,
                "stream": False,
                "frequency_penalty": 0.3,
                "presence_penalty": 0.1,
            }
            if tool_defs:
                payload["tools"] = tool_defs
                payload["tool_choice"] = "auto"

            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {api_key}",
            }

            max_iterations = 7
            all_tools_used = []
            final_content = ""
            parse_count = 0

            print(f"[EXPERT] {task.expert_name}({task.expert_id}) starting, tools={tools[:3] if tools else 'none'}...")
            print(f"[EXPERT] prompt_len={len(system_prompt)} msg_len={len(task.message)}")

            async with httpx.AsyncClient(timeout=30.0) as client:
                for iteration in range(max_iterations):
                    if task._cancel_event.is_set():
                        task.status = TaskStatus.STOPPED
                        return

                    resp = await client.post(
                        f"{api_base}/chat/completions",
                        json=payload, headers=headers,
                    )
                    if resp.status_code != 200:
                        task.status = TaskStatus.FAILED
                        task.error = f"API {resp.status_code}"
                        return

                    data = resp.json()
                    choice = data.get("choices", [{}])[0]
                    msg = choice.get("message", {})

                    tool_calls = msg.get("tool_calls", [])
                    tc_names = [tc["function"]["name"] for tc in tool_calls]
                    print(f"[EXPERT] iter={iteration+1} tool_calls={tc_names}")

                    if tool_calls:
                        # 🔒 引擎层硬限制：document_parse 最多2次（过滤+防竞态）
                        remaining = max(0, 2 - parse_count)
                        filtered_tool_calls = []
                        for tc in tool_calls:
                            if tc["function"]["name"] == "document_parse":
                                if remaining > 0:
                                    remaining -= 1
                                    parse_count += 1
                                    filtered_tool_calls.append(tc)
                                # 超出限制：丢弃该 tool_call（不执行，不追加到消息）
                            else:
                                filtered_tool_calls.append(tc)

                        # 如果有被丢弃的 document_parse，注入系统消息
                        dropped = len(tool_calls) - len(filtered_tool_calls)
                        if dropped > 0:
                            print(f"[EXPERT] 🔒 拦截{dropped}个超限document_parse (总计{parse_count}次)")
                            messages.append({
                                "role": "system",
                                "content": "⚠️ 已读取足够文件内容。立即输出完整案卷评查报告（8步流程），不要再调用任何工具。现在开始输出。"
                            })

                        results = await asyncio.gather(*[_exec_one(tc) for tc in filtered_tool_calls])

                        messages.append(msg)
                        for tc, result in zip(filtered_tool_calls, results):
                            all_tools_used.append(tc["function"]["name"])
                            messages.append({
                                "role": "tool",
                                "tool_call_id": tc["id"],
                                "content": json.dumps(result, ensure_ascii=False)[:2000],
                            })
                        continue

                    final_content = msg.get("content", "")
                    print(f"[EXPERT] iter={iteration+1} final_content_len={len(final_content)}")
                    break

            task.content = final_content
            print(f"[EXPERT] {task.expert_name} done: {len(final_content)} chars, tools={all_tools_used}")
            task.tools_used = all_tools_used
            task.status = TaskStatus.COMPLETED
            task.finished_at = time.time()
            logger.info(f"专家完成: {task.expert_name} -> {len(final_content)}字符, {len(all_tools_used)}个工具")

        except asyncio.CancelledError:
            task.status = TaskStatus.STOPPED
        except Exception as e:
            task.status = TaskStatus.FAILED
            task.error = str(e)[:500]
            task.finished_at = time.time()
            logger.error(f"专家失败: {task.expert_name} -> {e}")

    async def _execute_tools_parallel(self, tool_calls: list, task: ExpertTask) -> list:
        return await asyncio.gather(*[_exec_one(tc) for tc in tool_calls])

    async def get_task(self, task_id: str) -> Optional[dict]:
        task = self._tasks.get(task_id)
        if not task:
            return None
        return task.to_dict()

    async def stop_task(self, task_id: str) -> bool:
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
        tasks = list(self._tasks.values())
        if status:
            tasks = [t for t in tasks if t.status.value == status]
        return [t.to_dict() for t in tasks]

    async def _wait_one_task(self, task_id: str, timeout: float = 120) -> dict:
        deadline = time.time() + timeout
        while time.time() < deadline:
            t = await self.get_task(task_id)
            if not t or t["status"] in ("completed", "failed", "stopped"):
                return t or {"task_id": task_id, "status": "unknown"}
            await asyncio.sleep(0.5)
        t = await self.get_task(task_id)
        if t:
            t["status"] = "timeout"
            t["content"] = (t.get("content") or "") + "\n[超时]"
        return t or {"task_id": task_id, "status": "timeout", "content": ""}

    async def wait_all(self, task_ids: list[str], timeout: float = 120) -> dict[str, dict]:
        tasks = [asyncio.create_task(self._wait_one_task(tid, timeout)) for tid in task_ids]
        done, _ = await asyncio.wait(tasks, timeout=timeout)
        return {tid: result for tid, result in [t.result() for t in done]}


# 全局单例
_team_engine: Optional[ExpertTeamEngine] = None


def get_team_engine() -> ExpertTeamEngine:
    global _team_engine
    if _team_engine is None:
        _team_engine = ExpertTeamEngine()
    return _team_engine


async def _exec_one(tc: dict) -> dict:
    """执行单个工具调用 — 模块级函数，供 _run_expert 和 _execute_tools_parallel 共用"""
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
