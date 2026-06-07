"""
EcoMind Agent Loop — 自建 Agent 对话循环引擎。

不依赖 taiji_agent、Claude Code、LangChain 等任何外部 Agent 框架。
纯 Python asyncio + HTTPX 调 LLM API（OpenAI 兼容格式）。

核心流程：
  用户输入 → 拼 system prompt → 调 LLM API
    → 解析响应
      ├─ 有 tool_call → 执行工具 → 结果追加到上下文 → 继续调 LLM
      └─ 无 tool_call → 流式返回最终结果

安全边界：
  - max_iterations: 最多循环轮数（防死循环）
  - max_tokens: 单次 API 调用最大 token 数
  - temperature: 控制创造性
  - 每轮通过回调通知 WebSocket 推送进度
"""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, AsyncIterator, Callable, Optional

import httpx

from .tool_registry import EcoToolRegistry, get_tool_registry

logger = logging.getLogger(__name__)


# ─── 枚举 ───────────────────────────────────────────

class AgentRunStatus(str, Enum):
    RUNNING = "running"
    COMPLETED = "completed"
    ERROR = "error"
    MAX_ITERATIONS = "max_iterations"


class AgentTier(str, Enum):
    OPUS = "opus"
    SONNET = "sonnet"
    HAIKU = "haiku"


# ─── 配置 ───────────────────────────────────────────

@dataclass
class AgentConfig:
    """Agent 运行时配置"""
    provider: str = "deepseek"            # 模型提供商
    model: str = "deepseek-chat"          # 模型名称
    soul: str = ""                        # Agent 角色/灵魂定义
    temperature: float = 0.7
    max_tokens: int = 4096
    max_iterations: int = 20              # 最多循环轮数（含思考+纠错）
    stream: bool = True                   # 是否流式输出
    tools: list[str] = field(default_factory=list)  # 启用的工具名列表
    tier: AgentTier = AgentTier.SONNET    # 模型层级

    # 验证开关
    verify_enabled: bool = True           # 是否启用输出验证

    def to_dict(self) -> dict:
        return {
            "provider": self.provider,
            "model": self.model,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
            "max_iterations": self.max_iterations,
        }


# ─── 结果 ───────────────────────────────────────────

@dataclass
class AgentResult:
    """Agent 执行结果"""
    content: str
    status: AgentRunStatus
    iterations: int = 0
    tools_used: list[str] = field(default_factory=list)
    error: Optional[str] = None
    hallucination_risk: float = 0.0
    started_at: datetime = field(default_factory=datetime.now)
    finished_at: Optional[datetime] = None
    session_id: str = field(default_factory=lambda: str(uuid.uuid4()))


# ─── 进度回调类型 ───────────────────────────────────

ProgressCallback = Callable[[str, dict[str, Any]], None]
"""
进度回调: (event_type, data) -> None
event_type: "thinking" | "tool_call" | "tool_result" | "text_delta" | "completed" | "error"
"""


# ─── 引擎 ───────────────────────────────────────────

class EcoAgentEngine:
    """
    EcoMind 自主 Agent 对话引擎。

    使用方式:
        engine = EcoAgentEngine(config)
        async for chunk in engine.run("湘江水质怎么样？"):
            print(chunk, end="")
    """

    def __init__(
        self,
        config: AgentConfig,
        *,
        tool_registry: Optional[EcoToolRegistry] = None,
        api_key: Optional[str] = None,
        api_base: Optional[str] = None,
        on_progress: Optional[ProgressCallback] = None,
    ) -> None:
        self.config = config
        self.tool_registry = tool_registry or get_tool_registry()
        self.on_progress = on_progress

        # API 配置 — 优先使用传入参数，其次环境变量
        self.api_key = api_key or self._get_api_key(config.provider)
        self.api_base = api_base or self._get_api_base(config.provider)

        # 最后一次运行的最终状态（由 run_stream 设置）
        self._last_status: Optional[AgentRunStatus] = None
        self._last_iterations: int = 0
        self._last_tools_used: list[str] = []

    # ─── 公开 API ─────────────────────────────────

    async def run(self, task: str, system_message: Optional[str] = None) -> AgentResult:
        """
        执行 Agent 任务（非流式，返回完整结果）

        Args:
            task: 用户任务
            system_message: 自定义系统提示（覆盖 config.soul）

        Returns:
            AgentResult: 执行结果
        """
        # 收集流式输出
        final_content = ""
        async for text_delta in self.run_stream(task, system_message):
            final_content += text_delta

        # 去尾重复 —— 引擎层统一后处理，所有调用路径都受益
        final_content = self._dedup_tail(final_content)

        # 从 run_stream 的最终状态获取结果
        return AgentResult(
            content=final_content,
            status=self._last_status or AgentRunStatus.ERROR,
            iterations=self._last_iterations or 0,
            tools_used=getattr(self, "_last_tools_used", []),
            finished_at=datetime.now(),
        )

    async def run_stream(
        self, task: str, system_message: Optional[str] = None
    ) -> AsyncIterator[str]:
        """
        流式执行 Agent 任务

        核心循环：
        1. 构建消息列表
        2. 调 LLM API（流式）
        3. 解析响应 → 如有 tool_call 则执行 → 追加结果 → 回到 2
        4. 无 tool_call → 流式输出文本 → 结束

        Args:
            task: 用户任务
            system_message: 自定义系统提示

        Yields:
            str: 文本增量（流式）
        """
        result = AgentResult(content="", status=AgentRunStatus.RUNNING)

        # 构建消息
        messages = self._build_messages(task, system_message)

        iteration = 0
        tools_used: list[str] = []

        while iteration < self.config.max_iterations:
            iteration += 1
            logger.debug(f"Agent Loop 第 {iteration}/{self.config.max_iterations} 轮")

            # 获取可用工具 schema
            tool_schemas = self.tool_registry.get_openai_schemas(self.config.tools)

            try:
                # 调 LLM API
                async for event_type, data in self._call_llm_stream(messages, tool_schemas):
                    if event_type == "text_delta":
                        yield data["text"]

                    elif event_type == "tool_call":
                        # 收集当前轮所有 tool_calls
                        tool_calls = data.get("tool_calls", [])
                        if not tool_calls:
                            continue

                        # 并行执行所有工具调用
                        async def _exec_tool(tc):
                            tool_name = tc["name"]
                            try:
                                tool_args = json.loads(tc.get("arguments", "{}"))
                            except (json.JSONDecodeError, TypeError) as e:
                                return {
                                    "tool_call_id": tc.get("id", str(uuid.uuid4())),
                                    "name": tool_name,
                                    "result": f"[参数解析失败] JSON格式错误: {e}. 原始参数: {tc.get('arguments', '')[:200]}",
                                }
                            self._emit_progress("tool_call", {
                                "name": tool_name, "arguments": tool_args, "iteration": iteration,
                            })
                            try:
                                tool_output = await self.tool_registry.execute(tool_name, **tool_args)
                                self._emit_progress("tool_result", {
                                    "name": tool_name, "success": True, "iteration": iteration,
                                })
                                return {
                                    "tool_call_id": tc.get("id", str(uuid.uuid4())),
                                    "name": tool_name, "result": str(tool_output),
                                }
                            except Exception as e:
                                self._emit_progress("tool_result", {
                                    "name": tool_name, "success": False, "iteration": iteration,
                                })
                                return {
                                    "tool_call_id": tc.get("id", str(uuid.uuid4())),
                                    "name": tool_name, "result": f"[工具执行失败] {e}",
                                }

                        tool_results = await asyncio.gather(*[_exec_tool(tc) for tc in tool_calls])
                        for tr in tool_results:
                            tools_used.append(tr["name"])

                        # 将工具结果追加到消息列表，继续循环
                        self._append_tool_results(messages, tool_calls, tool_results)

                    elif event_type == "finished":
                        # LLM 返回了最终响应（无 tool_call）
                        self._emit_progress("completed", {
                            "iterations": iteration,
                            "tools_used": tools_used,
                        })
                        result.content = data.get("content", "")
                        result.status = AgentRunStatus.COMPLETED
                        result.iterations = iteration
                        result.tools_used = tools_used
                        result.finished_at = datetime.now()
                        self._last_status = AgentRunStatus.COMPLETED
                        self._last_iterations = iteration
                        self._last_tools_used = list(tools_used)
                        return

                    elif event_type == "error":
                        self._emit_progress("error", {"error": data.get("error", "未知错误")})
                        result.status = AgentRunStatus.ERROR
                        result.error = data.get("error")
                        result.iterations = iteration
                        result.tools_used = tools_used
                        result.finished_at = datetime.now()
                        self._last_status = AgentRunStatus.ERROR
                        self._last_iterations = iteration
                        self._last_tools_used = list(tools_used)
                        yield f"\n[错误] {data.get('error', '未知错误')}"
                        return

            except Exception as e:
                logger.error(f"Agent Loop 异常: {e}")
                self._emit_progress("error", {"error": str(e)})
                result.status = AgentRunStatus.ERROR
                result.error = str(e)
                result.iterations = iteration
                result.tools_used = tools_used
                result.finished_at = datetime.now()
                self._last_status = AgentRunStatus.ERROR
                self._last_iterations = iteration
                self._last_tools_used = list(tools_used)
                yield f"\n[系统错误] {e}"
                return

        # 达到最大迭代次数
        result.status = AgentRunStatus.MAX_ITERATIONS
        result.iterations = iteration
        result.tools_used = tools_used
        result.finished_at = datetime.now()
        self._last_status = AgentRunStatus.MAX_ITERATIONS
        self._last_iterations = iteration
        self._last_tools_used = list(tools_used)
        self._emit_progress("completed", {
            "status": "max_iterations",
            "iterations": iteration,
        })

    # ─── 内部方法 ───────────────────────────────

    @staticmethod
    def _dedup_tail(text: str) -> str:
        """去除 LLM 尾部重复——引擎层统一后处理。

        三层检测：首尾相同 → 紧邻重复 → 句边界重复，迭代剥离直到干净。
        """
        if not text or len(text) < 6:
            return text

        for _ in range(5):  # 最多 5 轮迭代剥离
            changed = False
            n = len(text)

            # 第一层：首尾相同
            for k in range(n // 2, 3, -1):
                if text[:k] == text[-k:]:
                    text = text[:-k]
                    changed = True
                    break
            if changed:
                continue

            # 第二层：尾部紧邻重复
            for k in range(n // 2, 3, -1):
                if text[-k:] == text[-(2 * k):-k]:
                    text = text[:-k]
                    changed = True
                    break
            if changed:
                continue

            # 第三层：句边界重复
            import re
            sentences = re.split(r'(?<=[。！？\n])\s*', text)
            sentences = [s.rstrip() for s in sentences if s.strip()]
            if len(sentences) >= 2:
                last = sentences[-1]
                prev = sentences[-2]
                if last == prev:
                    text = ''.join(sentences[:-1])
                    changed = True
                elif len(prev) > len(last) and prev.endswith(last):
                    text = ''.join(sentences[:-1])
                    changed = True
                elif len(last) > len(prev) and last.startswith(prev):
                    sentences[-1] = last[len(prev):].lstrip('，。！？')
                    text = ''.join(s for s in sentences if s.strip())
                    changed = True

            if not changed:
                break

        return text

    # ─── 全局输出约束（注入所有 Agent，不区分角色）─────
    _GLOBAL_FORMAT_RULES = """
## 输出格式（强制）
- 用自然段落回答，禁止分节标题（###）、表格、bullet 列表、**加粗标题**分节
- 回答长度与问题复杂度成正比：简单问候 2-3 句，复杂问题可展开但不啰嗦
- 禁止在回复末尾重复最后一句话或短语——说完就停
- 禁止对用户展示内部工具名、函数名或行内代码格式
- 禁止自夸语气（"我具备强大的XX能力""作为XX我可以协调编排多个专家"），直接说能做什么
- 当用户问"你能做什么"时，用 3-4 句自然口语回答，点名核心方向即可，不要展开成带标题的清单
- 当用户问"你是谁"时，用 1-2 句自然介绍即可
- 禁止使用 emoji 作为分节符号或排版元素，每段最多 1 个 emoji
- 回复中不要使用 --- 分隔线"""

    def _build_messages(
        self, task: str, system_message: Optional[str] = None
    ) -> list[dict[str, Any]]:
        """构建消息列表"""
        messages: list[dict[str, Any]] = []

        # System prompt — 始终追加全局格式约束
        soul = system_message or self.config.soul or self._default_soul()
        soul = soul.rstrip() + "\n\n" + self._GLOBAL_FORMAT_RULES
        messages.append({"role": "system", "content": soul})

        # User message
        messages.append({"role": "user", "content": task})

        return messages

    def _default_soul(self) -> str:
        return "你是 EcoMind 助手。问候只回两字\"你好\"。禁止自我介绍和功能罗列。不回任何多余的话。"

    async def _call_llm_stream(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict],
    ) -> AsyncIterator[tuple[str, dict[str, Any]]]:
        """
        调用 LLM API 流式请求

        Yields:
            (event_type, data) 元组:
            - ("text_delta", {"text": "..."})
            - ("tool_call", {"tool_calls": [...]})
            - ("finished", {"content": "..."})
            - ("error", {"error": "..."})
        """
        payload = {
            "model": self.config.model,
            "messages": messages,
            "temperature": self.config.temperature,
            "max_tokens": self.config.max_tokens,
            "stream": True,
            "frequency_penalty": 2.0,
            "presence_penalty": 1.5,
        }

        if tools:
            payload["tools"] = tools
            payload["tool_choice"] = "auto"

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }

        url = f"{self.api_base}/chat/completions"

        self._emit_progress("thinking", {"iteration": "start"})

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                async with client.stream("POST", url, json=payload, headers=headers) as response:
                    if response.status_code != 200:
                        error_text = await response.aread()
                        yield ("error", {"error": f"API 返回 {response.status_code}: {error_text[:500]}"})
                        return

                    # 流式解析 SSE
                    accumulated_content = ""
                    tool_calls_accumulator: dict[int, dict] = {}

                    async for line in response.aiter_lines():
                        if not line or not line.startswith("data: "):
                            continue
                        data_str = line[6:]  # 去掉 "data: " 前缀
                        if data_str == "[DONE]":
                            break

                        try:
                            chunk = json.loads(data_str)
                        except json.JSONDecodeError:
                            continue

                        choices = chunk.get("choices", [])
                        if not choices:
                            continue

                        delta = choices[0].get("delta", {})

                        # 文本增量
                        content = delta.get("content", "")
                        if content:
                            accumulated_content += content
                            yield ("text_delta", {"text": content})

                        # 工具调用增量
                        tool_calls = delta.get("tool_calls", [])
                        for tc in tool_calls:
                            idx = tc.get("index", 0)
                            if idx not in tool_calls_accumulator:
                                tool_calls_accumulator[idx] = {
                                    "id": tc.get("id", ""),
                                    "name": "",
                                    "arguments": "",
                                }
                            acc = tool_calls_accumulator[idx]
                            if tc.get("id"):
                                acc["id"] = tc["id"]
                            if tc.get("function", {}).get("name"):
                                acc["name"] = tc["function"]["name"]
                            if tc.get("function", {}).get("arguments"):
                                acc["arguments"] += tc["function"]["arguments"]

                        # 检查是否完成
                        finish_reason = choices[0].get("finish_reason")
                        if finish_reason == "tool_calls" and tool_calls_accumulator:
                            yield ("tool_call", {
                                "tool_calls": list(tool_calls_accumulator.values()),
                            })
                            return
                        elif finish_reason == "stop":
                            yield ("finished", {"content": accumulated_content})
                            return

                    # 流结束
                    if tool_calls_accumulator:
                        yield ("tool_call", {
                            "tool_calls": list(tool_calls_accumulator.values()),
                        })
                    else:
                        yield ("finished", {"content": accumulated_content})

        except httpx.TimeoutException:
            yield ("error", {"error": "LLM API 请求超时"})
        except Exception as e:
            logger.error(f"LLM API 调用异常: {e}")
            yield ("error", {"error": str(e)})

    def _append_tool_results(
        self,
        messages: list[dict[str, Any]],
        tool_calls: list[dict],
        tool_results: list[dict],
    ) -> None:
        """将工具调用和结果追加到消息列表"""
        # 追加 assistant 消息（tool_calls）
        assistant_msg = {
            "role": "assistant",
            "content": None,
            "tool_calls": [
                {
                    "id": tc["id"] or str(uuid.uuid4()),
                    "type": "function",
                    "function": {
                        "name": tc["name"],
                        "arguments": tc.get("arguments", "{}"),
                    },
                }
                for tc in tool_calls
            ],
        }
        messages.append(assistant_msg)

        # 追加 tool 结果消息
        for tr in tool_results:
            messages.append({
                "role": "tool",
                "tool_call_id": tr["tool_call_id"],
                "content": tr["result"],
            })

    def _emit_progress(self, event_type: str, data: dict[str, Any]) -> None:
        """触发进度回调"""
        if self.on_progress:
            try:
                self.on_progress(event_type, data)
            except Exception:
                pass

    # ─── 静态工具方法 ──────────────────────────

    @staticmethod
    def _get_api_key(provider: str) -> str:
        """获取 API Key（从环境变量）"""
        import os
        key_map = {
            "deepseek": "DEEPSEEK_API_KEY",
            "qwen": "DASHSCOPE_API_KEY",
            "glm": "GLM_API_KEY",
            "openai": "OPENAI_API_KEY",
            "anthropic": "ANTHROPIC_API_KEY",
        }
        env_var = key_map.get(provider, f"{provider.upper()}_API_KEY")
        return os.environ.get(env_var, "")

    @staticmethod
    def _get_api_base(provider: str) -> str:
        """获取 API Base URL"""
        import os
        base_map = {
            "deepseek": "https://api.deepseek.com/v1",
            "qwen": "https://dashscope.aliyuncs.com/compatible-mode/v1",
            "glm": "https://open.bigmodel.cn/api/paas/v4",
            "openai": "https://api.openai.com/v1",
        }
        return os.environ.get(f"{provider.upper()}_API_BASE", base_map.get(provider, ""))
