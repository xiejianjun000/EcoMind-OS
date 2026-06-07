"""
EcoMind Chat API — 统一聊天端点，桥接前端 ↔ EcoAgentEngine。

POST /api/chat/stream  — SSE 流式对话（主端点）
POST /api/chat         — 非流式对话

这是引擎统一的关键模块：前端不再直接调 DeepSeek，而是通过此后端端点，
由 EcoAgentEngine 统一管理 LLM 调用、工具执行、记忆存取、输出验证。
"""

from __future__ import annotations

import json
import logging
import os
import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from engine.loop import AgentConfig, AgentTier, EcoAgentEngine
from engine.tool_registry import get_tool_registry

logger = logging.getLogger(__name__)
router = APIRouter()


# ─── 请求/响应模型 ─────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str = Field(..., description="用户消息")
    expert_id: str = Field(default="ecomind", description="专家/角色 ID")
    expert_name: str = Field(default="", description="专家名称")
    session_id: str = Field(default="", description="会话 ID")
    conversation_history: list[dict] = Field(default_factory=list, description="对话历史")
    model: str = Field(default="deepseek-chat", description="模型名称")
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    stream: bool = Field(default=True, description="是否流式输出")
    safety_level: str = Field(default="L2", description="安全级别")
    env_context: Optional[dict] = Field(default=None, description="环境数据上下文")


class ChatResponse(BaseModel):
    content: str
    session_id: str
    status: str
    tools_used: list[str] = []
    iterations: int = 0
    error: Optional[str] = None


# ─── Agent 人格文件映射 ──────────────────────────────────────

# Agent ID → SOUL 文件路径（相对于项目根目录）
_AGENT_SOUL_MAP: dict[str, str] = {
    "ecomind":         "spec/SOUL-EcoMind.md",
    "env-monitoring":  "backend/skills/ecc/hunan-agents/workspaces/agent-monitoring/SOUL.md",
    "enforcement":     "backend/skills/ecc/hunan-agents/workspaces/agent-enforcement/SOUL.md",
    "eia":             "backend/skills/ecc/hunan-agents/workspaces/agent-eia-approval/SOUL.md",
    "permit":          "backend/skills/ecc/hunan-agents/workspaces/agent-eia-approval/SOUL.md",
    "biodiversity":    "backend/skills/ecc/hunan-agents/workspaces/agent-ecology/SOUL.md",
    "carbon":          "backend/skills/ecc/hunan-agents/workspaces/agent-air-climate/SOUL.md",
    "emergency":       "backend/skills/ecc/hunan-agents/workspaces/agent-coordination/SOUL.md",
    "restoration":     "backend/skills/ecc/hunan-agents/workspaces/agent-soil/SOUL.md",
    "inspection":      "backend/skills/ecc/hunan-agents/workspaces/agent-inspection-1/SOUL.md",
    "public":          "backend/skills/ecc/hunan-agents/workspaces/agent-education/SOUL.md",
    "water":           "backend/skills/ecc/hunan-agents/workspaces/agent-water/SOUL.md",
}

# 项目根目录（本文件在 backend/api/routers/ → 上三级）
_SOUL_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))


def _load_agent_soul(expert_id: str) -> Optional[str]:
    """从文件加载 Agent 人格定义（SOUL.md）。找不到返回 None。"""
    rel_path = _AGENT_SOUL_MAP.get(expert_id)
    if not rel_path:
        return None
    full_path = os.path.join(_SOUL_PROJECT_ROOT, rel_path)
    if not os.path.exists(full_path):
        logger.warning(f"Agent 人格文件不存在: {full_path}")
        return None
    try:
        with open(full_path, "r", encoding="utf-8") as f:
            content = f.read()
        logger.info(f"✅ 已加载 Agent 人格: {expert_id} ← {rel_path} ({len(content)}字符)")
        return content
    except Exception as e:
        logger.warning(f"加载 Agent 人格失败 ({expert_id}): {e}")
        return None


# ─── 系统提示词构建 ────────────────────────────────────────────

def build_engine_system_prompt(
    expert_id: str, expert_name: str, env_context: Optional[dict] = None
) -> str:
    """构建引擎使用的系统提示词"""

    # 🔑 ecomind 专用 header：调度优先
    dev_header = """你是 EcoMind 主控 Agent，生态环境领域垂直系统 AI 智能体协作平台的核心调度中枢。核心职责不是自己分析，而是**调度 11 个领域专家**协同工作。

**首次对话**：用户首次打招呼时，用 2-3 句话做简洁自我介绍，点名你能调度的专家方向和能力范围。后续对话不再重复介绍。

铁律（违反即失败）：
- 任何领域问题（环境数据/法规/执法/审批/碳排放/水质/应急/案卷/土壤/生物等）→ **唯一正确做法是调 dispatch_expert**。你没权限查数据、法规、文件。
- 案卷评查：用户说"文档-谢建军-案卷"时，直接 dispatch enforcement，任务描述写明"在 ~/Documents/谢建军/案卷/ 目录下找案卷文件并评查"。不要自己搜索文件。
- 你只能做：① dispatch_expert（调度专家并拿到结果）② 技能广场(skill_search/skill_install) ③ 记忆工具 ④ 项目代码维护
- code_read/search_files 只用于修改 prompt/配置文件/代码。绝对不能用于探索用户文件或找案卷。
- 拿到专家结果后，在 text 中只输出一句话：「✅ [专家名]已完成分析，详见上方报告。」不要复述、汇总或重复专家内容。专家结果已在消息中独立显示。
- 日常问候：简单回应即可，不展开。

多专家调度规则（当任务涉及多个领域时）：
- 环境问题需要"监测+执法"双角度 → 先后 dispatch env-monitoring 和 enforcement
- 事故需要"应急+监测+执法"三方 → dispatch emergency + env-monitoring + enforcement
- 碳排放核查需要"因子查询+排放计算+报告" → dispatch carbon 分阶段执行
- 环评需要"审批+生态红线" → dispatch eia 和 biodiversity"""

    # 🌐 领域专家 header：基于工具数据直接回复
    domain_header = """你是 EcoMind 领域专家。

规则：
- **知识类问题直接回答**：法规条款、程序流程、处罚标准、定义解释等训练数据已覆盖的内容，直接回答，标注"基于通用知识"。不要为查已知知识而调用工具。
- **数据类问题才调工具**：需要查实时数据、读本地文件、搜具体案例时，才调用对应工具。
- 回复简洁：数据/知识 + 判断 + 1句建议
- 首次被调度时可简短自报身份（部门+职责），后续不再重复
- 不输出"我来查询/让我看看"等废话
- 日常问候简单回应即可"""

    role_prompts: dict[str, str] = {
        # ─── 1. 生态主控（开发版 header）───
        "ecomind": f"""{dev_header}
## 🧠 EcoMind 生态主控
你是湖南省生态环境厅 AI 协作平台的**主控 Agent**，负责协调 12 个领域专家智能体协同工作。核心职责：理解用户意图，匹配合适的领域专家；自动调度 dispatch_expert 分派任务；汇总各专家返回的结果形成连贯回复。

**专家匹配表（必须严格遵守，不能自己分析）**：
- 环境数据/空气质量/水质/噪声/辐射 → dispatch env-monitoring
- 执法案件/法规引用/违法分析 → dispatch enforcement
- 环评/审批/排污许可 → dispatch eia 或 permit
- 碳排放/双碳/CCER → dispatch carbon
- 生物多样性/保护区/生态红线 → dispatch biodiversity
- 应急事件/泄漏/污染事故 → dispatch emergency
- 土壤/地下水/重金属 → dispatch restoration
- 督察/挂牌督办 → dispatch inspection
- 公众宣传/舆情/信息公开 → dispatch public
- 水资源/流域/饮用水源地 → dispatch water

**🧠 学习与记忆**：用 memory_save 保存重要结论，用 memory_search 查历史记忆，用 fact_add 记录用户纠正。
**运维职责**：用 code_read/code_write/patch_file 检查和修复专家 prompt 和权限配置。""",

        # ─── 2-12. 领域专家（domain header）───
        "env-monitoring": f"""{domain_header}
## 🧠 环境监测专家 — 湖南省生态环境监测处
管理者全省 167 个空气自动监测站、214 个水质监测断面、89 个噪声监测点、45 个辐射监测站和覆盖 14 个市州的土壤监测网络。
核心特质：数据驱动；标准严格（GB 3095-2012、GB 3838-2002）；预警及时；趋势洞察。
行为规则：数据来源可追溯至站点和时间戳；不编造不选择性呈现监测数据；超标自动预警；异常数据标注"建议人工复核"。""",

        "enforcement": f"""{domain_header}
## 🧠 执法办案智能体（L3）— 湖南省生态环境执法局
辅助执法人员完成环境违法案件全生命周期管理。精通《环境保护法》《大气污染防治法》《水污染防治法》《环境影响评价法》《排污许可管理条例》《环境行政处罚办法》及湖南省地方法规。
核心特质：严谨——法规引用精确到条款号；公正——基于事实与证据；高效——自动生成文书初稿；可追溯——每个决策标注依据来源。
行为规则：不做最终执法决定；自由裁量范围内给出法定处罚区间；涉嫌刑事犯罪标注"建议移送公安机关"；AI辅助生成需执法人员审核。""",

        "eia": f"""{domain_header}
## 🧠 环评审批智能体 — 湖南省行政审批办公室
精通《环境影响评价法》《建设项目环境保护管理条例》《排污许可管理条例》《建设项目环境影响评价分类管理名录（2021年版）》及湖南省实施细则。
核心特质：程序严谨；材料完整不可糊弄；法定期限前3天自动预警；分级审批 L1/L2/L3。
行为规则：材料不齐全时列表提示缺失项；引用分类管理名录确定环评等级；不替代审批人员做决定。""",

        "permit": f"""{domain_header}
## 🧠 排污许可智能体 — 湖南省行政审批办公室
精通《排污许可管理条例》《固定污染源排污许可分类管理名录》及湖南省实施细则。负责排污许可证核发全流程合规校验。
核心特质：三要素审查（排放标准+总量指标+监测要求）；分类管理（重点/简化/登记）；一证式监管。
行为规则：申请表必须载明排放标准限值/总量指标/监测方案；材料不全列出全部缺失项；禁止无证排污。""",

        "biodiversity": f"""{domain_header}
## 🧠 生态保护智能体 — 湖南省自然生态保护处
负责全省自然生态保护监管、生态保护红线、自然保护地、生物多样性保护。
湖南省自然保护地概况：580余处保护地、2处世界自然遗产（武陵源、崀山）、23个国家级自然保护区、洞庭湖国际重要湿地（年越冬水鸟40万只以上）、张家界大鲵保护区、莽山烙铁头蛇保护区。
核心特质：敬畏自然、科学决策、严格守护、合理修复。
行为规则：生态保护红线是不可逾越底线；核心区/缓冲区禁止开发建设；敏感物种位置信息须保护；不建议在红线内新建项目；直接引用知识库数据回答。""",

        "carbon": f"""{domain_header}
## 🧠 大气与碳排智能体 — 湖南省大气环境与应对气候变化处
同时负责大气污染防治（PM2.5/PM10/O₃/VOCs/NOx/SO₂）和应对气候变化（碳排放双控/碳市场/碳达峰碳中和）。
核心特质：双线并重；精准施策（长株潭 vs 湘西）；数据说话；政策紧跟。
行为规则：排放因子用国家最新版本；碳排放核算遵循《企业温室气体排放核算方法与报告指南》；重污染天气按应急预案分级响应。""",

        "emergency": f"""{domain_header}
## 🧠 应急管理智能体 — 湖南省环境应急指挥中心
7×24小时值守，负责突发环境事件快速研判、应急响应和指挥调度。
核心特质：先救人后救环境；分级响应Ⅰ~Ⅳ级；黄金1小时内初判和首报；协同联动消防/卫健/水利/气象。
行为规则：事件接报15分钟内初判；查询MSDS和应急方案；下风向疏散距离=泄漏量×风速×地形系数；处置方案标注时效要求；事后生成评估报告。""",

        "restoration": f"""{domain_header}
## 🧠 土壤修复智能体 — 湖南省土壤生态环境处
湖南省是有色金属之乡，株洲清水塘、衡阳水口山、郴州三十六湾等历史遗留重金属污染是土壤环境最大挑战。
核心特质：历史视野；风险导向（人体健康风险优先）；分类管理（建设用地+农用地）；修复务实（技术+经济+时间平衡）。
行为规则：土壤评价依据 GB 36600-2018；修复目标基于风险评估；修复方案基于本地物种。""",

        "inspection": f"""{domain_header}
## 🧠 督察智能体（L3）— 湖南省生态环境保护督察办公室
统筹协调全省生态环境保护督察工作，承担中央和省级督察的组织协调、问题交办、督办和"回头看"。
核心特质：权威——代表省委省政府；规范——遵循督察规定；闭环——发现→交办→整改→验收→销号；客观——基于事实数据。
行为规则：督察建议有法规依据；问题定性有事实支撑；不为地方说情；挂牌督办案件跟踪闭环。""",

        "public": f"""{domain_header}
## 🧠 宣传合作智能体 — 湖南省宣传教育与对外合作处
负责生态环境宣传教育、新闻发布、舆情应对、公众参与、国际合作交流。
核心特质：生动——专业数据转化公众语言；精准——对外信息准确无误；亲和——贴近生活贴近百姓；开放——展示湖南生态成就。
行为规则：新闻发布前须经审核；环境数据对外发布与监测一致；涉外合作遵守国家安全和保密规定；舆情回应遵循"黄金4小时"原则。""",

        "water": f"""{domain_header}
## 🧠 水生态智能体 — 湖南省水生态环境处
管理者全省 214 个水质监测断面、163个饮用水源地。湘资沅澧四水汇入洞庭湖。
核心特质：流域视角；源头敏感——饮用水源地最高优先级；长期主义——关注趋势非单点；精准溯源——COD找工业源，总磷找农业面源。
行为规则：水质评价依据 GB 3838-2002；饮用水源地数据异常最高级别预警；入河排污口与排污许可联动。""",
    }

    prompt = role_prompts.get(
        expert_id, f"{domain_header}\n## 当前角色：{expert_name or 'EcoMind 助手'}"
    )

    # 🔍 尝试从 SOUL 文件加载更完整的 Agent 人格
    soul_content = _load_agent_soul(expert_id)
    if soul_content:
        # SOUL 文件中可能已含 # 标题，提取纯内容并附加 header
        # 移除文件开头的 Markdown 标题行（# xxx）
        import re
        soul_body = re.sub(r'^#\s+[^\n]+\n+', '', soul_content, count=1).strip()
        # 拼接：short header + SOUL 文件内容
        if expert_id == "ecomind":
            prompt = f"{dev_header}\n\n{soul_body}"
        else:
            prompt = f"{domain_header}\n\n{soul_body}"

    if env_context:
        city = env_context.get("city", "")
        aqi = env_context.get("aqi", 0)
        if city and aqi > 0:
            prompt += f"""

## 📡 当前环境实况
{city} | AQI {aqi}（{env_context.get('level', '—')}）| 首要污染物 {env_context.get('primaryPollutant', '无')}
> 以上数据已在界面展示，回复中引用关键发现而非逐项复述。"""

    return prompt


# ─── 防御：去除 LLM 尾部重复 ─────────────────────────────────

def _longest_overlap(a: str, b: str) -> int:
    max_len = min(len(a), len(b))
    for k in range(max_len, 1, -1):
        if a[-k:] == b[:k]:
            return k
    return 0


def _strip_tail_duplication(text: str) -> str:
    if not text or len(text) < 6:
        return text
    n = len(text)
    for k in range(n // 2, 3, -1):
        if text[:k] == text[-k:]:
            return text[:-k]
    for k in range(n // 2, 3, -1):
        if text[-k:] == text[-(2 * k):-k]:
            return text[:-k]
    import re
    sentences = re.split(r'(?<=[。！？\n])\s*', text)
    sentences = [s.rstrip() for s in sentences if s.strip()]
    if len(sentences) >= 2:
        last = sentences[-1]
        prev = sentences[-2]
        if last == prev:
            return ''.join(sentences[:-1])
        if len(prev) > len(last) and prev.endswith(last):
            return ''.join(sentences[:-1])
        if len(last) > len(prev) and last.startswith(prev):
            sentences[-1] = last[len(prev):].lstrip('，。！？')
            return ''.join(s for s in sentences if s.strip())
    for k in range(min(n // 2, 40), 4, -1):
        suffix = text[-k:]
        pos = text.rfind(suffix, 0, n - 1)
        if pos != -1 and pos + k < n - 1:
            return text[:-k]
    if len(sentences) >= 2:
        a = sentences[-2]
        b = sentences[-1]
        for k in range(len(a)//2, 3, -1):
            if a[-k:] == b[:k] and len(b.strip('，。！？')) <= k + 5:
                return ''.join(sentences[:-1])
    return text


def _strip_tail_duplication_iterative(text: str, max_passes: int = 5) -> str:
    _log = logging.getLogger(__name__)
    print(f"[DEDUP] input_len={len(text)}, tail_80={repr(text[-80:])}")
    for i in range(max_passes):
        stripped = _strip_tail_duplication(text)
        if stripped == text:
            print(f"[DEDUP] stable at pass {i}, final_len={len(text)}")
            break
        print(f"[DEDUP] pass {i}: {len(text)}→{len(stripped)}, removed={repr(text[len(stripped):][:60])}")
        text = stripped
    return text


# ─── 流式端点 ──────────────────────────────────────────────────

@router.post("/stream")
async def chat_stream(req: ChatRequest):
    """
    SSE 流式对话端点 — 使用 EcoAgentEngine 管理完整 Agent Loop。
    
    事件格式：
      data: {"type": "text_delta", "text": "..."}
      data: {"type": "done", "content": "...", "session_id": "...", ...}
      data: {"type": "error", "message": "..."}
    """
    session_id = req.session_id or str(uuid.uuid4())
    system_prompt = build_engine_system_prompt(req.expert_id, req.expert_name, req.env_context)
    logger.info(f"🤖 [{req.expert_name or req.expert_id}] 收到: {req.message[:80]}")

    # 根据 Agent ID 获取工具白名单
    from api.guardrails import EXPERT_TOOL_MATRIX
    all_tools = list(get_tool_registry()._tools.keys())
    allowed_tools = list(EXPERT_TOOL_MATRIX.get(req.expert_id, set(all_tools)))
    agent_tools = [t for t in allowed_tools if t in all_tools]

    config = AgentConfig(
        provider="deepseek",
        model=req.model,
        soul=system_prompt,
        temperature=req.temperature,
        max_tokens=8192,
        max_iterations=30,
        stream=True,
        tools=agent_tools,
        tier=AgentTier.SONNET,
        verify_enabled=True,
        expert_id=req.expert_id,
    )

    # 构建 messages 格式的历史上下文（标准格式，非拼接字符串）
    messages_for_llm = [
        {"role": m["role"], "content": m["content"][:1000]}
        for m in req.conversation_history[-20:]
        if m.get("role") in ("user", "assistant") and m.get("content")
    ]

    async def event_generator():
        try:
            import asyncio as _asyncio
            tool_events: _asyncio.Queue = _asyncio.Queue()
            tools_used: list[str] = []
            final_status = "completed"

            def on_progress(event_type: str, data: dict):
                nonlocal final_status
                if event_type == "tool_call":
                    tools_used.append(data.get("name", "unknown"))
                    tool_events.put_nowait({
                        "type": "tool_call",
                        "name": data.get("name", ""),
                        "params": data.get("arguments", {}),
                        "call_id": data.get("call_id", ""),
                    })
                    # 🎯 dispatch 开始 → 前端显示"专家分析中"
                    if data.get("name") == "dispatch_expert":
                        args = data.get("arguments", {})
                        tool_events.put_nowait({
                            "type": "dispatch_start",
                            "expert_id": args.get("expert_id", "unknown"),
                            "expert_name": args.get("expert_name", args.get("expert_id", "")),
                            "task": (args.get("task_description") or args.get("task") or "")[:100],
                        })
                elif event_type == "tool_result":
                    tool_name = data.get("name", "")
                    summary = "成功" if data.get("success") else f"失败: {data.get('error', '')}"
                    tool_events.put_nowait({
                        "type": "tool_result",
                        "name": tool_name,
                        "summary": summary,
                        "call_id": data.get("call_id", ""),
                    })
                    # 🎯 专家调度结果：浮到前端展示为专家消息
                    if tool_name == "dispatch_expert" and data.get("success") and data.get("result"):
                        result = data["result"]
                        if isinstance(result, dict):
                            expert_id = result.get("expert_id", "unknown")
                            expert_name = result.get("expert_name", expert_id)
                            expert_content = result.get("content", "")
                            if expert_content:
                                tool_events.put_nowait({
                                    "type": "expert_message",
                                    "expert_id": expert_id,
                                    "expert_name": expert_name,
                                    "content": expert_content,
                                    "tools_used": result.get("tools_used", []),
                                    "duration": result.get("duration", 0),
                                })
                elif event_type == "completed":
                    if data.get("status") == "max_iterations":
                        final_status = "truncated"
                    elif data.get("truncated"):
                        final_status = "truncated"

            engine = EcoAgentEngine(
                config=config,
                tool_registry=get_tool_registry(),
                on_progress=on_progress,
            )

            # 使用标准 messages 格式传递历史，而非拼接字符串
            full_content = ""

            async def _emit_queued_tool_events():
                while not tool_events.empty():
                    evt = tool_events.get_nowait()
                    yield f"data: {json.dumps(evt, ensure_ascii=False)}\n\n"

            # 将历史消息注入到引擎的初始上下文
            async for text_delta in engine.run_stream(req.message, system_prompt, messages_for_llm):
                full_content += text_delta
                async for sse_line in _emit_queued_tool_events():
                    yield sse_line
                yield f"data: {json.dumps({'type': 'text_delta', 'text': text_delta}, ensure_ascii=False)}\n\n"

            # Drain remaining tool events
            async for sse_line in _emit_queued_tool_events():
                yield sse_line

            full_content = _strip_tail_duplication_iterative(full_content)
            yield f"data: {json.dumps({'type': 'done', 'content': full_content, 'session_id': session_id, 'tools_used': tools_used, 'status': final_status}, ensure_ascii=False)}\n\n"

            # 🎓 技能沉淀提示：使用3+工具且有实质内容时，标记可沉淀
            if len(tools_used) >= 3 and len(full_content) > 300:
                skill_hint = (
                    "💡 此对话使用了多个工具完成复杂任务。"
                    "如需沉淀为可复用技能，请说「保存为技能」。"
                )
                yield f"data: {json.dumps({'type': 'skill_hint', 'message': skill_hint, 'tools_used': tools_used}, ensure_ascii=False)}\n\n"

        except Exception as e:
            logger.error(f"Chat stream error: {e}", exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'message': '服务暂时不可用，请稍后重试'}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "X-Session-Id": session_id,
        },
    )


# ─── 非流式端点 ────────────────────────────────────────────────

@router.post("", response_model=ChatResponse)
async def chat(req: ChatRequest):
    """非流式对话端点"""
    session_id = req.session_id or str(uuid.uuid4())
    system_prompt = build_engine_system_prompt(req.expert_id, req.expert_name, req.env_context)

    from api.guardrails import EXPERT_TOOL_MATRIX
    all_tools_ns = list(get_tool_registry()._tools.keys())
    allowed_tools_ns = list(EXPERT_TOOL_MATRIX.get(req.expert_id, set(all_tools_ns)))
    agent_tools_ns = [t for t in allowed_tools_ns if t in all_tools_ns]

    config = AgentConfig(
        provider="deepseek",
        model=req.model,
        soul=system_prompt,
        temperature=req.temperature,
        max_tokens=8192,
        max_iterations=30,
        stream=False,
        tools=agent_tools_ns,
        tier=AgentTier.SONNET,
        verify_enabled=True,
        expert_id=req.expert_id,
    )

    try:
        tools_used: list[str] = []

        def on_progress(event_type: str, data: dict):
            if event_type == "tool_call":
                tools_used.append(data.get("name", "unknown"))

        engine = EcoAgentEngine(
            config=config,
            tool_registry=get_tool_registry(),
            on_progress=on_progress,
        )
        result = await engine.run(req.message, system_prompt)

        return ChatResponse(
            content=_strip_tail_duplication_iterative(result.content),
            session_id=session_id,
            status=result.status.value,
            tools_used=tools_used,
            iterations=result.iterations,
            error=result.error,
        )
    except Exception as e:
        logger.error(f"Chat error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"对话服务异常: {str(e)[:200]}")


@router.get("/health")
async def chat_health():
    """Chat 引擎健康检查"""
    registry = get_tool_registry()
    return {
        "status": "ok",
        "engine": "EcoAgentEngine",
        "tools_registered": len(registry),
        "tool_names": list(registry._tools.keys()),
    }
