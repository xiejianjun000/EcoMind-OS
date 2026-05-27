"""
Agent 业务逻辑服务 — EcoMind 自建引擎版 v2.0。

v2.0 新增:
  - 部门智能体自动初始化（19个部门）
  - 基于 ECC Skills 的部门路由
  - DepartmentAgentManager — 部门→Agent 映射管理
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime
from typing import Any, Optional

from api.schemas.agent import (
    AgentCreateRequest,
    AgentMessageRequest,
    AgentProvider,
    AgentResponse,
    AgentStatus,
    AgentUpdateStatusRequest,
    AgentMessageResponse,
    AgentListResponse,
    AgentTierResponse,
)
from engine.loop import AgentConfig, AgentTier, EcoAgentEngine
from engine.verify import get_verifier
from engine.memory import get_memory

logger = logging.getLogger(__name__)

_TIER_MAP = {
    AgentTierResponse.OPUS: AgentTier.OPUS,
    AgentTierResponse.SONNET: AgentTier.SONNET,
    AgentTierResponse.HAIKU: AgentTier.HAIKU,
}


class AgentRecord:
    """Agent 运行时记录（内存存储）。"""

    def __init__(self, agent_id: str, request: AgentCreateRequest) -> None:
        self.agent_id = agent_id
        self.name = request.name
        self.description = request.description
        self.status = AgentStatus.STOPPED
        self.provider = request.provider
        self.model = request.model
        self.soul = request.soul
        self.temperature = request.temperature
        self.max_tokens = request.max_tokens
        self.max_iterations = request.max_iterations
        self.tier = request.tier
        self.verify_enabled = request.taiji_verify_enabled
        self.tools = request.tools
        self.metadata = request.metadata or {}
        self.created_at = datetime.now()
        self.updated_at = datetime.now()
        self._engine: Optional[EcoAgentEngine] = None
        self._lock = asyncio.Lock()
        # 🆕 部门绑定
        self.department: str = request.metadata.get("department", "") if request.metadata else ""
        self.skills: list[str] = request.tools or []

    def to_response(self) -> AgentResponse:
        return AgentResponse(
            agent_id=self.agent_id,
            name=self.name,
            description=self.description,
            status=self.status,
            provider=self.provider,
            model=self.model,
            soul=self.soul,
            temperature=self.temperature,
            max_tokens=self.max_tokens,
            max_iterations=self.max_iterations,
            tier=self.tier,
            taiji_verify_enabled=self.verify_enabled,
            tools=self.tools,
            metadata=self.metadata,
            created_at=self.created_at,
            updated_at=self.updated_at,
        )


class AgentService:
    """
    Agent 业务逻辑服务 — EcoMind 自建引擎版。

    CRUD + 状态管理 + 消息交互 + 部门智能体管理。
    """

    def __init__(self) -> None:
        self._agents: dict[str, AgentRecord] = {}
        self._dept_agents: dict[str, str] = {}  # department → agent_id
        self._memory = get_memory()

    async def create_agent(self, request: AgentCreateRequest) -> AgentResponse:
        """创建新 Agent（支持部门绑定）"""
        agent_id = str(uuid.uuid4())
        record = AgentRecord(agent_id=agent_id, request=request)

        # 处理部门绑定
        if request.metadata:
            record.department = request.metadata.get("department", "")
            if record.department:
                self._dept_agents[record.department] = agent_id

        # 初始化 EcoAgentEngine
        try:
            config = AgentConfig(
                provider=request.provider.value,
                model=request.model,
                soul=request.soul,
                temperature=request.temperature,
                max_tokens=request.max_tokens,
                max_iterations=request.max_iterations,
                stream=True,
                tools=request.tools or [],
                tier=_TIER_MAP.get(request.tier, AgentTier.SONNET),
                verify_enabled=request.taiji_verify_enabled,
            )
            engine = EcoAgentEngine(
                config=config,
                on_progress=self._make_progress_callback(agent_id, request.name),
            )
            record._engine = engine
            logger.info(f"EcoAgentEngine 初始化成功: {agent_id} ({request.name}) [部门: {record.department or '无'}]")
        except Exception as e:
            logger.error(f"Agent 引擎初始化失败: {agent_id}, 错误: {e}")

        self._agents[agent_id] = record
        return record.to_response()

    async def create_dept_agent(
        self,
        department: str,
        agent_name: str,
        soul: str = "",
        tools: list[str] | None = None,
        instinct_rules: list[str] | None = None,
        model: str = "deepseek-chat",
        provider: str = "deepseek",
        agent_key: str = "",
    ) -> AgentResponse:
        """🆕 创建部门专属智能体（优先使用 EcoMind 工作区文件）"""
        from skills.ecc_bridge import get_dept_loader

        if tools is None:
            tools = []
        if instinct_rules is None:
            instinct_rules = []

        # 检查是否已存在
        if department in self._dept_agents:
            existing_id = self._dept_agents[department]
            if existing_id in self._agents:
                return self._agents[existing_id].to_response()

        # 🆕 优先从 EcoMind 工作区组装 system prompt
        loader = get_dept_loader()
        workspace_prompt = loader.assemble_agent_prompt(agent_key, department) if agent_key else soul

        # 构建完整 soul（工作区 prompt 或手动 soul + instincts）
        if workspace_prompt and workspace_prompt != loader.get_default_soul(department):
            full_soul = workspace_prompt
            # 补充 instinct rules 到工作区 prompt
            if instinct_rules:
                full_soul += "\n\n## 🔴 强制直觉规则 (Instincts)\n"
                for i, rule in enumerate(instinct_rules, 1):
                    full_soul += f"{i}. {rule}\n"
        else:
            full_soul = soul
            if instinct_rules:
                full_soul += "\n\n## 🔴 强制直觉规则 (Instincts)\n"
                for i, rule in enumerate(instinct_rules, 1):
                    full_soul += f"{i}. {rule}\n"

        request = AgentCreateRequest(
            name=agent_name,
            description=f"{department}专属AI智能体",
            provider=AgentProvider(provider),
            model=model,
            soul=full_soul,
            temperature=0.3,
            max_tokens=4096,
            max_iterations=10,
            tier=AgentTierResponse.SONNET,
            taiji_verify_enabled=True,
            tools=tools,
            metadata={"department": department, "agent_type": "department", "agent_key": agent_key},
        )

        response = await self.create_agent(request)
        self._dept_agents[department] = response.agent_id
        logger.info(f"部门智能体已创建: {department} → {agent_name} ({response.agent_id}) [workspace: {bool(workspace_prompt)}]")
        return response

    async def init_all_dept_agents(self) -> dict:
        """🆕 一键初始化全部19个部门智能体"""
        from skills.ecc_bridge import get_dept_loader

        loader = get_dept_loader()
        dept_agents = loader.get_all_dept_agents()
        results = {"initialized": 0, "agents": []}

        for da in dept_agents:
            try:
                system_prompt, tools, instincts = loader.get_prompt_for_dept(da.department)
                response = await self.create_dept_agent(
                    department=da.department,
                    agent_name=da.display_name,
                    soul=system_prompt or loader.get_default_soul(da.department),
                    tools=tools,
                    instinct_rules=instincts,
                    agent_key=da.key,
                )
                results["agents"].append(response.model_dump() if hasattr(response, 'model_dump') else response)
                results["initialized"] += 1
            except Exception as e:
                logger.error(f"初始化部门智能体失败 [{da.department}]: {e}")

        logger.info(f"已初始化 {results['initialized']} 个部门智能体")
        return results

    async def get_agent_by_department(self, department: str) -> Optional[AgentResponse]:
        """🆕 根据部门获取智能体"""
        agent_id = self._dept_agents.get(department)
        if not agent_id:
            return None
        record = self._agents.get(agent_id)
        return record.to_response() if record else None

    async def send_to_department(
        self, department: str, message: str, session_id: Optional[str] = None,
    ) -> AgentMessageResponse:
        """🆕 向部门智能体发送消息"""
        from skills.ecc_bridge import get_dept_loader

        agent_id = self._dept_agents.get(department)
        if not agent_id:
            # 自动创建
            loader = get_dept_loader()
            da = loader.get_dept_agent(department)
            if da:
                system_prompt, tools, instincts = loader.get_prompt_for_dept(da.department)
                resp = await self.create_dept_agent(
                    department=da.department,
                    agent_name=da.display_name,
                    soul=system_prompt or loader.get_default_soul(da.department),
                    tools=tools,
                    instinct_rules=instincts,
                    agent_key=da.key,
                )
                agent_id = resp.agent_id
            else:
                return AgentMessageResponse(
                    agent_id="", message=f"未找到部门 '{department}' 的智能体配置", status="error",
                )

        if agent_id not in self._agents:
            return AgentMessageResponse(
                agent_id=agent_id, message="部门智能体未就绪", status="error",
            )

        request = AgentMessageRequest(message=message, session_id=session_id)
        return await self.send_message(agent_id, request)

    async def list_agents(
        self,
        status: Optional[AgentStatus] = None,
        provider: Optional[AgentProvider] = None,
        department: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> AgentListResponse:
        """列出所有 Agent（支持按部门筛选）"""
        records = list(self._agents.values())

        if department:
            dept_id = self._dept_agents.get(department)
            records = [r for r in records if r.agent_id == dept_id or r.department == department]

        if status:
            records = [r for r in records if r.status == status]
        if provider:
            records = [r for r in records if r.provider == provider]

        records.sort(key=lambda r: r.updated_at, reverse=True)
        total = len(records)
        records = records[offset: offset + limit]

        return AgentListResponse(
            agents=[r.to_response() for r in records],
            total=total,
        )

    async def get_agent(self, agent_id: str) -> Optional[AgentResponse]:
        """获取 Agent 详情"""
        record = self._agents.get(agent_id)
        return record.to_response() if record else None

    async def update_status(
        self, agent_id: str, request: AgentUpdateStatusRequest,
    ) -> Optional[AgentResponse]:
        """更新 Agent 运行状态"""
        record = self._agents.get(agent_id)
        if not record:
            return None

        async with record._lock:
            old_status = record.status
            record.status = request.status
            record.updated_at = datetime.now()

            if request.status == AgentStatus.RUNNING:
                logger.info(f"Agent {agent_id} 启动运行")
            elif request.status == AgentStatus.STOPPED:
                logger.info(f"Agent {agent_id} 已停止")
            elif request.status == AgentStatus.PAUSED:
                logger.info(f"Agent {agent_id} 已暂停")

        self._notify_ws("agent:status", {
            "agent_id": agent_id,
            "old_status": old_status.value,
            "new_status": request.status.value,
            "name": record.name,
        })

        return record.to_response()

    async def send_message(
        self, agent_id: str, request: AgentMessageRequest,
    ) -> AgentMessageResponse:
        """向 Agent 发送消息并获取回复"""
        record = self._agents.get(agent_id)
        if not record:
            return AgentMessageResponse(
                agent_id=agent_id, message="Agent 不存在", status="error",
            )

        if record.status == AgentStatus.STOPPED:
            return AgentMessageResponse(
                agent_id=agent_id, message="Agent 未运行，请先启动", status="error",
            )

        if record._engine is None:
            return AgentMessageResponse(
                agent_id=agent_id, message="Agent 引擎不可用", status="error",
            )

        try:
            engine = record._engine

            session_id = request.session_id or str(uuid.uuid4())
            self._memory.add_message(session_id, "user", request.message)

            result = await engine.run(
                task=request.message,
                system_message=request.system_message,
            )

            hallucination_risk = 0.0
            if record.verify_enabled:
                verifier = get_verifier()
                vr = verifier.verify(
                    user_input=request.message,
                    llm_output=result.content,
                )
                hallucination_risk = 1.0 - vr.confidence
                if not vr.is_passing:
                    logger.warning(
                        f"Agent {agent_id} 输出验证未通过: verdict={vr.verdict}, "
                        f"confidence={vr.confidence:.2f}"
                    )

            self._memory.add_message(session_id, "assistant", result.content)

            content = result.content or ""
            if result.error:
                content = f"[执行出错] {result.error}"

            return AgentMessageResponse(
                agent_id=agent_id,
                message=content,
                iterations=result.iterations,
                tools_used=result.tools_used,
                hallucination_risk=hallucination_risk,
                status=result.status.value,
                session_id=session_id,
            )

        except Exception as e:
            logger.error(f"Agent {agent_id} 消息处理异常: {e}")
            return AgentMessageResponse(
                agent_id=agent_id,
                message=f"处理消息时发生错误: {e}",
                status="error",
            )

    def agent_exists(self, agent_id: str) -> bool:
        return agent_id in self._agents

    def get_all_departments(self) -> list[dict]:
        """🆕 获取所有部门的智能体状态"""
        result = []
        for dept, agent_id in self._dept_agents.items():
            record = self._agents.get(agent_id)
            result.append({
                "department": dept,
                "agent_id": agent_id,
                "agent_name": record.name if record else "",
                "status": record.status.value if record else "unknown",
            })
        return result

    # ─── 内部方法 ──────────────────────────────

    def _make_progress_callback(self, agent_id: str, agent_name: str):
        def callback(event_type: str, data: dict[str, Any]) -> None:
            self._notify_ws("agent:progress", {
                "agent_id": agent_id,
                "agent_name": agent_name,
                "event": event_type,
                "data": data,
            })
        return callback

    @staticmethod
    def _notify_ws(topic: str, data: dict[str, Any]) -> None:
        try:
            from api.main import ws_manager
            ws_manager.enqueue_broadcast(topic, data)
        except Exception:
            pass


# 全局单例
_agent_service: Optional[AgentService] = None


def get_agent_service() -> AgentService:
    global _agent_service
    if _agent_service is None:
        _agent_service = AgentService()
    return _agent_service
