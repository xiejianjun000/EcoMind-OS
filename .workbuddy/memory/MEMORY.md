# EcoMind OS 项目约定

## 项目定性
- 项目名：EcoMind OS（生态环境垂直领域智能操作系统），代号 GAIA-ECO
- 性质：工具型领域 AI OS，非通用 AGI；强调可审计、人在环路、不做"AI虚幻"承诺

## 七大来源映射（2026-05-22 全框架融合方案更新）
| 来源 | GitHub/来源 | 协议 | 对应系统层 | 关键能力 | 复用方式 |
|------|------------|------|-----------|---------|---------|
| TAIJI-AGENT 2.0 | **自有Git仓库** (91MB) | MIT ✅ | **全部层（基础框架）** | Agent Loop+EventBus+Plugin+GovMCP+国密+审批+HITL | **自有仓库+二次开发** |
| TAIJI-VERIFY 2.0 | xiejianjun000/taiji-verify | MIT ✅ | L5 安全治理 | 六层验证+16种失败模式+EcoRules生态规则 | **pip依赖+适配器** |
| GOVMCP | 内嵌于TAIJI-AGENT | MIT ✅ | L5 安全治理 | SM2/SM3/SM4+审批工作流(8状态)+会签+政务工具 | **内嵌使用** |
| OpenClaw | openclaw/openclaw (374K★) | MIT ✅ | L1 路由编排 + L2 沙箱 | Gateway网关、多Agent路由、ACP协议、Docker/SSH沙箱 | 直接复用代码 |
| Hermes-Agent | NousResearch/hermes-agent (162K★) | MIT ✅ | L4 记忆学习 | MemoryProvider(12钩子)、三层记忆、学习循环 | 提取集成 |
| OpenHuman | tinyhumansai/openhuman (25K★) | **GPL-3.0** ⚠️ | L4 知识层（仅参考设计） | 记忆树、TokenJuice、Subconscious、prompt_injection | **仅参考设计** |
| 腾讯Marvis | marvis.qq.com（闭源商用） | 闭源 | L2/L3/L5（仅参考） | L2硬确认、三模隐私、跨端协同、DAG编排 | **仅参考思想** |

## 关键决策（全框架融合方案五大决策）
- **D1 后端核心**: TAIJI-AGENT (**自有Git仓库**) — 已有Agent+EventBus+Plugin+GovMCP+国密，省6-12月
- **D2 验证引擎**: TAIJI-VERIFY (pip) — 六层架构+450测试+91%覆盖
- **D3 记忆系统**: Hermes MemoryProvider — 12钩子全生命周期最佳抽象
- **D4 路由编排**: OpenClaw Gateway + ACP — 成熟多Agent路由标准
- **D5 OpenHuman**: 仅参考设计，禁止复制代码（GPL-3.0传染风险）
- **D13 自有仓库**: taiji-agent/GOVMCP 是自有Git仓库，非Fork上游（2026-05-25确认）
- **D14 全量国产模型+本地训练**: Qwen/GLM/DeepSeek/Yi/ChatGLM/Baichuan/MiniCPM/InternLM/Aquila/Skywatch + LoRA/QLoRA/P-Tuning v2微调（2026-05-25确认）
- **D15 本地+云端双模式部署**: 从"纯本地"修订为本地优先+云端可切换；三种模式(Local/Cloud/Hybrid)可热切换；敏感数据(L3)强制本地，非敏感(L1/L2)可走云端API（2026-05-25修订）— **⚠️ 暂停开发，后续按需升级**
- **D16 文件知识预加载**: 每个智能体启动时必须掌握桌面生态环境文件（1445文件/28MB），三层加载+RAG+watchdog（2026-05-25确认）
- **D17 生产级前端UI可视化**: 9大模块前端产品（AntD Pro+Cesium.js+ECharts）；生产级可部署水平；i18n中英双语+暗色亮色主题+等保合规UI（2026-05-25新增）
- **D18 地图引擎四库组合**: Cesium.js(3D数字孪生)+MapLibre GL JS(2D矢量底图)+Deck.gl(大数据可视化)+Turf.js(空间分析)；底图用天地图(免费300万次/天,GB/T 3565合规)（2026-05-25确认）
- **D19 对标Hermes功能水平**: 当前开发目标达到Hermes-Agent同等可部署功能水平；P0差距4项(对话循环/记忆/多模型/工具MCP)、P1差距7项(技能自创建/多Agent编排/Cron/Gateway/WebUI/Docker部署/轨迹审计)（2026-05-25确认）
- **D20 首期地图范围**: 湖南省3D地形图（SRTM 30m DEM+天地图底图）；地形数据来源casearth.cn；切片工具CesiumLab；离线发布cesium-offline-server；3D场景中心[27.6°N,111.7°E]（2026-05-25确认）

## 技术栈首选
- 前端：React 18 + TypeScript + Vite + Ant Design Pro + Cesium.js + MapLibre GL + Deck.gl + Turf.js + ECharts + Zustand + Tailwind CSS + Socket.IO（生产级9模块前端，天地图底图）
- 后端：Python（主，与Hermes一致）+ TypeScript
- 工作流：Temporal.io（DAG驱动，支持 signal 等待审批）
- LLM接口：LiteLLM（统一接口）+ EcomodelAdapter（非OpenAI-compatible模型适配）+ Hermes Adapter模式
- Agent通信：MCP + ACP + A2A 三协议（OpenClaw标准+Agent互操作）
- Agent编排：LangGraph（主编排引擎，有向状态图）+ CrewAI（业务角色团队建模）
- 本地推理：vLLM + SGLang（PagedAttention + RadixAttention）
- 本地训练：LoRA/QLoRA/P-Tuning v2（LLaMA-Factory/Swift框架）
- 工作流：Temporal.io（DAG驱动，支持 signal 等待审批）
- 知识图谱：Neo4j + LlamaIndex
- 向量存储：PostgreSQL + pgvector + Redis
- 消息队列：RabbitMQ/NATS
- 物联接入：EMQX（MQTT）+ OPC UA
- 部署：Docker + K8s（本地+云端双模式部署，可热切换）

## 安全原则
- L1（只读）自动执行，L2（外部调用/发布）点击确认，L3（控制设备/发正式公文）双因子+审批
- L3数据强制本地处理，L1/L2可按需路由到云端（脱敏后）
- 云端降级策略：本地GPU>85%→数据脱敏→路由到云端API；L3不可降级
- 参考Marvis L2硬确认 + 全链路审计 + 三模隐私

## 开发阶段
- Phase 1（0-3月）：数据地基
- Phase 2（4-7月）：模型集成与任务编排
- Phase 3（8-10月）：设备贯通与知识记忆
- Phase 4（11-12月）：自进化与交付

## 生态环境 12 大业务域（覆盖状态 — 融合后更新）
- ✅ 完全覆盖 (10/12): 环境监测、生态修复、应急管理、环境影响评价、排污许可管理、生物多样性保护、执法监察、生态督察、政务审批合规
- 🔶 部分覆盖 (3/12): 碳排放管理、公众参与/信息公开、气候变化适应
- ❌ 完全未覆盖 (0/12): 无
- **核心改善**: TAIJI三项目加入后覆盖率从17%提升到83%

## 深度分析报告
- `.workbuddy/analysis/frameworks-github-deep-analysis.md` — OpenClaw/Hermes/OpenHuman源码分析（架构师）
- `.workbuddy/analysis/marvis-local-deep-analysis.md` — Marvis深度分析（产品经理）
- `.workbuddy/analysis/frameworks-comprehensive-summary.md` — 四大框架综合汇总（主理人）
- `.workbuddy/analysis/founders-playbook-ecomind-assessment.md` — 创始人手册项目开发评估 v2（主理人）
- `.workbuddy/analysis/taiji-govmcp-verify-fusion-analysis.md` — TAIJI三项目融合分析（主理人）
- `.workbuddy/analysis/ecomind-os-full-fusion-plan.md` — 全框架融合开发方案 v1.0 Final（主理人）
- **`.workbuddy/analysis/ecomind-os-tech-development-plan.md` — 技术开发方案 v1.1（主理人，2026-05-25 评审修订）** ← 最新 · 可直接开发
- **`.workbuddy/analysis/ecomind-os-tech-plan-review-and-modification.md` — v1.0 评审报告（主理人，2026-05-25）**
- **`.workbuddy/analysis/ecomind-os-opensource-ecosystem-scan-2026.md` — 开源生态追踪报告 v1.0（2026-05-25，60+项目扫描）**
- **`.workbuddy/analysis/ecomind-os-agent-team-management-scan-2026.md` — Agent团队管理框架深度调研（2026-05-25，9大框架对比+D11决策）**
- **`.workbuddy/analysis/ecomind-os-tech-development-plan-v3.0-agent-patterns.md` — 技术开发方案 v3.0 Agent提示词架构版（2026-05-25，六大模式融入+D12决策）**
- `.workbuddy/analysis/ecomind-os-tech-development-plan-v5.0-dual-mode-frontend.md` — 技术开发方案 v5.0（⚠️ D15双模式暂停）
- **`.workbuddy/analysis/ecomind-os-tech-development-plan-v6.0-final.md` — 技术开发方案 v6.0 最终可开发版（2026-05-25，D20湖南地形+Hermes对标+团队正式开发）** ← 最新

## 创始人手册评估补充文档（2026-05-22 全部完善）
- `.workbuddy/analysis/user-interview-guide.md` — 目标用户访谈指南（4画像+20问题+方法论+验收标准）
- `.workbuddy/analysis/mvp-scope-document.md` — MVP范围文档（In/Out Scope+成功标准+3月里程碑）
- `.workbuddy/analysis/business-model-canvas.md` — 商业模式画布（9模块+3场景+CAC/LTV估算）
- `.workbuddy/analysis/competitive-analysis.md` — 竞争格局分析（6家直接竞品+矩阵+差异化定位）
- `.workbuddy/analysis/ai-counter-argument.md` — AI反方论证（4维度9条质疑+回应+压力测试结论）
- `.workbuddy/analysis/metrics-dashboard-definition.md` — 指标仪表盘定义（北极星+20+KPI+3看板）
- `.workbuddy/analysis/compliance-roadmap.md` — 合规路线图（等保二三级+3阶段+差距分析）
- `.workbuddy/analysis/gpl-license-review.md` — GPL-3.0 License审查（传染性分析+License矩阵+防护措施）
- `.workbuddy/analysis/founder-knowledge-guide.md` — 创始人知识外化指南（5类框架+L4映射+模板）

## Taiji 项目融合（2026-05-25 更新）
- **仓库**：taiji-agent + taiji-verify 均为**自有 Git 仓库**（非 Fork 上游）
- GOVMCP 已作为 Agent 内嵌子模块（`src/taiji_agent/govmcp/`），含国密SM2/SM3/SM4、审批工作流、政务工具集
- Agent 内嵌 Verify 精简版（8 核心模块），独立仓库有完整六层架构（+detection/reasoning/diagnosis/governance/execution）
- 融合分析：`.workbuddy/analysis/taiji-govmcp-verify-fusion-analysis.md`

## 开源生态追踪（2026-05-25）
- 4维度并行扫描：Agent编排(15项) + 记忆知识图谱(15项) + IoT数字孪生环境(15项) + LLM安全观测(16项)
- 6个新决策：D6记忆升级(Mem0+Graphiti+GraphRAG)、D7 L5八层防御(象信+NeMo+LettuceDetect+Langfuse)、D8数据三合一(TimescaleDB+PostGIS)、D9协议矩阵(+A2A)、D10本地推理(SGLang+vLLM)、D11 Agent团队管理(LangGraph+CrewAI)
- Top 10 P0项目：Mem0(56.6k), Langfuse(27.8k), NeMo Guardrails(6.2k), 象信AI安全护栏, LettuceDetect, TimescaleDB(22.7k), PostGIS, Graphiti(26.5k), GraphRAG(33.2k), A2A Protocol
- Agent团队管理调研：LangGraph(94%准确率,MIT)为主编排引擎 + CrewAI(45.9K★,Apache-2.0)为业务角色建模 + MS Agent Framework 1.0跟踪观察

## 文件知识预加载（2026-05-25 新增）
- 每个智能体启动时必须掌握桌面 EcoMind OS 项目所有文件（1445文件/28MB）作为初始状态
- 三层加载策略：Layer 1 核心索引(<500KB,全量注入) → Layer 2 领域知识(<5MB,按Agent类型裁剪) → Layer 3 深度知识(RAG检索)
- 技术实现：LlamaIndex + pgvector + Neo4j 向量索引 + GraphRAG 语义分块 + watchdog 文件变更监听
- 详细方案：`.workbuddy/analysis/ecomind-os-tech-development-plan-v4.0-local-deploy.md` §4

## 国产大模型兼容（2026-05-25 新增）
- 兼容10家国产大模型：Qwen/GLM/DeepSeek/Yi/ChatGLM/Baichuan/MiniCPM/InternLM/Aquila/Skywork
- 统一路由：LiteLLM + EcomodelAdapter（非OpenAI-compatible模型适配器）
- 本地推理：vLLM（PagedAttention）+ SGLang（RadixAttention）
- 本地微调：LoRA/QLoRA/P-Tuning v2（LLaMA-Factory/Swift）
- 模型路由映射：opus→DeepSeek-671B/Qwen3-72B, sonnet→Qwen3-14B/GLM-4-9B, haiku→Qwen3-4B/MiniCPM-4B

- **D17 生产级前端UI可视化**: 9大模块前端产品（AntD Pro+Cesium.js+ECharts）；生产级可部署水平；i18n中英双语+暗色亮色主题+等保合规UI（2026-05-25新增）

## 注意事项
- 本地存在"贾维斯(Jarvis)一人AI公司"项目（agent-command-center），**不是Marvis**，勿混淆
