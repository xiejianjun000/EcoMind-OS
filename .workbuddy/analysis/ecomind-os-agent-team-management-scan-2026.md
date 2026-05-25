# EcoMind OS — Agent 团队管理框架深度调研报告

**日期**: 2026-05-25
**性质**: 专项调研 · 技术选型参考
**范围**: 2025-2026年主流多智能体编排框架全景对比 + EcoMind OS 应用方案

---

## 一、调研背景

EcoMind OS 当前的 Agent 编排依赖：
- **TAIJI-AGENT 2.0**（Fork）：Agent Loop + EventBus + Plugin 体系
- **OpenClaw**：Gateway 网关 + 多 Agent 路由 + ACP 协议
- **Temporal.io**：DAG 工作流引擎

**核心差距**：缺少专门的 **多智能体团队协作管理层**——即一个能够让多个 Agent 作为一个"团队"协同完成复杂任务的编排引擎。TAIJI-AGENT 的 EventBus 是事件驱动通信，但不是团队级任务分配与协作调度。

本报告调研当前（2026年5月）最好的 Agent 团队管理框架，并给出 EcoMind OS 的应用建议。

---

## 二、四大编排模式（2026行业标准）

任何 Agent 团队管理框架的核心都是实现以下一种或多种编排模式：

```
┌─────────────────────────────────────────────────────────────────┐
│                 四大 Agent 编排模式                               │
├────────────────┬────────────────┬───────────────┬───────────────┤
│  Supervisor    │   Router       │   Pipeline    │    Swarm      │
│  主管/委派      │   路由/分类     │   流水线       │   群体/自组织   │
│                │                │               │               │
│  ┌───┐         │  ┌───┐         │  A → B → C    │  A B C D     │
│  │ S │→A,B,C   │  │ R │→A/B/C  │               │  ↕ ↕ ↕ ↕    │
│  │   │←A,B,C   │  └───┘         │  顺序链式      │  任意对等通信   │
│  └───┘         │  轻量分类      │               │               │
│  中心化控制     │  低延迟       │  可预测       │  最高吞吐      │
│  可审计        │  高容错       │  好调试       │  难预测        │
└────────────────┴────────────────┴───────────────┴───────────────┘
```

### 2.1 Supervisor（主管模式）
- **架构**：中央编排 Agent 接收任务 → 分解为子任务 → 委派给专业 Worker Agent → 收集结果 → 综合输出
- **适用场景**：合规文档生成、多源研究报告、结构化工作流
- **优缺点**：✅ 集中控制、好审计 | ❌ 单点瓶颈、延迟叠加

### 2.2 Router（路由模式）
- **架构**：轻量分类器（规则/小模型）将请求路由到对应专家 Agent，专家独立处理
- **适用场景**：客服系统、混合工作负载 API、低延迟场景
- **优缺点**：✅ 最低延迟、高容错 | ❌ 无法处理需多专家协作的任务

### 2.3 Pipeline（流水线模式）
- **架构**：Agent 按预定顺序链式执行，前一个的输出是后一个的输入
- **适用场景**：内容管道（研究→起草→编辑→发布）、CI/CD、ETL
- **优缺点**：✅ 高可预测、好调试 | ❌ 无法并行、单点阻塞

### 2.4 Swarm（群体模式）
- **架构**：完全去中心化，Agent 并行运行、对等通信、通过共享状态协调
- **适用场景**：大规模编码、研究探索、漏洞扫描
- **优缺点**：✅ 最高吞吐、高容错 | ❌ 难预测、难调试、成本不可控

### 2.5 混合模式（生产推荐）
2026年最佳实践是**混合模式**：
> Router → Supervisor → Pipeline（结构化）/ Swarm（可并行部分）

---

## 三、八大主流框架深度对比

### 3.1 总览矩阵

| 框架 | Star | 协议 | 语言 | 架构 | 编排模式 | MCP | A2A | 企业就绪 |
|------|------|------|------|------|---------|-----|-----|---------|
| **LangGraph** | — (47M/月下载) | MIT | Python/TS | 有向状态图 | 全4种 | ✅ 适配器 | 实验 | ★★★★★ |
| **CrewAI** | 45.9K | Apache-2.0 | Python | 角色驱动 | Supervisor+Pipeline+路由 | ✅ 社区 | ✅ | ★★★★ |
| **MS Agent Framework 1.0** | 50K+ (合并) | MIT | Python/.NET | 有向图+Agent | 全4种 | ✅ 内建 | ✅ 内建 | ★★★★★ |
| **AG2 (AutoGen fork)** | 4.6K | Apache-2.0 | Python | 事件驱动对话 | Supervisor+Swarm+辩论 | ✅ v0.12+ | ❌ | ★★★ |
| **OpenAI Agents SDK** | — | MIT | Python/TS | Handoff链 | Pipeline+路由 | ✅ v0.7+ | ❌ | ★★★★ |
| **Strands Agents** | — | Apache-2.0 | Python | 模型驱动极简 | 全4种 | ✅ 一等 | ❌ | ★★★ |
| **Claude Agent SDK** | — | 专有 | Python/TS | Agent-as-Runtime | Pipeline（单Agent深度） | ✅ 原生 | ❌ | ★★★★ |
| **AgentMesh** | 新兴 | 开放协议 | Go/Python | P2P Mesh | Swarm+路由 | ❌ | ❌ | ★★ |
| **MetaGPT / MGX** | ~46K | MIT | Python | 角色团队 | Supervisor+Pipeline | ❌ | ❌ | ★★★ |

---

### 3.2 逐一详解

#### ① LangGraph — 状态图引擎（最成熟）

| 维度 | 详情 |
|------|------|
| **GitHub** | langchain-ai/langgraph |
| **定位** | 有向状态图引擎，每个节点是独立 Agent，边定义路由和条件 |
| **架构** | 有向图 + Reducer状态管理 + Checkpoint持久化 + interrupt()人工介入 |
| **多Agent模式** | 图中每个节点可嵌套子图 → 无限组合：Supervisor/Router/Pipeline/Swarm |
| **Benchmark** | 多步任务准确率 **94%**（最高），延迟中等，$0.08/task |
| **调试** | LangGraph Studio（可视化图步进、状态检查、回放）— LangSmith 付费 |
| **企业级** | LangGraph Cloud（托管部署）+ 47M+月下载 + Klarna/Uber/LinkedIn 生产验证 |
| **协议** | MIT ✅ |
| **优势** | 最大控制力、生产验证最充分、模型无关（LangChain生态） |
| **劣势** | 学习曲线陡峭、简单场景过度工程、LangSmith调试付费 |

**EcoMind OS 契合度**: ★★★★★ — 最推荐
- 有向图模型与 Temporal DAG 思路一致，可无缝融合
- Checkpoint + interrupt() 完美匹配"人在环路"需求
- 模型无关 → 兼容 LiteLLM 统一接口

---

#### ② CrewAI — 角色团队编排（最快上手）

| 维度 | 详情 |
|------|------|
| **GitHub** | ekrtf/crewai (45.9K★) |
| **定位** | "给 Agent 分配角色，组成团队完成任务" — 最直觉的多Agent框架 |
| **架构** | Agent（角色/目标/背景故事）+ Task（预期输出）+ Crew（团队）+ Process（流程） |
| **多Agent模式** | Sequential（顺序）、Hierarchical（ManagerAgent分配）、Contextual（任务关联） |
| **Benchmark** | 多步任务准确率 87%，延迟低（简单编排快30-60%），$0.12/task |
| **企业级** | CrewAI Enterprise AMP（可视化编辑器、实时监控、团队协作） |
| **协议** | Apache-2.0 ✅，支持 A2A 协议（跨框架互操作） |
| **特色** | 不同 Agent 可用不同 LLM（成本优化）、非工程师也可快速定义团队 |
| **优势** | 学习曲线最平缓、原型开发最快、多模型混用、A2A互操作 |
| **劣势** | 状态控制不如 LangGraph、复杂多步任务准确率偏低 |

**EcoMind OS 契合度**: ★★★★ — 推荐（业务域团队建模）
- "角色"概念天然匹配业务场景（环评师、监测员、执法员）
- Hierarchical模式可快速搭建"科长→科员"式审批团队
- A2A协议支持 → 与其他框架Agent互操作

---

#### ③ Microsoft Agent Framework 1.0 — 企业级一体化（最完整）

| 维度 | 详情 |
|------|------|
| **发布日期** | 2026年4月7日 |
| **GitHub** | microsoft/agent-framework |
| **定位** | Semantic Kernel + AutoGen 合并，微软官方统一Agent框架 |
| **架构** | 4层：Kernel → Agents → Orchestration（有向图）→ Infrastructure |
| **编排模式** | Sequential + Fan-out/Fan-in（并行聚合）+ Handoff（动态交接） |
| **MCP** | 内建客户端，自动发现MCP Server工具 |
| **A2A** | 内建1.0协议（与Google联合开发），Agent Card发现+标准化消息交换 |
| **调试** | DevUI（浏览器可视化图渲染、步进回放、工具调用追踪）— 免费 |
| **观测** | OpenTelemetry原生导出 → Datadog/Grafana/Azure Monitor |
| **企业级** | 12000+组织、10亿+月交互、LTS承诺 |
| **协议** | MIT ✅ |
| **语言** | Python + .NET（无Java/Go/TS） |
| **优势** | MCP+A2A双协议内建、免费DevUI调试器、企业级Session/Middleware、Azure原生 |
| **劣势** | 仅Python/.NET、文档合并期有缺失、简单场景代码量较大、Azure倾向 |

**EcoMind OS 契合度**: ★★★☆ — 部分推荐
- MCP+A2A双协议内建 → 如果选A2A互操作路线，这是最佳载体
- DevUI免费 → 降低调试门槛
- ⚠️ 但仅Python/.NET，EcoMind OS前端TypeScript生态不兼容
- ⚠️ Azure倾向，本地部署/国密适配需要额外工作

---

#### ④ AG2 (AutoGen fork) — 对话式协作（最灵活）

| 维度 | 详情 |
|------|------|
| **GitHub** | ag2ai/ag2 (4.6K★) |
| **定位** | AutoGen原作者创立，延续"群聊式"Agent协作理念 |
| **架构** | 事件驱动 + MemoryStream（发布/订阅）+ 异步通信 |
| **多Agent模式** | GroupChat（自由对话，可配置speaker选择策略）+ 辩论/共识 |
| **Benchmark** | 多步任务准确率 91%，多轮协商场景最佳 |
| **协议** | Apache-2.0 ✅，MCP v0.12+原生支持 |
| **优势** | 多轮对话最强、代码执行沙箱(Docker)、事件驱动可扩展 |
| **劣势** | 仅Python、Token成本最高（$0.45/task）、无托管服务 |

**EcoMind OS 契合度**: ★★★ — 特定场景适用
- GroupChat模式适合"多专家讨论"场景（如环评评审会、督察组讨论）
- 但Token成本高，不适合作为主编排引擎

---

#### ⑤ OpenAI Agents SDK — Handoff链式（最简单）

| 维度 | 详情 |
|------|------|
| **定位** | Agent间通过"Handoff"顺序交接控制权 |
| **架构** | Agent A → Handoff → Agent B → Handoff → Agent C |
| **多Agent模式** | Pipeline（链式）+ 路由（分类后选择下一Agent） |
| **Benchmark** | 准确率90%，延迟低，$0.11/task |
| **特色** | 原生语音Agent（Realtime Agents）+ Production Harness（沙箱+追踪+恢复） |
| **协议** | MIT ✅，MCP v0.7+ |
| **优势** | API最简洁、语音Agent原生、Production Harness成熟 |
| **劣势** | 仅支持顺序Handoff、无原生并行/图路由、绑定OpenAI生态 |

**EcoMind OS 契合度**: ★★☆ — 不推荐作为主框架
- 仅顺序Handoff，无法满足复杂编排需求
- 绑定OpenAI API，与LiteLLM多模型策略冲突

---

#### ⑥ Strands Agents — AWS极简派（最轻量）

| 维度 | 详情 |
|------|------|
| **定位** | AWS开源，仅3个原语（Model/Tools/Agent），框架极简 |
| **多Agent模式** | 4种内建：Agents-as-Tools、Swarms、Graphs、Meta-Agents |
| **协议** | Apache-2.0 ✅，MCP一等支持，OTEL原生 |
| **优势** | 代码量最少、模型无关（Bedrock/Anthropic/OpenAI/LiteLLM/Ollama）、语义搜索工具过滤（6000+工具） |
| **劣势** | 状态管理轻量（无内建持久化）、AWS生态倾向、社区相对小 |

**EcoMind OS 契合度**: ★★★ — 参考价值
- 极简设计理念值得借鉴（EcoMind OS的Agent插件可以参考其3原语设计）
- Meta-Agents（动态运行时创建Agent）模式有参考价值

---

#### ⑦ Claude Agent SDK — 深度单Agent（最强工具）

| 维度 | 详情 |
|------|------|
| **定位** | Anthropic官方，Agent即沙箱运行时（持久化环境状态） |
| **特色** | 持久化沙箱、跨会话状态保持、MCP原生（Anthropic联合创建） |
| **协议** | 专有SDK（非开源） |
| **优势** | 工具密集型任务最佳（准确率92%）、Claude Managed Agents托管 |
| **劣势** | 绑定Claude模型、无原生多Agent编排 |

**EcoMind OS 契合度**: ★★ — 不适用
- 绑定Claude模型 → 与"本地推理+LiteLLM多模型"策略冲突
- 专有SDK → 不可深度定制

---

#### ⑧ AgentMesh — P2P Mesh通信（最创新）

| 维度 | 详情 |
|------|------|
| **GitHub** | MinimalFuture/AgentMesh（Go核心）+ agentmesh-sdk（Python） |
| **定位** | "AI Agent的电话网络" — Agent即插即用、能力发现、任意通信 |
| **架构** | 6个原语：Register → Discover → Request → Respond → Emit → Subscribe |
| **特色** | P2P Mesh拓扑（非C/S）、能力语义发现、事件发布/订阅 |
| **语言** | Go（核心）+ Python SDK |
| **协议** | 开放协议 |
| **优势** | 无需网络代码、任意Agent即插即用、跨组织/跨浏览器通信 |
| **劣势** | 新项目、社区小、Go主语言与EcoMind OS Python栈不匹配、缺少成熟的任务编排能力 |

**EcoMind OS 契合度**: ★★★ — 远期参考
- Mesh通信理念适合IoT设备Agent间通信（L3层）
- 但作为Agent编排主框架过于早期

---

#### ⑨ MetaGPT / MGX — 软件开发团队（最对口）

| 维度 | 详情 |
|------|------|
| **GitHub** | FoundationAgents/MetaGPT (~46K★) |
| **定位** | "第一个AI软件公司" — 用自然语言驱动完整软件开发团队 |
| **MGX** | 2025年2月发布的商业产品，ProductHunt #1 |
| **架构** | 标准化SOP流程：PM需求 → 架构师设计 → 工程师编码 → QA测试 |
| **角色** | ProductManager / Architect / ProjectManager / Engineer / QA / ...
| **协议** | MIT ✅ |
| **优势** | 最完整的"软件团队"模拟、标准化SOP、输出规范文档（PRD/设计/代码） |
| **劣势** | MCP/A2A支持缺失、更新频率下降（重心转向MGX商业版）、灵活编排能力弱 |

**EcoMind OS 契合度**: ★★★ — SOP设计参考
- 其"角色SOP"流程（PM→架构→工程→QA）可作为EcoMind OS业务流程设计的参考
- 不建议作为主编排框架（协议支持缺失、社区重心转移）

---

## 四、Benchmark 横评

| 框架 | 多步准确率 | 延迟 | Token成本 | 最佳场景 |
|------|-----------|------|----------|---------|
| **LangGraph** | **94%** | 中 | $0.08 ✅ | 大型复杂系统 |
| Claude Agent SDK | 92% | 中 | $0.15 | 工具密集型 |
| **AG2** | 91% | 高 | $0.45 ❌ | 多轮协商 |
| OpenAI Agents SDK | 90% | 低 | $0.11 | GPT生态 |
| Strands Agents | 89% | 低 | $0.10 ✅ | AWS部署 |
| **CrewAI** | 87% | 低 ✅ | $0.12 | 快速原型 |

> 来源：Lushbinary Agent Benchmark (2026 Q1) + Kunpeng AI Framework Evaluation

---

## 五、EcoMind OS 应用方案（核心决策）

### 5.1 现状诊断

```
当前 EcoMind OS Agent 编排栈：
┌──────────────────────────────────────────────────┐
│  L1 路由: OpenClaw Gateway + ACP 协议            │  ← 已有路由
│  L2 执行: TAIJI-AGENT Loop + EventBus + Plugin   │  ← 有事件通信，无团队编排
│  工作流:  Temporal.io DAG                        │  ← 有工作流，非Agent原生
│  ❌ 缺失:  多Agent团队协作编排层                  │
└──────────────────────────────────────────────────┘
```

**关键差距**：
1. TAIJI-AGENT 的 EventBus 是低级事件通信，不是"任务分解→分配→收集→综合"的团队编排
2. Temporal DAG 是通用工作流引擎，不理解Agent语义（角色、能力、上下文）
3. OpenClaw Gateway 是"消息路由到Agent"，不是"Agent间协作完成任务"

### 5.2 推荐方案：LangGraph + CrewAI 双引擎架构

```
┌──────────────────────────────────────────────────────────────────┐
│                    L1 交互与路由层                                 │
│  OpenClaw Gateway → 用户意图分类 → 路由到对应团队                  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │           L2 Agent 团队协作层（新增）                     │    │
│  │                                                          │    │
│  │  ┌─────────────┐    ┌──────────────┐                    │    │
│  │  │  LangGraph   │    │   CrewAI     │                    │    │
│  │  │  (复杂编排)  │    │  (业务团队)   │                    │    │
│  │  │              │    │              │                    │    │
│  │  │ • 状态机图   │    │ • 角色定义    │                    │    │
│  │  │ • 条件分支   │    │ • 任务链      │                    │    │
│  │  │ • 审批中断   │    │ • 团队协作    │                    │    │
│  │  │ • 并行扇出   │    │ • 多模型混用  │                    │    │
│  │  └──────┬──────┘    └──────┬───────┘                    │    │
│  │         │    统一Agent接口  │                             │    │
│  │         └───────┬──────────┘                             │    │
│  │                 ▼                                        │    │
│  │  ┌──────────────────────────────┐                        │    │
│  │  │   TAIJI-AGENT Agent Loop      │                        │    │
│  │  │   + Plugin + EventBus         │                        │    │
│  │  │   + MCP + A2A + GovMCP        │                        │    │
│  │  └──────────────────────────────┘                        │    │
│  │                                                          │    │
│  │  Temporal.io DAG ← 工作流持久化 + 重试 + 超时            │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  L5 安全: TAIJI-VERIFY + NeMo Guardrails + Langfuse (审计)      │
└──────────────────────────────────────────────────────────────────┘
```

### 5.3 双引擎分工

| 维度 | LangGraph | CrewAI |
|------|-----------|--------|
| **定位** | 复杂流程编排引擎 | 业务角色团队建模 |
| **适用场景** | 环评报告生成（多步审批）、应急指挥（条件分支）、排污许可（状态机） | 日常监测团队（站长→监测员）、执法团队（队长→队员）、督察组 |
| **编排模式** | Supervisor + Pipeline + Swarm | Supervisor + Pipeline |
| **状态管理** | Checkpoint（Redis/PG）| Crew Memory（轻量） |
| **人工介入** | interrupt()（审批确认）| HumanInput（角色输入） |
| **协议集成** | LangChain MCP适配器 | 社区MCP适配 + A2A |
| **调试** | LangGraph Studio / Langfuse | CrewAI Enterprise AMP |

### 5.4 业务场景映射

#### 场景1：环境影响评价报告生成（LangGraph驱动）

```
用户上传材料
    │
    ▼
┌──────────────────────────────────────────────────┐
│ LangGraph 状态图                                   │
│                                                    │
│ [分类Agent] → 判断项目类型                         │
│      │                                             │
│      ├→ [环评Agent] → 收集数据 → 生成初稿          │
│      │       │                                     │
│      │       ├→ [审核Agent] → 质量检查             │
│      │       │       │                             │
│      │       │       ├ 通过 → [审批Agent]          │
│      │       │       │    │                        │
│      │       │       │    ├ L1 → 自动通过          │
│      │       │       │    ├ L2 → interrupt()人工确认│
│      │       │       │    └ L3 → 双因子+审批链     │
│      │       │       │                             │
│      │       │       └ 驳回 → 回到[环评Agent]       │
│      │       │                                     │
│      └→ [验收Agent] → 竣工环保验收                  │
└──────────────────────────────────────────────────┘
```

#### 场景2：日常环境监测团队（CrewAI驱动）

```
┌──────────────────────────────────────────────────┐
│ CrewAI: 环境监测站团队                              │
│                                                    │
│ Crew: "XX监测站值班团队"                            │
│                                                    │
│ 👤 站长Agent (Manager)                            │
│    → 任务分配、结果审核                             │
│                                                    │
│ 👷 监测Agent (Worker)                              │
│    → 接收站长的任务 → 调取传感器数据                │
│    → 判断是否超标 → 生成预警                        │
│                                                    │
│ 📊 分析Agent (Worker)                              │
│    → 数据趋势分析 → 报告生成                        │
│                                                    │
│ 📢 通报Agent (Worker)                              │
│    → 超标时自动生成通报 → 发送给相关人员             │
│                                                    │
│ 流程: Hierarchical (站长→自动分配)                  │
└──────────────────────────────────────────────────┘
```

#### 场景3：突发环境应急指挥（LangGraph + CrewAI混合）

```
[报警触发] → LangGraph Router 分类
    │
    ├─ 水污染 → CrewAI团队: 应急处置组
    │              (指挥Agent + 水质Agent + 通知Agent)
    │
    ├─ 大气污染 → CrewAI团队: 大气应急组
    │
    └─ 危化品泄漏 → LangGraph复杂流程
                     (隔离→评估→处置→恢复→复盘)
                     每步都有interrupt()人工确认
```

---

## 六、集成路线图

### Phase 1（Month 1-2）：基础集成

| 任务 | 详情 | 优先级 |
|------|------|--------|
| 1. LangGraph POC | 在TAIJI-AGENT中嵌入LangGraph作为编排后端 | P0 |
| 2. 统一Agent接口 | 定义 TAIJI-AGENT ↔ LangGraph ↔ CrewAI 的Adapter | P0 |
| 3. MCP工具集成 | 让LangGraph/CrewAI中的Agent能调用MCP工具 | P0 |
| 4. Langfuse接入 | 全链路Agent调用追踪 | P0 |

### Phase 2（Month 3-4）：业务场景落地

| 任务 | 详情 | 优先级 |
|------|------|--------|
| 5. CrewAI业务团队 | 建立监测站/执法队/督察组角色模板 | P0 |
| 6. 环评报告流水线 | LangGraph实现环评报告多步生成+审批 | P0 |
| 7. A2A协议接入 | 实现跨框架Agent发现和通信 | P1 |
| 8. 应急指挥流程 | LangGraph状态机实现应急响应 | P1 |

### Phase 3（Month 5-6）：企业级增强

| 任务 | 详情 | 优先级 |
|------|------|--------|
| 9. CrewAI Enterprise评估 | 评估AMP可视化编辑器是否适合运维 | P1 |
| 10. 自我学习闭环 | 集成EvoAgentX实现Agent团队自我进化 | P2 |
| 11. AgentMesh参考 | 研究IoT设备Agent Mesh通信可行性 | P2 |
| 12. 国密/合规适配 | 确保所有Agent通信走GovMCP加密 | P0 |

---

## 七、技术风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| LangGraph学习曲线 | 开发效率低 | 先用CrewAI快速建模业务，复杂场景才上LangGraph |
| 双引擎维护成本 | 两套编排逻辑 | 定义统一Agent接口层，底层可切换 |
| MCP生态碎片化 | 工具兼容问题 | Langfuse做中间层抽象 |
| A2A协议不成熟 | 跨框架通信不达标 | Phase 1先用内部协议，Phase 2再接A2A |
| CrewAI准确率(87%) | 简单编排可靠但复杂场景可能偏离 | 关键流程走LangGraph（94%），CrewAI做辅助 |

---

## 八、决策建议总结

### 🔴 D11：Agent团队管理核心选型

| 决策 | 选择 | 理由 |
|------|------|------|
| **主编排引擎** | **LangGraph** | 94%准确率+Checkpoint+interrupt()+生产验证+MIT |
| **业务角色建模** | **CrewAI** | 最直觉的"角色团队"概念+快速原型+A2A+Apache-2.0 |
| **通信协议** | **MCP（工具调用）+ A2A（Agent互操作）** | MCP成熟工具层，A2A是新Agent层标准 |
| **观测追踪** | **Langfuse**（已在D7确认）| 全链路Agent调用追踪 |
| **MS Agent Framework** | **跟踪观察** | MCP+A2A内建优秀，但仅Python/.NET且Azure倾向 |

### 技术栈更新（追加到 MEMORY.md）

```
Agent编排（新增）：
  - LangGraph（主编排引擎，有向状态图）
  - CrewAI（业务角色团队建模）
  - MCP + A2A 双协议（工具层+Agent层）
  - Temporal.io 保留（工作流持久化）
```

---

## 附录A：框架GitHub链接汇总

| 框架 | GitHub | 文档 |
|------|--------|------|
| LangGraph | langchain-ai/langgraph | langchain-ai.github.io/langgraph |
| CrewAI | ekrtf/crewai | crewai.com |
| MS Agent Framework | microsoft/agent-framework | microsoft.github.io/autogen |
| AG2 | ag2ai/ag2 | ag2.ai |
| OpenAI Agents SDK | openai/openai-agents-python | openai.github.io/openai-agents-python |
| Strands Agents | aws/strands-agents | docs.aws.amazon.com/strands |
| Claude Agent SDK | anthropics/claude-code-sdk | docs.anthropic.com |
| AgentMesh | MinimalFuture/AgentMesh | agentmesh.ai |
| MetaGPT | FoundationAgents/MetaGPT | mgx.dev |

## 附录B：参考来源

1. QubitTool — 2026 AI Agent Framework Showdown (6大框架基准测试)
2. Lushbinary — Multi-Agent Orchestration Patterns Production Guide (2026.05)
3. Agent Framework Comparison — aimultiple.com (2026.03)
4. Microsoft Agent Framework 1.0 Review — openaitoolshub.org (2026.04)
5. OpenAgents — 开源AI Agent框架对比 (2026.02)
6. AgentMesh 官方文档 — agentmesh.ai (2026.02)
7. 腾讯云 — Multi-Agent多智能体协作系统深度解析 (2026.04)
8. 知乎 — 2026 LangGraph vs AutoGen vs CrewAI 实测对比
