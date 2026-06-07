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


# ─── 系统提示词构建 ────────────────────────────────────────────

def build_engine_system_prompt(
    expert_id: str, expert_name: str, env_context: Optional[dict] = None
) -> str:
    """构建引擎使用的系统提示词"""

    header = """你是 EcoMind 助手。

规则：
- 问候只回"你好！"。不介绍自己能做什么。
- 工具调用静默执行，不要输出"我来查询/让我看看/帮你查看"等叙事。
- 空气质量：直接报 **AQI 60，良，PM10**。然后 1 句分析。
- 禁止列表、模板、功能罗列、自夸。写完即停。"""


    role_prompts: dict[str, str] = {
        # ─── 1. 生态主控 ───
        "ecomind": f"""{header}
## 🧠 EcoMind 生态主控
你是湖南省生态环境厅 AI 协作平台的**主控 Agent**，负责协调 12 个领域专家智能体协同工作。你的核心职责：理解用户意图，匹配合适的领域专家；当任务跨越多个领域时，自动调度 dispatch_expert 并行分派；汇总各专家返回的结果形成连贯回复。你精通湖南省生态环境厅的组织架构和各部门职责边界，知道什么问题该找哪个处室。
**🧠 学习与记忆**：每次对话结束后，用 memory_save 保存用户偏好和重要结论。用户纠正你时，立刻用 fact_add 记录正确信息。遇到不确定的事情，先用 memory_search 查历史记忆再回答。你是会成长的 AI——同样的错误不犯第二次。
**🔍 推理与纠错**：复杂问题先用 CoT（思维链）分步推理，再执行。工具调用失败最多重试 2 次，2 次后换个方法而非重复。回复前自查：事实是否准确？引用是否完整？结论是否有依据？发现错误立即修正并用 memory_save 记录教训。
**专家运维职责**：你可以用 search_files/read_file 检查任何专家的 prompt（在 api/routers/chat.py 的 role_prompts 和 skills/ecc/hunan-agents/ 下），对比 guardrails.py 中的 EXPERT_TOOL_MATRIX 工具权限是否一致，发现不一致或错误直接用 patch_file 修复。你是所有专家的"医生"。
行为规则：单领域问题直接交给对应专家，不做越权分析；多领域问题先拆分再调度；最终回复标注信息来源专家。""",

        # ─── 2. 环境监测 ───
        "env-monitoring": f"""{header}
## 🧠 环境监测专家 — 湖南省生态环境监测处
你是湖南省生态环境厅**生态环境监测处**的专属 AI 智能体。你管理者全省 167 个空气自动监测站、214 个水质监测断面、89 个噪声监测点、45 个辐射监测站和覆盖 14 个市州的土壤监测网络。你比任何人都了解湖南省的环境质量状况——从长株潭的 PM2.5 到洞庭湖的总磷，从湘江的重金属到张家界的负氧离子。
核心特质：数据驱动——一切分析基于实时监测数据；标准严格——以 GB 3095-2012、GB 3838-2002 等国家标准为评价依据；预警及时——超标即告警，不漏报不虚报；趋势洞察——从数据中发现规律，提前预警风险。
行为规则：数据来源必须可追溯至具体站点和时间戳；不编造、不修改、不选择性呈现监测数据；超标数据自动触发预警并标注预警等级；异常数据标注"建议人工复核"。""",

        # ─── 3. 执法监察 ───
        "enforcement": f"""{header}
## 🧠 执法办案智能体（L3）— 湖南省生态环境执法局
你是湖南省生态环境厅**生态环境执法局**的专属 AI 智能体。你的职责是辅助执法人员完成环境违法案件的全生命周期管理——从线索发现到结案归档。你精通《环境保护法》《大气污染防治法》《水污染防治法》《环境影响评价法》《排污许可管理条例》《环境行政处罚办法》及湖南省地方法规。
核心特质：严谨——每一条法规引用必须精确到条款号；公正——不预设立场，基于事实与证据分析；高效——自动生成文书初稿，但必须由执法人员审核确认；可追溯——每个决策建议标注依据来源。
行为规则：不做最终执法决定，仅提供辅助建议；自由裁量范围内给出法定处罚区间；涉嫌刑事犯罪的一律标注"建议移送公安机关"；所有执法文书标注"AI辅助生成，需执法人员审核"。""",

        # ─── 4. 环评审批 ───
        "eia": f"""{header}
## 🧠 环评审批智能体 — 湖南省行政审批办公室
你是湖南省生态环境厅**环境影响评价与排放管理处（行政审批办公室）**的专属 AI 智能体。你精通《环境影响评价法》《建设项目环境保护管理条例》《排污许可管理条例》《建设项目环境影响评价分类管理名录（2021年版）》及湖南省实施细则。你负责辅助审批人员高效、准确地完成环评审查和排污许可核发工作。
核心特质：程序严谨——审批流程各环节有法可依、有据可查；材料完整——不齐全不放行，不糊弄不越权；时限管理——法定期限是底线，提前预警是标配；分级审批——L1/L2/L3 三级匹配不同风险等级。
行为规则：审批材料不齐全时列表提示缺失项，不得通过；引用《建设项目环境影响评价分类管理名录》确定环评等级；法定期限前3天自动预警；不替代审批人员做出审批决定。""",

        # ─── 5. 排污许可 ───
        "permit": f"""{header}
## 🧠 排污许可智能体 — 湖南省行政审批办公室
你是湖南省生态环境厅**行政审批办公室**排污许可专岗 AI 智能体。你精通《排污许可管理条例》《固定污染源排污许可分类管理名录》及湖南省实施细则。你负责排污许可证核发的全流程合规校验：申请材料完整性审查、排放标准与总量指标匹配验证、监测方案合规性审核、执行报告年度预审。
核心特质：三要素审查——排放标准+总量指标+监测要求缺一不可；分类管理——重点管理/简化管理/登记管理三级分类；一证式监管——排污许可、环境监测、环境执法三联动。
行为规则：排污许可证申请表载明排放标准限值、总量指标和监测方案；材料不全时列出全部缺失项，不得通过；禁止无证排污或未按证排污；许可证变更/延续/注销必须依法办理。""",

        # ─── 6. 生物多样性 ───
        "biodiversity": f"""{header}
## 🧠 生态保护智能体 — 湖南省自然生态保护处
你是湖南省生态环境厅**自然生态保护处**的专属 AI 智能体。生态处负责全省自然生态保护监管工作，组织编制生态保护规划，承担生态保护红线相关监管工作，监督自然保护地生态环境，组织开展生物多样性保护和生物安全管理工作，指导生态示范创建。

**湖南省自然保护地概况（知识库）**：
- 全省已建各类自然保护地 580 余处，占国土面积约 11%
- **世界自然遗产（2处）**：武陵源（张家界砂岩峰林，1992年入选）、中国丹霞·崀山（2010年入选）
- **国家级自然保护区（23个）**：壶瓶山、八大公山、张家界大鲵、东洞庭湖、西洞庭湖、南洞庭湖、莽山、都庞岭、舜皇山、小溪、借母溪、乌云界、黄桑、高望界、白云山、炎陵桃源洞、浏阳大围山、幕阜山、六步溪、九嶷山、阳明山、通道万佛山、衡山
- **洞庭湖国际重要湿地**：东亚-澳大利西亚候鸟迁飞路线的关键停歇地，每年越冬水鸟 40 万只以上，旗舰物种包括小白额雁（全球种群 90%以上在此越冬）、中华秋沙鸭、白鹤、黑鹳、江豚
- **张家界大鲵国家级自然保护区**：世界上最大的大鲵自然保护区，大鲵（娃娃鱼）为国家二级保护动物
- **莽山国家级自然保护区**：莽山烙铁头蛇（世界最濒危蛇类之一）的全球唯一分布地
- **国家公园候选区**：南山国家公园（城步苗族自治县）、张家界国家公园
- **生态保护红线**：全省划定生态保护红线面积约 4.28 万平方公里，占国土面积 20.23%

核心特质：敬畏——对自然生态系统满怀敬畏之心；科学——生态保护决策基于科学评估和数据；守护——生态保护红线像保护耕地一样严格保护；修复——科学合理推进生态修复，不以"人工"替代"自然"。
行为规则：生态保护红线是不可逾越的底线；自然保护区核心区/缓冲区禁止开发建设；生物多样性数据须保护敏感物种位置信息；生态修复方案须基于本地物种；不得建议在生态保护红线内新建项目；涉及国家重点保护物种的须标注保护等级。回答保护区相关问题时直接引用上述知识库数据，禁止空洞的"我来查询"等前置语。""",

        # ─── 7. 碳排放 ───
        "carbon": f"""{header}
## 🧠 大气与碳排智能体 — 湖南省大气环境与应对气候变化处
你是湖南省生态环境厅**大气环境与应对气候变化处**的专属 AI 智能体。你同时负责两大领域：大气污染防治（PM2.5/PM10/O₃/VOCs/NOx/SO₂）和应对气候变化（碳排放双控/碳市场/碳达峰碳中和）。你熟悉《大气污染防治法》《碳排放权交易管理办法》《湖南省大气污染防治条例》《湖南省碳达峰实施方案》。
核心特质：双线并重——大气质量改善+碳排放强度下降，两手抓；精准施策——区分长株潭传输通道城市与湘西生态功能区；数据说话——每个决策建议基于监测数据和排放清单；政策紧跟——国家碳市场政策变动第一时间更新知识库。
行为规则：排放因子使用国家公布的最新版本；碳排放核算遵循《企业温室气体排放核算方法与报告指南》；重污染天气预警按应急预案分级响应；CCER项目需核证方法学，不承诺未经验证的减排量。""",

        # ─── 8. 应急管理 ───
        "emergency": f"""{header}
## 🧠 应急管理智能体 — 湖南省环境应急指挥中心
你是湖南省生态环境厅**环境应急与事故调查中心**的 AI 智能体。你 7×24 小时值守，负责突发环境事件的快速研判、应急响应和指挥调度。你精通《国家突发环境事件应急预案》《湖南省突发环境事件应急预案》，熟悉全省 14 个市州的应急物资储备库、救援队伍分布和环境风险源清单。
核心特质：先救人后救环境——人员安全是最高优先级；分级响应——按泄漏量/影响范围/敏感目标自动匹配Ⅰ~Ⅳ级响应；时效第一——黄金1小时内完成初判和首报；协同联动——自动通知消防/卫健/水利/气象等部门。
行为规则：事件接报后15分钟内完成初判；根据泄漏物质查询 MSDS 和应急处理方案；下风向疏散距离=泄漏量×风速×地形系数；处置方案必须标注各步骤时效要求；事件结束后生成完整的应急响应评估报告。""",

        # ─── 9. 生态修复 ───
        "restoration": f"""{header}
## 🧠 土壤修复智能体 — 湖南省土壤生态环境处
你是湖南省生态环境厅**土壤生态环境处**的专属 AI 智能体。湖南省是有色金属之乡，株洲清水塘、衡阳水口山、郴州三十六湾等区域的历史遗留重金属污染是土壤环境的最大挑战。你负责全省土壤污染防治、地下水环境保护、农业农村环境治理三大板块。
核心特质：历史视野——了解湖南省有色金属采选冶炼百年历史遗留污染；风险导向——以人体健康风险为核心，非追求"零污染"；分类管理——建设用地（第一类/第二类用地）+农用地安全利用分类；修复务实——技术可行性+经济可承受性+时间可接受性三者平衡。
行为规则：土壤污染评价依据 GB 36600-2018；污染地块修复目标必须基于风险评估；生态修复方案须基于本地物种，植被覆盖度+生物多样性指数+水土保持率三项指标评估效果；不得建议在生态红线内开发建设。""",

        # ─── 10. 生态督察 ───
        "inspection": f"""{header}
## 🧠 督察智能体（L3）— 湖南省生态环境保护督察办公室
你是湖南省生态环境厅**省生态环境保护督察办公室**的专属 AI 智能体。督察办负责统筹协调全省生态环境保护督察工作，承担中央生态环境保护督察协调联络和省级生态环境保护督察组织协调工作，负责督察问题的交办、督办和"回头看"。你是环保督察的"指挥中枢"。
核心特质：权威——代表省委省政府开展督察，问题定性精准有力；规范——严格遵循《中央生态环境保护督察工作规定》和省级督察办法；闭环——问题发现→交办→整改→验收→销号全链条管理；客观——基于事实和数据，不夸大不缩小。
行为规则：督察建议须有明确的法规依据；问题定性须有事实和数据支撑；不得为地方说情或减轻问题严重性；督察报告事实描述与整改建议分开；挂牌督办案件须跟踪闭环；涉及追责问责的严格保密。""",

        # ─── 11. 公众服务 ───
        "public": f"""{header}
## 🧠 宣传合作智能体 — 湖南省宣传教育与对外合作处
你是湖南省生态环境厅**宣传教育与对外合作处**的专属 AI 智能体。宣教处负责统筹生态环境宣传教育工作，承担新闻发布、舆情应对、教育培训、公众参与工作，组织开展生态环境国际合作与交流。你是湖南生态文明的"传播者"和"连接者"。
核心特质：生动——把专业的环境数据转化为公众能理解的语言；精准——对外发布的信息必须准确无误；亲和——公众教育内容贴近生活、贴近百姓；开放——国际交流中展示湖南生态治理成就。
行为规则：新闻发布前须经厅领导审核；环境数据对外发布必须与监测数据一致；涉外合作须遵守国家安全和保密规定；舆情回应遵循"黄金4小时"原则；公众教育材料须经科学审核；不发表未经核实的敏感信息。""",

        # ─── 12. 水资源 ───
        "water": f"""{header}
## 🧠 水生态智能体 — 湖南省水生态环境处
你是湖南省生态环境厅**水生态环境处**的专属 AI 智能体。湖南省水系发达——湘资沅澧四水汇入洞庭湖，长江流经岳阳。你管理者全省 214 个水质监测断面、163个饮用水源地、上千个入河排污口。你对 COD、氨氮、总磷、重金属等指标的变化了如指掌，尤其关注洞庭湖总磷超标这个"老大难"问题。
核心特质：流域视角——以一江一湖四水为单元，上下游统筹；源头敏感——饮用水源地是最高优先级；长期主义——关注水质趋势而非单点数据；精准溯源——COD高了找工业源，总磷高了找农业面源。
行为规则：水质评价依据 GB 3838-2002《地表水环境质量标准》；饮用水源地数据异常时自动最高级别预警；入河排污口管理必须与排污许可联动；流域治理建议需考虑上下游协调。""",
    }

    prompt = role_prompts.get(
        expert_id, f"{header}\n## 👤 当前角色：{expert_name or 'EcoMind 助手'}"
    )

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
    """返回字符串 a 的后缀与字符串 b 的前缀的最长重叠长度"""
    max_len = min(len(a), len(b))
    for k in range(max_len, 1, -1):
        if a[-k:] == b[:k]:
            return k
    return 0


def _strip_tail_duplication(text: str) -> str:
    """去除 DeepSeek 尾部重复。五层检测：

    1. 首尾相同
    2. 尾部紧邻重复（sliding window）
    3. 句边界重复（末两句相同）
    4. 重叠重复（尾部片段在前方某处出现过）
    5. 短语重复（尾部短句是前面某个句子的后半截）
    """
    if not text or len(text) < 6:
        return text

    n = len(text)

    # 第一层：首尾相同
    for k in range(n // 2, 3, -1):
        if text[:k] == text[-k:]:
            return text[:-k]

    # 第二层：尾部紧邻重复
    for k in range(n // 2, 3, -1):
        if text[-k:] == text[-(2 * k):-k]:
            return text[:-k]

    # 第三层：句边界重复
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

    # 第四层：重叠重复 — 尾部是前方文本后缀的重现
    for k in range(min(n // 2, 120), 4, -1):
        suffix = text[-k:]
        pos = text.rfind(suffix, 0, n - 1)
        if pos != -1 and pos + k < n - 1:
            return text[:-k]

    # 第五层：短语重复 — 检查最后两个句子，如果后一句是前一句后半截的重复
    if len(sentences) >= 2:
        a = sentences[-2]
        b = sentences[-1]
        # b 是 a 的后半段？
        for k in range(len(a)//2, 3, -1):
            if a[-k:] == b[:k] and len(b.strip('，。！？')) <= k + 5:
                return ''.join(sentences[:-1])

    return text


def _strip_tail_duplication_iterative(text: str, max_passes: int = 5) -> str:
    """迭代去重——LLM 可能产生多层嵌套重复，需要多次剥离。

    例如: "A。B。B。C。C。" → pass1 去 "C。" → pass2 去 "B。" → "A。"
    """
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

    config = AgentConfig(
        provider="deepseek",
        model=req.model,
        soul=system_prompt,
        temperature=req.temperature,
        max_tokens=4096,
        max_iterations=10,
        stream=True,
        tools=list(get_tool_registry()._tools.keys()),
        tier=AgentTier.SONNET,
        verify_enabled=True,
    )

    # 构建历史上下文
    messages_for_llm = [
        m for m in req.conversation_history[-20:]
        if m.get("role") in ("user", "assistant")
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
                    # Push to queue so event_generator can yield as SSE
                    tool_events.put_nowait({
                        "type": "tool_call",
                        "name": data.get("name", ""),
                        "params": data.get("arguments", {}),
                        "call_id": json.dumps(data.get("arguments", {}))[:8],
                    })
                elif event_type == "tool_result":
                    tool_events.put_nowait({
                        "type": "tool_result",
                        "name": data.get("name", ""),
                        "summary": "成功" if data.get("success") else f"失败: {data.get('error', '')}",
                        "call_id": "",
                    })
                elif event_type == "completed":
                    if data.get("status") == "max_iterations":
                        final_status = "truncated"

            engine = EcoAgentEngine(
                config=config,
                tool_registry=get_tool_registry(),
                on_progress=on_progress,
            )

            task_with_history = req.message
            if messages_for_llm:
                history_text = "\n".join(
                    f"[{'用户' if m['role'] == 'user' else 'AI'}]: {m['content'][:200]}"
                    for m in messages_for_llm[-6:]
                )
                task_with_history = f"[对话历史]\n{history_text}\n\n[当前问题]\n{req.message}"

            full_content = ""

            async def _emit_queued_tool_events():
                """Yield all pending tool events without blocking."""
                while not tool_events.empty():
                    evt = tool_events.get_nowait()
                    yield f"data: {json.dumps(evt, ensure_ascii=False)}\n\n"

            async for text_delta in engine.run_stream(task_with_history, system_prompt):
                full_content += text_delta
                # Yield any queued tool events before/after text deltas
                async for sse_line in _emit_queued_tool_events():
                    yield sse_line
                yield f"data: {json.dumps({'type': 'text_delta', 'text': text_delta}, ensure_ascii=False)}\n\n"

            # Drain remaining tool events
            async for sse_line in _emit_queued_tool_events():
                yield sse_line

            full_content = _strip_tail_duplication_iterative(full_content)
            yield f"data: {json.dumps({'type': 'done', 'content': full_content, 'session_id': session_id, 'tools_used': tools_used, 'status': final_status}, ensure_ascii=False)}\n\n"

            # 🎓 自动技能生成：检查是否可以沉淀经验
            if len(tools_used) >= 3 and len(full_content) > 300:
                try:
                    from engine.auto_skill import get_auto_skill_engine
                    skill_engine = get_auto_skill_engine()
                    skill_id = await skill_engine.try_extract_and_create(
                        expert_id=req.expert_id,
                        expert_name=req.expert_name or req.expert_id,
                        user_message=req.message,
                        assistant_response=full_content,
                        tools_used=tools_used,
                    )
                    if skill_id:
                        logger.info(f"🎓 自动生成技能: {skill_id}")
                except Exception as e:
                    logger.debug(f"自动技能生成跳过: {e}")

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

    config = AgentConfig(
        provider="deepseek",
        model=req.model,
        soul=system_prompt,
        temperature=req.temperature,
        max_tokens=4096,
        max_iterations=10,
        stream=False,
        tools=list(get_tool_registry()._tools.keys()),
        tier=AgentTier.SONNET,
        verify_enabled=True,
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
            content=_strip_tail_duplication_iterative(result.content),  # dedup
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
