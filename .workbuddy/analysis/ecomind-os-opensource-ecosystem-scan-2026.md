# EcoMind OS 开源生态追踪报告 v1.0

**日期**: 2026-05-25  
**性质**: 持续追踪 · 技术选型参考  
**范围**: 2024年底-2026年5月开源生态全景扫描  
**方法论**: 4个专项研究员并行扫描，按架构层分类，与现有技术栈逐一对比

---

## 一、扫描概览

### 1.1 扫描策略

围绕 EcoMind OS 五层架构，从4个维度进行系统性开源生态扫描：

| 扫描维度 | 对应架构层 | 现有技术栈 | 扫描项目数 |
|---------|-----------|-----------|-----------|
| Agent编排框架 | L1路由编排 + L2 Agent执行 | TAIJI-AGENT + OpenClaw + Temporal | 15 |
| 记忆/知识图谱 | L4记忆学习 | Hermes + Neo4j + LlamaIndex + pgvector | 15 |
| IoT/数字孪生/环境 | L3设备贯通 + 业务域 | EMQX + Cesium.js | 15 |
| LLM安全/观测 | L5安全治理 + 基础设施 | TAIJI-VERIFY + LiteLLM | 15+ |

**总计发现**: 60+ 个值得关注的开源项目，覆盖 20+ 个技术方向

### 1.2 评估标准

每个项目按以下维度评估：
- **协议兼容性**: MIT / Apache-2.0 优先，GPL/AGPL 需谨慎
- **技术栈匹配度**: 与现有 Python + TypeScript 体系的兼容性
- **填补空白能力**: 解决现有方案的哪个具体短板
- **社区活跃度**: Star数、更新频率、维护状态
- **集成难度**: 低（pip/npm）/ 中（Docker部署）/ 高（重构适配）
- **与现有方案关系**: 替代 / 互补 / 跟踪

### 1.3 协议分布

| 协议 | 数量 | 说明 |
|------|------|------|
| MIT | 16 | 无限制集成 |
| Apache-2.0 | 28 | 无限制集成 |
| BSD-3-Clause | 1 | 兼容 |
| EPL-2.0 | 1 | 需注意商业条款 |
| GPL-2.0 | 1 | 传染风险，需隔离使用 |
| MPL-2.0 | 2 | 文件级传染，可接受 |
| ELv2 | 1 | 分发限制 |
| 其他/待确认 | 若干 | 需逐一审查 |

---

## 二、五层架构补充方案总览

### 2.1 架构全景图

```
┌─────────────────────────────────────────────────────────────────┐
│                    L1 交互与路由层                                │
│  现有: OpenClaw Gateway + TAIJI-AGENT Plugin                    │
│  补充: Pydantic AI (类型安全) + A2A Protocol (Agent互操作)       │
│        + MCP 2026 路线图跟踪                                     │
├─────────────────────────────────────────────────────────────────┤
│                    L2 Agent 执行层                               │
│  现有: TAIJI-AGENT Loop + EventBus + Temporal DAG               │
│  补充: DSPy (推理增强) + Daytona (90ms沙箱)                      │
│        + AG2 (对话模式) + Strands (极简参考)                     │
├─────────────────────────────────────────────────────────────────┤
│                    L3 设备贯通层                                  │
│  现有: EMQX (MQTT) + Cesium.js (3D)                             │
│  补充: TimescaleDB (时序) + PostGIS (空间) + Eclipse Ditto (DT)  │
│        + GeoAI (遥感AI) + open62541 (OPC UA)                    │
│        + MapLibre GL JS (2D地图) + CodeCarbon (碳追踪)           │
├─────────────────────────────────────────────────────────────────┤
│                    L4 记忆与知识层                                │
│  现有: Hermes MemoryProvider + Neo4j + LlamaIndex + pgvector    │
│  补充: Mem0 (长期记忆) + Graphiti (时序KG) + GraphRAG (KG构建)   │
│        + RAG_Techniques (检索策略) + STORM (报告生成)            │
│        + Ecolink Model (环境本体)                                │
├─────────────────────────────────────────────────────────────────┤
│                    L5 安全治理层                                  │
│  现有: TAIJI-VERIFY + LiteLLM + GovMCP (SM2/3/4)                │
│  补充: NeMo Guardrails (输入防护) + Langfuse (审计追踪)          │
│        + 象信AI安全护栏 (中文合规) + LettuceDetect (幻觉检测)     │
│        + DeepEval (评估引擎) + Guardrails AI (结构验证)          │
│        + vLLM/SGLang (自建推理) + Portkey (备用网关)             │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 现有技术栈定位（不变）

以下核心骨架保持不变，新项目均为**补充增强**而非替代：

| 核心 | 角色 | 不可替代原因 |
|------|------|------------|
| **TAIJI-AGENT 2.0** (Fork) | Agent Loop + EventBus + Plugin + GovMCP | 已深度定制，国密审批流，Fork代码可控 |
| **OpenClaw** | Gateway + 多Agent路由 + ACP协议 | 成熟路由标准，374K★ 社区 |
| **Hermes-Agent** | MemoryProvider 抽象层 | 12钩子设计灵活，适配器模式 |
| **Neo4j** | 知识图谱存储 | 成熟图数据库 |
| **LlamaIndex** | 知识索引 | RAG生态核心 |
| **LiteLLM** | 统一LLM接口 | 100+ Provider 支持 |

---

## 三、Top 20 必关注项目（按优先级排序）

### 🔴 P0 — 强烈建议集成（Phase 1-2）

| # | 项目 | Star | 协议 | 覆盖层 | 核心价值 | 集成难度 |
|---|------|------|------|--------|---------|---------|
| 1 | **Mem0** | 56.6k | Apache-2.0 | L4 记忆 | 多信号融合检索+时序推理+实体链接，比Hermes生态更大 | 低 |
| 2 | **Langfuse** | 27.8k | MIT | L5 观测 | 全链路LLM调用追踪+Prompt版本管理+A/B测试，审计核心 | 低 |
| 3 | **NeMo Guardrails** | 6.2k | Apache-2.0 | L5 安全 | 5层安全管道+Colang DSL+事实核查+GPU加速 | 中 |
| 4 | **象信AI安全护栏** | 新兴 | Apache-2.0 | L5 安全 | **唯一中文政务合规**开源护栏，敏感词过滤+越狱检测 | 低 |
| 5 | **LettuceDetect** | 576 | MIT | L5 安全 | Token级RAG幻觉检测+中文支持+68M极轻量可本地部署 | 低 |
| 6 | **TimescaleDB** | 22.7k | Apache-2.0 | L3 数据 | PostgreSQL时序扩展，与PG统一运维，环境传感器数据 | 低 |
| 7 | **PostGIS** | 2.1k | GPL-2.0 | L3 空间 | 空间数据索引+数百空间函数，环境站点/排污口必备 | 低 |
| 8 | **Graphiti** | 26.5k | Apache-2.0 | L4 知识 | 时序知识图谱+Neo4j后端+增量构建+数据血缘 | 低 |
| 9 | **GraphRAG** | 33.2k | MIT | L4 知识 | 微软官方KG自动构建+层次社区检测+私有数据推理 | 中 |
| 10 | **A2A Protocol** | 开放标准 | Linux Foundation | L1 协议 | Google发起，150+伙伴，Agent互操作标准（与MCP互补） | 中 |

### 🟡 P1 — 建议纳入路线图（Phase 2-3）

| # | 项目 | Star | 协议 | 覆盖层 | 核心价值 | 集成难度 |
|---|------|------|------|--------|---------|---------|
| 11 | **GeoAI** | 3.1k | MIT | L3 环境AI | 遥感图像分类/分割/变化检测+SAM集成，排污口/森林检测 | 低 |
| 12 | **DeepEval** | 15.7k | Apache-2.0 | L5 评估 | 50+评估指标+幻觉/毒性/偏见检测，TAIJI-VERIFY评估后端 | 低 |
| 13 | **DSPy** | 34.4k | MIT | L2 推理 | 斯坦福编程式LLM框架，自动优化Prompt/权重，ReAct/ToT/CoT | 中 |
| 14 | **Daytona** | 60k | Apache-2.0 | L2 沙箱 | 90ms沙箱启动+状态持久化，替代OpenClaw Docker沙箱 | 低 |
| 15 | **Eclipse Ditto** | 885 | EPL-2.0 | L3 数字孪生 | 设备影子+策略控制+物模型，L3核心框架 | 中 |
| 16 | **open62541** | 3.1k | MPL-2.0 | L3 工业协议 | OPC UA协议栈，工业排放监测对接PLC/SCADA | 中 |
| 17 | **vLLM** | 80.9k | Apache-2.0 | 基础设施 | 高吞吐本地推理+PagedAttention，政务数据不出本地 | 中 |
| 18 | **SGLang** | 28.2k | Apache-2.0 | 基础设施 | Agent场景吞吐5x vLLM+结构化输出，报告生成优化 | 中 |

### 🟢 P2 — 值得评估（Phase 3-4）

| # | 项目 | Star | 协议 | 覆盖层 | 核心价值 | 集成难度 |
|---|------|------|------|--------|---------|---------|
| 19 | **OpenMemory** | 4.1k | Apache-2.0 | L4 记忆 | 五维记忆模型(情景/语义/程序/情感/反思)+可解释召回 | 低 |
| 20 | **RAG_Techniques** | 27.5k | 待确认 | L4 RAG | 42+种前沿RAG技术完整实现+教程，技术参考宝库 | 低 |
| 21 | **STORM** | 28.3k | MIT | L4 报告 | 斯坦福自动知识策展+维基式长文报告生成 | 低 |
| 22 | **segment-geospatial** | 4k | MIT | L3 遥感 | SAM地理空间分割，水体/植被/土地利用分割 | 低 |
| 23 | **MapLibre GL JS** | 10.7k | BSD-3-Clause | L3 2D地图 | Cesium.js的2D互补，运营大屏热力图/轨迹回放 | 低 |
| 24 | **CodeCarbon** | 1.8k | MIT | 环境业务 | 计算任务碳排放追踪，AI推理能耗度量 | 低 |
| 25 | **OpenAQ** | 64 | MIT | 环境业务 | 全球20万+空气质量监测站数据，外部基准数据 | 低 |
| 26 | **Pydantic AI** | 17.1k | MIT | L1 开发 | 编译时类型安全Agent开发+MCP+A2A双协议 | 低 |
| 27 | **AG2 (AutoGen fork)** | 4.6k | Apache-2.0 | L2 对话 | 事件驱动多Agent+GroupChat+原生MCP | 中 |
| 28 | **Letta (MemGPT)** | 22.9k | Apache-2.0 | L4 记忆 | Agent自主记忆管理+自我改进+模块化技能 | 中 |
| 29 | **openLCA** | — | MPL-2.0 | 碳核算 | 专业生命周期评估(LCA)+碳足迹计算+IPC API | 中 |
| 30 | **Guardrails AI** | 6.9k | Apache-2.0 | L5 验证 | Pydantic结构化输出验证+50+验证器+OnFailActions | 低 |
| 31 | **Ragas** | 14k | Apache-2.0 | L5 RAG评估 | RAG忠实度/答案相关性/上下文精度评估 | 低 |
| 32 | **Memary** | 2.6k | MIT | L4 知识 | Neo4j+LlamaIndex原生+自动知识图谱+递归检索 | 低 |
| 33 | **LightMem** | 857 | MIT | L4 边缘记忆 | 轻量记忆+MCP+边缘部署，IoT网关适用 | 低 |
| 34 | **Mastra** | 22k | Apache-2.0 | L1 TS生态 | TypeScript原生Agent+Workflow引擎，扩展TS生态 | 中 |
| 35 | **Portkey Gateway** | 11.8k | MIT | 基础设施 | 轻量TypeScript网关+1600+多模态模型 | 低 |

---

## 四、关键决策建议

### 4.1 D6：记忆系统升级方案

**现状**: Hermes MemoryProvider（12钩子，三层记忆，但生态较小）

**建议方案**: **Mem0 + Graphiti + Hermes 共存**

```
┌─────────────────────────────────────────┐
│            EcoMind OS 记忆架构           │
├─────────────────────────────────────────┤
│  短期记忆: Hermes MemoryProvider         │
│    ↳ 会话内上下文管理，12钩子灵活控制    │
│    ↳ 保持现有架构不变                    │
├─────────────────────────────────────────┤
│  长期记忆: Mem0                          │
│    ↳ 跨会话持久化，User/Session/Agent级  │
│    ↳ 多信号融合检索(语义+BM25+实体)      │
│    ↳ 时序推理（当前/过去/未来）          │
├─────────────────────────────────────────┤
│  知识图谱: Graphiti + Neo4j              │
│    ↳ 时序知识图谱(valid_at/invalid_at)  │
│    ↳ 增量构建 + 数据血缘                │
│    ↳ Neo4j后端直接复用                  │
├─────────────────────────────────────────┤
│  KG自动构建: GraphRAG v3                │
│    ↳ 非结构化文本 → 结构化知识图谱       │
│    ↳ 层次社区检测(传感器→生态→全局)      │
│    ↳ 本地模型支持，数据不出本地          │
├─────────────────────────────────────────┤
│  环境本体: Ecolink Model (ELM)          │
│    ↳ 环境领域知识图谱Schema蓝图         │
│    ↳ 统一环境变量、生态过程描述标准      │
└─────────────────────────────────────────┘
```

**理由**: 
- Hermes的12钩子设计在短期记忆管理上仍有优势（灵活、可控）
- Mem0在长期记忆持久化、多信号检索、实体链接上远超Hermes
- Graphiti的时序图谱与Neo4j完美匹配，填补环境数据时序变化追踪空白
- GraphRAG与Neo4j互补（GraphRAG构建，Neo4j存储）

### 4.2 D7：L5安全治理链路增强

**现状**: TAIJI-VERIFY（六层验证）+ LiteLLM（API网关）+ GovMCP（审批流）

**建议方案**: 8层纵深防御链路

```
用户请求
  │
  ▼
[1] LiteLLM — API网关/流量入口（速率限制/虚拟Key/成本追踪）
  │
  ▼
[2] 象信AI安全护栏 — 中文Prompt安全前置拦截（敏感词/越狱/注入检测）
  │
  ▼
[3] NeMo Guardrails — 5层安全管道（输入→对话→检索→执行→输出）
  │
  ▼
[4] vLLM/SGLang — LLM推理执行（本地部署，数据不出本地）
  │
  ▼
[5] TAIJI-VERIFY 2.0 — 六层输出验证（16种失败模式检测）
  │
  ▼
[6] LettuceDetect — RAG幻觉检测（Token级精确标注）
  │
  ▼
[7] Guardrails AI — 结构化输出验证（Pydantic Schema+数值范围+必填字段）
  │
  ▼
[8] Langfuse — 全链路审计日志（输入→模型→输出→验证→签名）
  │
  ▼
[9] GovMCP — 审批工作流（SM2/SM3/SM4签名+8状态审批链）
```

**关键新增**:
- **象信AI安全护栏**: 唯一面向中文政务合规的开源方案，填补中文Prompt注入检测空白
- **LettuceDetect**: 环境报告幻觉检测的专用方案，68M模型本地部署
- **Langfuse**: 将"观测"从"验证"中分离，提供完整审计追踪证据链

### 4.3 D8：数据层三合一方案

**现状**: PostgreSQL + pgvector + Redis

**建议方案**: PostgreSQL + TimescaleDB + PostGIS + pgvector + Redis

```
PostgreSQL
├── TimescaleDB 扩展 — 时序数据
│   ↳ 环境传感器分钟级数据（PM2.5、水温、COD等）
│   ↳ 连续聚合（小时/日/月指标自动计算）
│   ↳ 超表自动分区（按时间自动分片）
│
├── PostGIS 扩展 — 空间数据
│   ↳ 监测站点空间索引
│   ↳ 排污口/保护区空间查询
│   ↳ 热力图/缓冲区分析
│
├── pgvector 扩展 — 向量数据
│   ↳ RAG文档嵌入存储
│   ↳ 语义检索索引
│
└── 关系数据 — 业务数据
    ↳ 用户/角色/权限
    ↳ 审批工作流
    ↳ 设备台账

Redis — 缓存与会话
├── 热数据缓存（实时监测值）
├── 会话状态（SSE连接管理）
└── 分布式锁（审批并发控制）
```

**理由**: 全部基于PostgreSQL扩展，统一运维，SQL兼容，零额外数据库引入成本

### 4.4 D9：Agent通信协议矩阵

**现状**: MCP + ACP 双协议（OpenClaw标准）

**建议方案**: MCP + A2A + ACP 三协议矩阵

| 协议 | 定位 | 用途 | 状态 |
|------|------|------|------|
| **MCP** | Tool连接协议 | Agent调用工具/资源 | ✅ 已采用，跟踪2026路线图 |
| **A2A** | Agent互操作协议 | Agent间发现/通信/协调 | 🆕 建议新增，150+伙伴生态 |
| **ACP** | Agent控制协议 | Agent生命周期/权限管理 | ✅ 已采用（OpenClaw） |
| **GovMCP** | MCP治理扩展 | 政务合规/审批/国密 | ✅ 自研，跟踪MCP上游兼容 |

**MCP 2026路线图关键跟踪点**:
- 传输演进：无状态会话、水平扩展
- Agent通信：Task原语、重试语义
- 企业就绪：审计追踪、SSO认证
- **建议**: 参与 MCP Enterprise Readiness Working Group

### 4.5 D10：本地推理基础设施

**现状**: 依赖云端LLM API（LiteLLM路由）

**建议**: 增加本地推理能力，解决政务数据不出本地要求

| 方案 | 适用场景 | 优势 |
|------|---------|------|
| **vLLM** (80.9k⭐) | 通用推理，高吞吐 | PagedAttention，分布式推理 |
| **SGLang** (28.2k⭐) | Agent/报告生成场景 | 结构化输出，Agent任务优化 |
| **LiteLLM Proxy** | 统一入口 | 自建模型+云端模型统一路由 |

**推荐组合**: SGLang（环境报告生成+结构化输出）+ vLLM（通用推理）+ LiteLLM（统一路由网关）

---

## 五、环境业务域专属发现

### 5.1 生态环境AI分析

| 项目 | 能力 | 应用场景 |
|------|------|---------|
| **GeoAI** (3.1k⭐) | 遥感图像分类/分割/变化检测+SAM | 排污口识别、森林覆盖变化、水体提取 |
| **segment-geospatial** (4k⭐) | SAM地理空间分割 | 水体边界、植被、土地利用分类 |
| **scikit-eo** (249⭐) | 遥感数据预处理+光谱指数 | 大气校正、水质光谱反演 |

### 5.2 碳排放管理

| 项目 | 能力 | 应用场景 |
|------|------|---------|
| **CodeCarbon** (1.8k⭐) | 计算碳排放追踪 | AI推理能耗度量、自身绿色计算 |
| **openLCA** | 专业LCA/碳足迹计算 | 工业园区碳排放监管、碳核算报告 |

### 5.3 环境数据基础设施

| 项目 | 能力 | 应用场景 |
|------|------|---------|
| **OpenAQ** (64⭐) | 全球20万+空气质量监测站 | 外部基准数据对比、异常检测校准 |
| **Ecolink Model** | 环境领域知识图谱本体 | 环境知识图谱Schema设计蓝图 |

---

## 六、与现有框架融合方案的对比检查

### 6.1 新发现 vs 融合方案映射

| 融合方案来源 | 对应层 | 本次新发现的补充 |
|-------------|--------|----------------|
| TAIJI-AGENT | L1+L2 | DSPy(推理)、Daytona(沙箱)、Pydantic AI(类型安全) |
| TAIJI-VERIFY | L5 | NeMo(前置拦截)、象信(中文)、LettuceDetect(幻觉)、Langfuse(观测) |
| OpenClaw | L1 | A2A Protocol(互操作)、MCP 2026路线图(协议演进) |
| Hermes-Agent | L4 | Mem0(长期记忆)、Graphiti(时序KG)、OpenMemory(多维记忆) |
| 腾讯Marvis(参考) | L2/L3/L5 | 实际发现开源替代方案更优（象信替代Marvis三模隐私理念） |

### 6.2 技术领先性评估

| 维度 | 之前定位 | 扫描后定位 | 变化 |
|------|---------|-----------|------|
| 记忆系统 | ⚠️ 较弱（仅Hermes） | ✅ **领先**（Mem0+Graphiti+GraphRAG+Hermes四层架构） | ⬆️ 大幅提升 |
| 安全治理 | ✅ 较强（TAIJI-VERIFY+GovMCP） | ✅✅ **行业领先**（8层纵深防御+中文政务护栏） | ⬆️ 显著提升 |
| 数据层 | ⚠️ 基础（PG+pgvector） | ✅ **领先**（PG+TimescaleDB+PostGIS+pgvector四合一） | ⬆️ 大幅提升 |
| 环境AI | ❌ 未覆盖 | ✅ **领域领先**（GeoAI+segment-geospatial+遥感分析栈） | 🆕 从零到有 |
| Agent协议 | ✅ MCP+ACP | ✅✅ **领先**（MCP+ACP+A2A+GovMCP四协议） | ⬆️ 协议扩展 |
| 碳排放 | ⚠️ 部分覆盖 | ✅ **完备**（CodeCarbon+openLCA+TimescaleDB时序） | ⬆️ 补全 |

---

## 七、行动路线图

### Phase 1（0-3月）: 数据地基 — 立即集成

| 任务 | 项目 | 优先级 | 工作量 |
|------|------|--------|-------|
| 部署TimescaleDB+PostGIS | PostgreSQL扩展 | P0 | 1周 |
| 集成Mem0 | 长期记忆层 | P0 | 2周 |
| 部署Langfuse | 审计追踪 | P0 | 1周 |
| 评估Graphiti | 时序知识图谱 | P0 | 1周（POC） |
| 本地部署vLLM | 推理基础设施 | P1 | 2周 |

### Phase 2（4-7月）: 模型集成与安全 — 纳入开发

| 任务 | 项目 | 优先级 | 工作量 |
|------|------|--------|-------|
| 集成NeMo Guardrails | L5输入防护 | P0 | 2周 |
| 集成象信AI安全护栏 | 中文合规 | P0 | 2周 |
| 集成DSPy | L2推理增强 | P1 | 2周 |
| 集成A2A Protocol | Agent互操作 | P1 | 2周 |
| 评估GraphRAG | KG自动构建 | P1 | 2周（POC） |
| 集成Daytona | Agent沙箱 | P1 | 1周 |

### Phase 3（8-10月）: 设备贯通与环境AI

| 任务 | 项目 | 优先级 | 工作量 |
|------|------|--------|-------|
| 集成Eclipse Ditto | 数字孪生框架 | P1 | 3周 |
| 集成GeoAI | 遥感AI分析 | P1 | 2周 |
| 部署open62541 | OPC UA接入 | P2 | 2周 |
| 集成LettuceDetect | 幻觉检测 | P0 | 1周 |
| 集成STORM | 自动报告生成 | P2 | 2周 |

### Phase 4（11-12月）: 自进化与交付

| 任务 | 项目 | 优先级 | 工作量 |
|------|------|--------|-------|
| MCP 2026路线图跟进 | GovMCP升级 | P1 | 持续 |
| 参与MCP Working Group | 行业影响力 | P2 | 持续 |
| 评估SGLang | 报告生成优化 | P2 | 1周（POC） |
| 完善碳核算模块 | openLCA集成 | P2 | 3周 |

---

## 八、风险提示

| 风险 | 描述 | 缓解措施 |
|------|------|---------|
| **PostGIS GPL-2.0** | 与PostgreSQL一起使用时无传染，但独立分发需注意 | 作为PG扩展使用，不独立分发 |
| **Eclipse Ditto EPL-2.0** | 商业使用条款需审查 | 评估后决定是否采用，备选自研 |
| **象信项目较新** | 2025年8月才开源，稳定性待验证 | POC验证后再集成，保留NeMo作为替代 |
| **Mem0 vs Hermes冲突** | 功能重叠可能导致架构复杂 | 明确分工：Hermes管短期，Mem0管长期 |
| **A2A Protocol尚未成熟** | 150+伙伴但协议仍在演进 | 先研究不急集成，待v1.0稳定后再集成 |
| **vLLM/SGLang运维成本** | 本地推理需要GPU资源 | 先评估实际需求，用SGLang(轻量)替代vLLM(重) |
| **GPL-3.0项目** | Helicone、部分PurpleLlama组件 | 已排除或标记为不推荐 |

---

## 九、持续追踪机制建议

为确保 EcoMind OS 始终保持技术领先性，建议建立以下机制：

1. **月度生态扫描**: 每月对 Top 20 项目进行版本/Star/活跃度检查
2. **季度深度评估**: 每季度对1-2个新方向（如新的Agent框架、安全工具）做深度扫描
3. **MCP/A2A Working Group跟踪**: 指定负责人跟踪协议演进，参与社区讨论
4. **GitHub Trending 监控**: 设置关键词监控（"eco monitoring AI", "digital twin agent", "RAG environment"等）
5. **论文追踪**: 持续关注顶会（AAAI/IJCAI/NeurIPS/KDD）中环境AI+Agent相关论文

---

## 附录A：完整项目清单（60+）

### A1 Agent编排层（15项）

| # | 项目 | Star | 协议 | 简述 |
|---|------|------|------|------|
| 1 | Mem0 | 56.6k | Apache-2.0 | 多级记忆+实体链接+多信号检索 |
| 2 | Daytona | 60k | Apache-2.0 | 90ms极速沙箱，状态持久化 |
| 3 | Mastra | 22k | Apache-2.0 | TypeScript原生Agent+Workflow |
| 4 | Pydantic AI | 17.1k | MIT | 编译时类型安全Agent |
| 5 | AG2 (AutoGen fork) | 4.6k | Apache-2.0 | 事件驱动多Agent+GroupChat |
| 6 | DSPy | 34.4k | MIT | 斯坦福编程式LLM框架 |
| 7 | OpenAI Agents SDK | 23k | MIT | Handoff范式+Sessions |
| 8 | Strands Agents (AWS) | 5.9k | Apache-2.0 | 极简三原语+4种协调模式 |
| 9 | E2B | 12.3k | Apache-2.0 | 云端代码执行沙箱 |
| 10 | A2A Protocol | 开放标准 | Linux Foundation | Agent互操作标准 |
| 11 | Google ADK | 10k+ | Apache-2.0(推测) | 多语言(Go/Java)Agent |
| 12 | MCP 2026路线图 | 开放标准 | — | 协议演进方向跟踪 |
| 13 | Agno (Phidata) | 39k | Apache-2.0 | 高性能Agent运行时 |
| 14 | Octomind | 512 | Apache-2.0 | Rust Agent运行时 |
| 15 | Bernstein | 新兴 | Apache-2.0 | 审计级多Agent编排 |

### A2 记忆/知识图谱层（15项）

| # | 项目 | Star | 协议 | 简述 |
|---|------|------|------|------|
| 1 | Mem0 | 56.6k | Apache-2.0 | （同上，跨层） |
| 2 | Letta (MemGPT) | 22.9k | Apache-2.0 | Agent自主记忆管理 |
| 3 | LangMem | 1.5k | MIT | LangChain记忆抽象层 |
| 4 | Zep | 4.6k | Apache-2.0 | 时序知识图谱+Graph RAG |
| 5 | OpenMemory | 4.1k | Apache-2.0 | 五维记忆模型+可解释召回 |
| 6 | LightMem | 857 | MIT | 轻量边缘记忆+MCP |
| 7 | GraphRAG | 33.2k | MIT | 微软KG自动构建+社区检测 |
| 8 | Graphiti | 26.5k | Apache-2.0 | 时序KG+Neo4j+增量构建 |
| 9 | Memary | 2.6k | MIT | Neo4j+LlamaIndex知识图谱 |
| 10 | Awesome-GraphMemory | 273 | 学术 | 图基Agent记忆调研参考 |
| 11 | STORM | 28.3k | MIT | 斯坦福自动知识策展+报告生成 |
| 12 | RAPTOR | 新兴 | MIT | 递归抽象树状RAG |
| 13 | RAG_Techniques | 27.5k | 待确认 | 42+种RAG技术实现 |
| 14 | ACON (Microsoft) | 78 | MIT | Agent上下文压缩蒸馏 |
| 15 | Ecolink Model | 学术开放 | — | 环境领域知识图谱本体 |

### A3 IoT/数字孪生/环境层（15项）

| # | 项目 | Star | 协议 | 简述 |
|---|------|------|------|------|
| 1 | EMQX | 16.3k | Apache-2.0 | MQTT Broker，6.0消息队列融合 |
| 2 | ThingsBoard | 21.1k | Apache-2.0 | IoT平台，规则引擎+仪表盘 |
| 3 | open62541 | 3.1k | MPL-2.0 | OPC UA协议栈 |
| 4 | Eclipse Ditto | 885 | EPL-2.0 | 数字孪生框架+设备影子 |
| 5 | OpenTwins | 259 | Apache-2.0 | DT开发平台（不成熟） |
| 6 | OpenAQ | 64 | MIT | 全球空气质量数据平台 |
| 7 | CodeCarbon | 1.8k | MIT | 计算碳排放追踪 |
| 8 | openLCA | — | MPL-2.0 | 生命周期评估/碳足迹 |
| 9 | GeoAI | 3.1k | MIT | 遥感AI分析+SAM集成 |
| 10 | segment-geospatial | 4k | MIT | SAM地理空间分割 |
| 11 | scikit-eo | 249 | MIT | 遥感数据预处理 |
| 12 | TimescaleDB | 22.7k | Apache-2.0 | PostgreSQL时序扩展 |
| 13 | Apache Flink | 26k | Apache-2.0 | 分布式流处理 |
| 14 | PostGIS | 2.1k | GPL-2.0 | PostgreSQL空间扩展 |
| 15 | MapLibre GL JS | 10.7k | BSD-3-Clause | 开源WebGL矢量地图 |

### A4 LLM安全/观测层（16项）

| # | 项目 | Star | 协议 | 简述 |
|---|------|------|------|------|
| 1 | LiteLLM | 48.1k | MIT | 统一LLM网关，100+ Provider |
| 2 | Portkey Gateway | 11.8k | MIT | 轻量TS网关+1600+模型 |
| 3 | Helicone | 591 | Apache/GPL | Go极轻量网关（GPL注意） |
| 4 | Langfuse | 27.8k | MIT | LLM可观测平台+审计 |
| 5 | Arize Phoenix | 9.8k | ELv2 | OpenTelemetry原生观测 |
| 6 | NeMo Guardrails | 6.2k | Apache-2.0 | 5层安全管道+Colang DSL |
| 7 | Guardrails AI | 6.9k | Apache-2.0 | Pydantic结构化验证 |
| 8 | LlamaFirewall (PurpleLlama) | 4.2k | MIT/CLL | Meta Prompt注入检测 |
| 9 | 象信AI安全护栏 | 新兴 | Apache-2.0 | 中文政务合规护栏 |
| 10 | vLLM | 80.9k | Apache-2.0 | 高吞吐LLM推理引擎 |
| 11 | SGLang | 28.2k | Apache-2.0 | Agent场景优化+结构化输出 |
| 12 | DeepEval | 15.7k | Apache-2.0 | 50+评估指标+CI/CD |
| 13 | Ragas | 14k | Apache-2.0 | RAG忠实度评估 |
| 14 | promptfoo | 5.5k | MIT | 红队测试+安全评估 |
| 15 | TruLens | 3.3k | MIT | 实验评估+反馈函数 |
| 16 | LettuceDetect | 576 | MIT | Token级RAG幻觉检测+中文 |

---

## 附录B：协议风险矩阵

| 协议 | 风险等级 | 代表项目 | 建议 |
|------|---------|---------|------|
| MIT | ✅ 无风险 | GraphRAG, Langfuse, Pydantic AI, DSPy... | 直接集成 |
| Apache-2.0 | ✅ 无风险 | Mem0, NeMo, vLLM, SGLang, Langfuse... | 直接集成 |
| BSD-3-Clause | ✅ 无风险 | MapLibre GL JS | 直接集成 |
| MPL-2.0 | ⚠️ 文件级 | open62541, openLCA | 文件级传染，隔离使用 |
| EPL-2.0 | ⚠️ 需审查 | Eclipse Ditto | 评估商业使用条款 |
| GPL-2.0 | ⚠️ 需隔离 | PostGIS | 作为PG扩展使用，不独立分发 |
| ELv2 | ❌ 分发限制 | Arize Phoenix | 不推荐，用Langfuse替代 |
| GPL-3.0 | ❌ 不推荐 | Helicone | 已排除 |
| Llama CL | ⚠️ 需审查 | PurpleLlama模型 | 仅使用MIT工具部分 |

---

*本报告为 EcoMind OS 开源生态追踪的首次系统扫描（v1.0），建议按月更新。*
