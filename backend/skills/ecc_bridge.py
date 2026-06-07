"""
ECC Skills Bridge — 将 affaan-m/ECC (193K ⭐) 技能系统接入 EcoMind OS。

ECC 核心: Skills(声明式技能) + Instincts(直觉规则) + Memory(持久化) + Security(安全策略)

v2.0 新增:
  1. 19 个湖南省生态环境厅部门智能体的自动加载与路由
  2. HunanDeptLoader — 从 hunan-agents/ 目录加载所有部门智能体
  3. DepartmentRouter — 根据部门名称路由到对应智能体
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)


@dataclass
class ECCSkill:
    """ECC 格式技能定义 — 兼容 ECC 仓库的 skill.md 格式"""
    name: str
    description: str
    category: str
    triggers: list[str] = field(default_factory=list)
    instructions: str = ""
    tools: list[str] = field(default_factory=list)
    instinct_rules: list[str] = field(default_factory=list)
    priority: int = 0
    requires_approval: bool = False
    # 🆕 部门绑定
    department: str = ""
    display_name: str = ""
    model: str = "deepseek-671B"
    temperature: float = 0.3
    color: str = "#475569"
    emoji: str = ""


@dataclass
class DepartmentAgent:
    """部门智能体完整定义"""
    key: str
    department: str
    display_name: str
    priority: str  # P0/P1/P2/P3
    skill: ECCSkill


# ─── 6 大内置生态技能 ────────────────────────────────────

ECC_BUILTIN_SKILLS: list[ECCSkill] = [
    ECCSkill(
        name="environment-monitoring",
        description="环境监测与分析 — AQI/PM2.5/水质/噪声/土壤",
        category="environment",
        triggers=["监测", "AQI", "PM2.5", "水质", "噪声", "空气质量"],
        instructions="""## 环境监测技能
1. 调用 query_environment_data 获取实时数据
2. 趋势分析（同比/环比），超标标注预警
3. 引用国标 GB 3095-2012 / GB 3838-2002
4. 不确定数据标注"待核实"

## 输出格式
- 用自然段落回答，禁止分节标题（###）和表格
- 回答长度与问题复杂度成正比，简单问题 2-5 句
- 禁止在回复末尾重复最后一句话
""",
        tools=["query_environment_data", "generate_report"],
        instinct_rules=["数据来源必须可追溯", "超标自动预警", "不编造数据", "异常建议人工复核"],
        priority=10,
    ),
    ECCSkill(
        name="carbon-emission",
        description="碳排放管理 — 核算/配额/减排/碳达峰碳中和",
        category="carbon",
        triggers=["碳排放", "碳配额", "减排", "碳达峰", "碳中和", "CCER"],
        instructions="""## 碳排放管理技能
1. 调用 query_emission_data 获取数据
2. 按 Scope 1/2/3 核算
3. 引用《碳排放权交易管理办法》
4. 评估减排方法学合规性

## 输出格式
- 用自然段落回答，禁止分节标题（###）和表格
- 回答长度与问题复杂度成正比，简单问题 2-5 句
- 禁止在回复末尾重复最后一句话
""",
        tools=["query_emission_data", "generate_report", "search_regulation"],
        instinct_rules=["排放因子使用官方最新值", "CCER需核证方法学", "不保证未经验证的减排量"],
        priority=10,
    ),
    ECCSkill(
        name="enforcement-decision",
        description="执法辅助决策 — 违法判定/处罚建议/自由裁量",
        category="enforcement",
        triggers=["执法", "违法", "处罚", "罚款", "停产", "超标排放"],
        instructions="""## 执法辅助决策技能
1. 检索法规条款 search_regulation
2. 对照违法事实与法规要件
3. 引用《环境行政处罚办法》裁量基准
4. 生成处罚建议书（需人工审核）
5. 重大案件建议听证

## 输出格式
- 用自然段落回答，禁止分节标题（###）和表格
- 回答长度与问题复杂度成正比
- 禁止在回复末尾重复最后一句话
""",
        tools=["search_regulation", "submit_approval", "generate_report"],
        instinct_rules=["不做最终决定", "裁量范围给区间", "刑事标注移送公安", "AI辅助生成需人工审核"],
        priority=8,
        requires_approval=True,
    ),
    ECCSkill(
        name="approval-workflow",
        description="审批流程辅助 — 排污许可/环评/辐射安全",
        category="approval",
        triggers=["审批", "许可", "环评", "排污许可", "辐射安全"],
        instructions="""## 审批辅助技能
1. 识别审批类型和材料清单
2. submit_approval 启动流程
3. GOVMCP 三级审批: L1单签/L2双因子/L3会签+区块链
4. 跟踪进度和时限预警

## 输出格式
- 用自然段落回答，禁止分节标题（###）和表格
- 回答长度与问题复杂度成正比
- 禁止在回复末尾重复最后一句话
""",
        tools=["submit_approval", "search_regulation"],
        instinct_rules=["材料不齐列表提示", "法定期限前3天预警", "不替代审批人员决定"],
        priority=8,
    ),
    ECCSkill(
        name="report-generation",
        description="报告自动生成 — 日报/周报/月报/环评报告",
        category="environment",
        triggers=["报告", "报表", "日报", "周报", "月报", "环评报告"],
        instructions="""## 报告生成技能
1. 确定类型和时间范围
2. 收集环境监测数据
3. 按模板生成报告
4. 标注"AI辅助生成"

## 输出格式
- 用自然段落回答，禁止分节标题（###）和表格
- 回答长度与问题复杂度成正比
- 禁止在回复末尾重复最后一句话
""",
        tools=["generate_report", "query_environment_data", "query_emission_data"],
        instinct_rules=["数据标注来源和时间", "模板报告需人工审核"],
        priority=5,
    ),
    ECCSkill(
        name="security-audit",
        description="AI安全审计 — 结合 754 条安全技能检查",
        category="security",
        triggers=["安全", "审计", "漏洞", "攻击", "渗透", "合规检查"],
        instructions="""## 安全审计技能
1. 参照 MITRE ATT&CK / NIST CSF 2.0
2. 检查 AI 输出合规性
3. 审计日志完整性
4. 安全事件分级响应

## 输出格式
- 用自然段落回答，禁止分节标题（###）和表格
- 回答长度与问题复杂度成正比
- 禁止在回复末尾重复最后一句话
""",
        tools=["search_regulation"],
        instinct_rules=["安全漏洞立即告警", "不泄露审计细节", "建议标注风险等级"],
        priority=9,
    ),
]


# ─── 19 个部门智能体默认配置 ────────────────────────────

_DEFAULT_DEPT_CONFIG: list[dict] = [
    # P0
    {"key": "enforcement-agent", "dept": "生态环境执法局", "display": "执法办案智能体", "priority": "P0", "skills": ["enforcement-decision", "environment-monitoring", "report-generation"], "color": "#DC2626", "emoji": "⚖️"},
    {"key": "monitoring-agent", "dept": "生态环境监测处", "display": "监测分析智能体", "priority": "P0", "skills": ["environment-monitoring", "report-generation", "security-audit"], "color": "#2563EB", "emoji": "🔬"},
    {"key": "eia-approval-agent", "dept": "环境影响评价与排放管理处", "display": "环评审批智能体", "priority": "P0", "skills": ["approval-workflow", "security-audit"], "color": "#0E7490", "emoji": "📋"},
    {"key": "air-climate-agent", "dept": "大气环境与应对气候变化处", "display": "大气治理智能体", "priority": "P0", "skills": ["carbon-emission", "environment-monitoring", "report-generation"], "color": "#3B82F6", "emoji": "🌤️"},
    {"key": "water-agent", "dept": "水生态环境处", "display": "水环境治理智能体", "priority": "P0", "skills": ["environment-monitoring", "report-generation"], "color": "#06B6D4", "emoji": "💧"},
    {"key": "soil-agent", "dept": "土壤生态环境处", "display": "土壤治理智能体", "priority": "P0", "skills": ["environment-monitoring", "report-generation"], "color": "#92400E", "emoji": "🌱"},
    # P1
    {"key": "office-agent", "dept": "办公室", "display": "政务综合智能体", "priority": "P1", "skills": ["report-generation", "approval-workflow"], "color": "#475569", "emoji": "🏛️"},
    {"key": "coordination-agent", "dept": "综合协调处", "display": "综合协调智能体", "priority": "P1", "skills": ["environment-monitoring", "report-generation"], "color": "#2563EB", "emoji": "🔗"},
    {"key": "regulation-agent", "dept": "法规与标准处", "display": "法规标准智能体", "priority": "P1", "skills": ["enforcement-decision", "approval-workflow", "security-audit"], "color": "#7C3AED", "emoji": "📜"},
    {"key": "tech-finance-agent", "dept": "科技与财务处", "display": "科技财务智能体", "priority": "P1", "skills": ["report-generation"], "color": "#059669", "emoji": "💰"},
    {"key": "education-agent", "dept": "宣传教育与对外合作处", "display": "宣传合作智能体", "priority": "P1", "skills": ["report-generation"], "color": "#0891B2", "emoji": "📣"},
    # P2
    {"key": "inspection-1-agent", "dept": "省生态环境保护督察办公室", "display": "督察一智能体", "priority": "P2", "skills": ["enforcement-decision", "report-generation"], "color": "#DC2626", "emoji": "🔍"},
    {"key": "inspection-2-agent", "dept": "生态环境保护督察二处", "display": "督察二智能体", "priority": "P2", "skills": ["enforcement-decision", "report-generation"], "color": "#DC2626", "emoji": "🔎"},
    {"key": "inspection-3-agent", "dept": "生态环境保护督察三处", "display": "督察三智能体", "priority": "P2", "skills": ["enforcement-decision", "report-generation"], "color": "#DC2626", "emoji": "📋"},
    {"key": "solidwaste-agent", "dept": "固体废物与化学品处", "display": "固废管理智能体", "priority": "P2", "skills": ["environment-monitoring", "approval-workflow"], "color": "#92400E", "emoji": "🗑️"},
    {"key": "nuclear-agent", "dept": "核与辐射管理处", "display": "核辐射安全智能体", "priority": "P2", "skills": ["security-audit", "approval-workflow"], "color": "#F59E0B", "emoji": "☢️"},
    {"key": "ecology-agent", "dept": "自然生态保护处", "display": "生态保护智能体", "priority": "P2", "skills": ["environment-monitoring", "report-generation"], "color": "#16A34A", "emoji": "🌿"},
    # P3
    {"key": "hr-agent", "dept": "人事处", "display": "人事管理智能体", "priority": "P3", "skills": ["report-generation"], "color": "#6366F1", "emoji": "👥"},
    {"key": "party-agent", "dept": "厅直属机关党委", "display": "党建智能体", "priority": "P3", "skills": ["report-generation"], "color": "#DC2626", "emoji": "🏛️"},
]



@dataclass
class AgentWorkspace:
    """EcoMind 工作区 — 5 文件结构"""
    soul: str = ""           # SOUL.md — 人格、规则、沟通风格
    agents: str = ""         # AGENTS.md — 任务、工作流、输出格式
    identity: str = ""       # IDENTITY.md — 身份卡片
    memory: str = ""         # MEMORY.md — 持久化记忆
    tools: str = ""          # TOOLS.md — 工具列表
    heartbeat: str = ""      # HEARTBEAT.md — 心跳配置

    def assemble_system_prompt(self) -> str:
        """将工作区文件组装为完整的 system prompt"""
        parts = []
        if self.identity:
            parts.append(self.identity)
        if self.soul:
            parts.append(self.soul)
        if self.memory:
            parts.append(self.memory)
        if self.agents:
            parts.append(self.agents)
        if self.tools:
            parts.append(self.tools)
        return "\n\n---\n\n".join(parts)


class ECCInstinctEngine:
    """ECC Instincts 引擎 — 直觉规则优先于工具调用"""

    GLOBAL_INSTINCTS = [
        "绝不编造环境监测数据",
        "数值引用必须有来源",
        "不确定信息标注'待核实'",
        "执法建议标注'AI辅助生成，需人工审核'",
        "不得建议违法或规避监管的行为",
        "涉及国家安全的机密不做回答",
        "用自然段落回答，禁止分节标题（###）和表格格式",
        "回答长度与问题复杂度成正比，简单问候 2-3 句即可",
        "禁止在回复末尾重复最后一句话或短语——说完就停",
        "禁止对用户展示内部工具名或行内代码格式",
        "禁止自夸语气（\"我具备强大的XX能力\"），直接说能做什么",
    ]

    def __init__(self, skills: Optional[list[ECCSkill]] = None) -> None:
        self._skills = skills or ECC_BUILTIN_SKILLS
        self._instincts: dict[str, list[str]] = {}
        for s in self._skills:
            self._instincts[s.name] = s.instinct_rules

    def get_active_instincts(self, skill_names: Optional[list[str]] = None) -> list[str]:
        rules = list(self.GLOBAL_INSTINCTS)
        for name in (skill_names or self._instincts):
            rules.extend(self._instincts.get(name, []))
        return list(dict.fromkeys(rules))

    def build_prompt(self, skill_names: Optional[list[str]] = None) -> str:
        rules = self.get_active_instincts(skill_names)
        if not rules:
            return ""
        return "\n## 🔴 强制直觉规则 (Instincts)\n" + "\n".join(f"{i}. {r}" for i, r in enumerate(rules, 1))


class ECCSkillLoader:
    """ECC 技能加载器 — 从目录加载 .md 技能文件 + 部门智能体"""

    def __init__(self) -> None:
        self._loaded: dict[str, ECCSkill] = {}
        self._dept_agents: dict[str, DepartmentAgent] = {}
        self._dept_by_name: dict[str, str] = {}  # department → skill_key
        self._workspaces: dict[str, AgentWorkspace] = {}  # key → workspace

    def load_builtin(self) -> list[ECCSkill]:
        for s in ECC_BUILTIN_SKILLS:
            self._loaded[s.name] = s
        logger.info(f"已加载 {len(ECC_BUILTIN_SKILLS)} 个 ECC 内置技能")
        return list(self._loaded.values())

    def load_from_dir(self, directory: str) -> list[ECCSkill]:
        """从目录加载 .md 技能文件"""
        import re
        skills_dir = Path(directory)
        if not skills_dir.exists():
            logger.warning(f"技能目录不存在: {skills_dir}")
            return []
        loaded = []
        for md_file in skills_dir.glob("*.md"):
            try:
                content = md_file.read_text(encoding="utf-8")
                fm = re.match(r"^---\n(.*?)\n---\n", content, re.DOTALL)
                if fm:
                    try:
                        import yaml
                        meta = yaml.safe_load(fm.group(1)) or {}
                    except ImportError:
                        meta = {}
                    skill = ECCSkill(
                        name=meta.get("name", md_file.stem),
                        description=meta.get("description", ""),
                        category=meta.get("category", "general"),
                        triggers=meta.get("triggers", []),
                        instructions=content,
                        tools=meta.get("tools", []),
                        instinct_rules=meta.get("instinct_rules", []),
                        priority=meta.get("priority", 0),
                        department=meta.get("department", ""),
                        display_name=meta.get("display_name", ""),
                        model=meta.get("model", "deepseek-671B"),
                        temperature=meta.get("temperature", 0.3),
                        color=meta.get("color", ""),
                        emoji=meta.get("emoji", ""),
                    )
                    self._loaded[skill.name] = skill
                    loaded.append(skill)
            except Exception as e:
                logger.warning(f"加载技能失败 {md_file}: {e}")
        logger.info(f"从 {directory} 加载了 {len(loaded)} 个 ECC 技能")
        return loaded

    def load_hunan_agents(self) -> list[DepartmentAgent]:
        """🆕 加载湖南省19个部门智能体"""
        import os
        base_dir = Path(__file__).parent / "ecc" / "hunan-agents"

        # 尝试从 Markdown 文件加载
        if base_dir.exists():
            self.load_from_dir(str(base_dir))

        # 构建部门智能体映射
        self._dept_agents.clear()
        self._dept_by_name.clear()

        for cfg in _DEFAULT_DEPT_CONFIG:
            key = cfg["key"]
            skill = self._loaded.get(key)
            if not skill:
                # 从文件加载的 skill
                skill = ECCSkill(
                    name=key,
                    description=f"{cfg['display']} — {cfg['dept']}",
                    category=cfg.get("category", "government"),
                    triggers=[],
                    tools=[],
                    instinct_rules=[],
                    department=cfg["dept"],
                    display_name=cfg["display"],
                    color=cfg.get("color", ""),
                    emoji=cfg.get("emoji", ""),
                )

            da = DepartmentAgent(
                key=key,
                department=cfg["dept"],
                display_name=cfg["display"],
                priority=cfg["priority"],
                skill=skill,
            )
            self._dept_agents[key] = da
            self._dept_by_name[cfg["dept"]] = key

        # 🆕 加载 EcoMind 工作区文件
        workspaces_dir = base_dir / "workspaces"
        if workspaces_dir.exists():
            for ws_dir in workspaces_dir.iterdir():
                if ws_dir.is_dir() and ws_dir.name.startswith("agent-"):
                    self.load_workspace(ws_dir.name, ws_dir)

        logger.info(f"已加载 {len(self._dept_agents)} 个部门智能体 + {len(self._workspaces)} 个工作区")
        return list(self._dept_agents.values())


    def load_workspace(self, key: str, workspace_dir: Path) -> Optional[AgentWorkspace]:
        """🆕 从 EcoMind 工作区目录加载 5 文件结构"""
        if not workspace_dir.exists():
            return None
        ws = AgentWorkspace()
        for fname in ["SOUL.md", "AGENTS.md", "IDENTITY.md", "MEMORY.md", "TOOLS.md", "HEARTBEAT.md"]:
            fpath = workspace_dir / fname
            if fpath.exists():
                content = fpath.read_text(encoding="utf-8")
                setattr(ws, fname.replace(".md", "").lower(), content)
        self._workspaces[key] = ws
        logger.debug(f"已加载工作区: {key} ({workspace_dir})")
        return ws

    def get_workspace(self, key: str) -> Optional[AgentWorkspace]:
        """获取智能体的 EcoMind 工作区"""
        return self._workspaces.get(key)

    def assemble_agent_prompt(self, key: str, department: str = "") -> str:
        """
        🆕 从工作区文件组装完整的 Agent System Prompt。
        优先级: 工作区文件 > ECC skill > 默认

        Returns:
            完整的 system prompt 字符串
        """
        ws = self._workspaces.get(key)
        if ws and (ws.soul or ws.agents or ws.identity):
            return ws.assemble_system_prompt()

        # Fallback 1: ECC skill
        da = self._dept_agents.get(key)
        if da and da.skill and da.skill.instructions:
            return da.skill.instructions

        # Fallback 2: default soul
        return self.get_default_soul(department)


    def get_all(self) -> list[ECCSkill]:
        return list(self._loaded.values())

    def get_triggers(self) -> dict[str, str]:
        triggers: dict[str, str] = {}
        for s in self._loaded.values():
            for t in s.triggers:
                triggers[t] = s.name
        return triggers

    def match(self, user_input: str) -> Optional[ECCSkill]:
        for s in self._loaded.values():
            for t in s.triggers:
                if t in user_input:
                    return s
        return None

    # 🆕 部门路由方法

    def get_dept_agent(self, department: str) -> Optional[DepartmentAgent]:
        """根据部门名称获取智能体"""
        key = self._dept_by_name.get(department)
        if key:
            return self._dept_agents.get(key)
        return None

    def get_dept_agent_by_key(self, key: str) -> Optional[DepartmentAgent]:
        """根据 agent key 获取智能体"""
        return self._dept_agents.get(key)

    def get_all_dept_agents(self) -> list[DepartmentAgent]:
        """获取所有部门智能体"""
        return list(self._dept_agents.values())

    def get_prompt_for_dept(self, department: str) -> tuple[Optional[str], list[str], list[str]]:
        """
        获取部门智能体的 system prompt、tools 和 instinct_rules。

        优先级: EcoMind 工作区 > ECC skill > 默认

        Returns:
            (system_prompt, tools, instinct_rules)
        """
        # 1. Try to find the agent key for this department
        key = self._dept_by_name.get(department)
        if not key:
            for k, da in self._dept_agents.items():
                if da.department == department:
                    key = k
                    break

        tools = []
        instincts = []

        # 2. Assemble from workspace files (highest priority)
        if key and key in self._workspaces:
            ws = self._workspaces[key]
            prompt = ws.assemble_system_prompt()
            # Also get tools/instincts from skill metadata
            da = self._dept_agents.get(key)
            if da and da.skill:
                tools = da.skill.tools
                instincts = da.skill.instinct_rules
            return prompt, tools, instincts

        # 3. Fallback to ECC skill
        da = self._dept_agents.get(key) if key else None
        if da and da.skill:
            return da.skill.instructions, da.skill.tools, da.skill.instinct_rules

        # 4. Fallback: search all agents
        for k, agent in self._dept_agents.items():
            if agent.department == department and agent.skill:
                return agent.skill.instructions, agent.skill.tools, agent.skill.instinct_rules

        return None, [], []

    def get_default_soul(self, department: str) -> str:
        """生成部门智能体的默认 soul prompt"""
        system_prompt, tools, instincts = self.get_prompt_for_dept(department)
        if system_prompt:
            return system_prompt

        da = self.get_dept_agent(department)
        dept_name = da.department if da else department

        # 通用 fallback
        return f"""你是湖南省生态环境厅 **{dept_name}** 的专属 AI 智能体。
你的职责是辅助{dept_name}的工作人员高效完成日常工作，提供专业、准确、合规的建议。

回答原则：
- 使用中文，专业但不晦涩
- 涉及数据时注明来源和时间
- 涉及法规时引用具体条款
- 不确定的信息明确标注"待核实"
- 所有建议标注"AI辅助生成，需人工审核"
- 遵守国家法律法规和厅内规章制度"""


# ─── 全局单例 ────────────────────────────────────

_ecc_loader: Optional[ECCSkillLoader] = None
_ecc_instincts: Optional[ECCInstinctEngine] = None


def get_ecc_loader() -> ECCSkillLoader:
    global _ecc_loader
    if _ecc_loader is None:
        _ecc_loader = ECCSkillLoader()
        _ecc_loader.load_builtin()
        _ecc_loader.load_hunan_agents()
    return _ecc_loader


def get_ecc_instincts() -> ECCInstinctEngine:
    global _ecc_instincts
    if _ecc_instincts is None:
        _ecc_instincts = ECCInstinctEngine()
    return _ecc_instincts


def get_dept_loader() -> ECCSkillLoader:
    """获取已初始化 Hunan 部门智能体的加载器"""
    return get_ecc_loader()
