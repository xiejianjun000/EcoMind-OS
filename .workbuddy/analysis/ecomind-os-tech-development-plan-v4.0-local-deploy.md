# EcoMind OS 技术开发方案 v4.0 — 本地部署 + 国产模型 + 文件知识预加载

> **版本**: v4.0（基于用户四项关键决策更新）
> **日期**: 2026-05-25
> **状态**: 评估完成 · 待启动编码
> **编制**: 齐活林（Qi）· 交付总监
> **变更**: v3.0 → v4.0 四项重大决策更新

---

## 目录

1. [v3.0 → v4.0 变更摘要](#1-v30--v40-变更摘要)
2. [四项关键决策详解](#2-四项关键决策详解)
3. [新增决策 D13-D16](#3-新增决策-d13-d16)
4. [文件知识预加载架构（新增核心特性）](#4-文件知识预加载架构新增核心特性)
5. [国产大模型兼容层](#5-国产大模型兼容层)
6. [本地部署架构](#6-本地部署架构)
7. [更新后 Phase 1 实施计划](#7-更新后-phase-1-实施计划)
8. [风险评估与缓解](#8-风险评估与缓解)

---

## 1. v3.0 → v4.0 变更摘要

| # | 变更项 | v3.0 方案 | v4.0 方案 | 影响级别 |
|---|--------|----------|----------|---------|
| 1 | TAIJI-AGENT/GOVMCP 来源 | Fork 上游仓库 | **自有 Git 仓库，自主掌控** | 🟢 降低风险 |
| 2 | 模型兼容 | LiteLLM + 国产模型基础适配 | **兼容全部国产大模型 + 本地模型训练** | 🔴 显著增加复杂度 |
| 3 | 部署方式 | 未明确 | **纯本地部署（政务内网/私有化）** | 🟡 增加等保/国密优先级 |
| 4 | 智能体初始状态 | Agent definition + Skills + References | **+ 桌面生态环境文件全量学习预加载** | 🔴 新增核心特性 |

**v4.0 不改变的内容**：
- v3.0 的五层架构、D1-D12 决策、Phase 路线图
- Agent 三层渐进披露架构
- 工具权限矩阵和推理双模式
- v2.0 Final 的全部技术决策

**v4.0 新增/修改的内容**：
- D13: 自有仓库策略（非 Fork）
- D14: 全量国产模型兼容 + 本地训练
- D15: 纯本地部署架构
- D16: 文件知识预加载机制

---

## 2. 四项关键决策详解

### 2.1 决策一：自有 Git 仓库

**原评估**：TAIJI-AGENT 需从 `xiejianjun000/taiji-agent` Fork
**实际**：taiji-agent 和 GOVMCP 是自有 Git 仓库，拥有完全控制权

**影响分析**：

| 维度 | Fork 策略 | 自有仓库策略 |
|------|----------|-------------|
| 上游同步 | 需定期 merge 上游变更 | 无需同步，完全自主 |
| 破坏性变更风险 | 上游 API 变更可能导致冲突 | 无此风险 |
| 贡献回流 | 需考虑 PR 回流 | 不适用 |
| GOVMCP 融合 | 需桥接适配 | **已内嵌于 `src/taiji_agent/govmcp/`，三层集成完成** |
| TAIJI-VERIFY | pip 依赖 | pip 依赖不变 |
| 维护成本 | 中等（需跟踪上游） | **偏高（全部自维护）** |

**关键结论**：自有仓库消除了 Fork 同步风险，但意味着所有 Bug 修复和功能迭代必须自主完成。建议保留对 `xiejianjun000/taiji-agent` 的关注，选择性 cherry-pick 上游有价值提交。

### 2.2 决策二：兼容国产全部大模型 + 本地训练

**目标模型清单**：

| 模型 | 提供商 | 参数规模 | 本地部署 | API 兼容 | 微调支持 |
|------|--------|---------|---------|---------|---------|
| Qwen 2.5/3 | 阿里通义 | 0.5B-72B | ✅ vLLM/SGLang | OpenAI-compatible | ✅ LoRA/QLoRA |
| GLM-4 | 智谱AI | 9B/130B | ✅ vLLM | OpenAI-compatible | ✅ P-Tuning v2 |
| DeepSeek-V3/R1 | 深度求索 | 7B/67B/671B | ✅ vLLM/SGLang | OpenAI-compatible | ✅ LoRA |
| Yi-1.5 | 零一万物 | 6B/34B | ✅ vLLM | OpenAI-compatible | ✅ LoRA |
| ChatGLM3/4 | 智谱AI | 6B | ✅ 本地 | 自有API | ✅ P-Tuning v2 |
| Baichuan2 | 百川智能 | 7B/13B/53B | ✅ vLLM | OpenAI-compatible | ✅ LoRA |
| MiniCPM | 面壁智能 | 2B/4B | ✅ vLLM | OpenAI-compatible | ✅ LoRA |
| InternLM2 | 上海AI Lab | 7B/20B | ✅ vLLM | OpenAI-compatible | ✅ LoRA |
| Aquila | 浪潮信息 | 7B/33B | ✅ vLLM | OpenAI-compatible | ✅ LoRA |
| Skywork | 昆仑万维 | 13B | ✅ vLLM | OpenAI-compatible | ✅ LoRA |

**本地训练架构**：

```
生态环境领域语料库
    ↓ 分词器扩展（环保专业术语词表）
    ↓ 指令数据构造（法规问答/执法推理/审批决策/监测分析）
    ↓ LoRA/QLoRA/P-Tuning v2 微调
    ↓ 模型合并（LoRA权重合并到基座模型）
    ↓ TAIJI-VERIFY 六层验证（防幻觉+合规检查）
    ↓ vLLM/SGLang 部署（OpenAI-compatible API）
    ↓ LiteLLM 统一路由
```

**关键设计决策**：
1. **LiteLLM 保持不变** — 作为统一接口层，所有国产模型通过 OpenAI-compatible API 接入
2. **新增 EcomodelAdapter** — 针对非 OpenAI-compatible 的模型（如早期 ChatGLM），编写适配器统一到 LiteLLM
3. **训练管道独立** — 训练和推理解耦，训练输出标准 HuggingFace 格式，推理引擎自动加载
4. **模型热切换** — 通过配置文件切换模型，无需重启服务，支持 A/B 测试

### 2.3 决策三：纯本地部署

**部署拓扑**：

```
┌─────────────────────────────────────────────────────────────┐
│                    政务内网 / 私有云                          │
│                                                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐ │
│  │ 前端     │  │ API 网关 │  │ Agent    │  │ 数据层       │ │
│  │ React +  │  │ OpenClaw │  │ 编排集群 │  │ PostgreSQL   │ │
│  │ Cesium   │  │ Gateway  │  │ LangGraph│  │ + pgvector   │ │
│  │          │  │          │  │ + CrewAI │  │ + Neo4j      │ │
│  └──────────┘  └──────────┘  └──────────┘  │ + Redis      │ │
│                                            │ + TimescaleDB│ │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  └──────────────┘ │
│  │ LLM 推理 │  │ 国密服务 │  │ 物联接入 │  ┌──────────────┐ │
│  │ vLLM /   │  │ GOVMCP  │  │ EMQX    │  │ 消息队列     │ │
│  │ SGLang   │  │ SM2/3/4 │  │ MQTT    │  │ RabbitMQ/    │ │
│  │ (GPU)    │  │ 审批流   │  │ OPC UA  │  │ NATS         │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────┘ │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ 安全层: TAIJI-VERIFY 六层验证 + 等保二级/三级            │  │
│  └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**本地部署硬需求**：
- **GPU 最低配置**：1× A100 80GB（推理）+ 1× A100 40GB（微调）
- **推荐配置**：2× A100 80GB（推理热备）+ 1× A6000（微调）
- **CPU 推理备选**：Qwen2.5-7B-Q4 量化模型，Intel Xeon + 64GB RAM
- **存储**：500GB NVMe（模型权重 + 向量索引）
- **网络**：完全内网隔离，无外网依赖

### 2.4 决策四：文件知识预加载

**核心需求**：每个智能体在启动时，必须"学习"桌面 EcoMind OS 项目的所有文件内容，作为其初始知识状态。

**当前文件资产盘点**：

| 目录 | 文件数 | 内容 | 用途 |
|------|--------|------|------|
| `.workbuddy/analysis/` | 21 个 MD | 全部分析报告、技术方案 | **全量预加载** |
| `.workbuddy/memory/` | 3 个 MD | 项目记忆、日志 | **全量预加载** |
| `agent-prompts-collection/` | ~1400 文件 | 四大 Agent 提示词参考 | **选择性预加载** |
| `docs/` | 待确认 | 项目文档 | **全量预加载** |

**文件知识预加载架构**（三层加载策略）：

```
Layer 1: 核心索引（启动时必加载，< 500KB）
├── MEMORY.md                          # 项目约定总索引
├── .workbuddy/analysis/目录摘要       # 每个分析文件的 200 字摘要
└── agent-prompts-collection/分类索引  # 四大项目的 Agent 分类清单

Layer 2: 领域知识（按 Agent 类型按需加载，< 5MB）
├── ecomind-os-tech-development-plan-v3.0-agent-patterns.md  # 当前方案
├── ecomind-os-full-fusion-plan.md                           # 融合方案
├── frameworks-github-deep-analysis.md                        # 框架分析
├── taiji-govmcp-verify-fusion-analysis.md                   # TAIJI融合
└── [按 Agent 角色匹配的分析文件]

Layer 3: 深度知识（RAG 检索，完整文本）
├── 全部分析报告原文
├── agent-prompts-collection/ 中的参考提示词
└── docs/ 全部文档
```

**每个 Agent 的预加载映射**：

| Agent | Layer 1 | Layer 2 重点 | Layer 3 RAG 范围 |
|-------|---------|-------------|-----------------|
| 执法监察 | ✅ 全量 | 融合方案 + 框架分析 + TAIJI融合 | 法规库 + 案例库 + 分析报告 |
| 环境监测 | ✅ 全量 | 开源生态扫描 + 框架分析 | 指标体系 + 标准库 + 模型参数 |
| 政务审批 | ✅ 全量 | 技术方案 v3.0 + TAIJI融合 + 合规路线图 | 法规模板 + 审批流程 + 等保要求 |
| 公众服务 | ✅ 全量 | 商业模式画布 + 竞品分析 + 用户访谈 | FAQ + 公开数据 + 政策解读 |

**技术实现路径**：

1. **启动时**：读取 `MEMORY.md` + `analysis/` 目录摘要 → 构建全局知识索引
2. **Agent 初始化**：根据 Agent 类型加载 Layer 2 对应文件 → 注入 system prompt
3. **运行时**：LlamaIndex + GraphRAG 向量检索 Layer 3 → 按需补充上下文
4. **文件变更监听**：watchdog 监控文件变更 → 增量更新向量索引

---

## 3. 新增决策 D13-D16

| # | 决策 | 选择 | 依据 |
|---|------|------|------|
| **D13** | TAIJI-AGENT/GOVMCP 仓库策略 | **自有 Git 仓库，自主掌控** | 用户确认是自有项目，非 Fork 上游；消除上游同步风险，但全部维护责任自担 |
| **D14** | 模型兼容策略 | **全量国产大模型 + 本地微调训练** | 政务本地部署硬需求；需覆盖 Qwen/GLM/DeepSeek/Yi/ChatGLM/Baichuan/MiniCPM/InternLM/Aquila/Skywork；通过 LiteLLM + EcomodelAdapter 统一路由 |
| **D15** | 部署架构 | **纯本地部署（政务内网/私有化）** | 政务数据安全要求；无外网依赖；等保二级起步/三级目标；GPU 推理+vLLM/SGLang |
| **D16** | 智能体初始知识 | **桌面生态环境文件全量学习预加载** | 每个 Agent 启动时必须掌握项目全部文件；三层加载策略（核心索引+领域知识+RAG检索）；watchdog 增量更新 |

---

## 4. 文件知识预加载架构（新增核心特性）

### 4.1 设计理念

传统 Agent 的初始状态来自硬编码的 system prompt。EcoMind OS 的创新点在于：**Agent 的初始状态来自对项目文件的实时学习**——这意味着：

- Agent 不需要"记住"静态知识，而是动态读取项目文件
- 当项目文件更新时，Agent 的知识自动更新（无需重新训练）
- 不同 Agent 类型自动裁剪知识范围（执法 Agent 不需要加载商业模式画布）

### 4.2 文件知识图谱

```
EcoMind OS 桌面文件系统
├── 核心知识（全量注入 system prompt）
│   ├── MEMORY.md                    → 全局项目约定
│   ├── ecomind-os-tech-development-plan-v3.0.md → 当前技术方案
│   └── 全框架融合方案.md              → 融合决策
│
├── 分析知识（按需注入 + RAG）
│   ├── 框架深度分析                  → Agent 通信/架构参考
│   ├── Marvis 深度分析              → 端侧设计参考
│   ├── TAIJI 融合分析               → 主框架集成参考
│   └── [21个分析文件]               → 按主题向量索引
│
├── 提示词知识（RAG 检索）
│   ├── bjlida-AI-IDE-Agent/         → IDE Agent 参考提示词
│   ├── CreatorEdition-system-prompts/→ 主流 AI 产品提示词
│   ├── VoltAgent-awesome-agent-skills/→ Agent 技能参考
│   └── wshobson-agents/             → 三层渐进披露参考
│
└── 动态知识（watchdog 监听）
    └── 任何新增/修改文件 → 自动索引 → 向量更新
```

### 4.3 实现方案

```python
# 概念实现：文件知识预加载器
class EcoMindFileKnowledgePreloader:
    """智能体文件知识预加载器"""
    
    LAYER_1_GLOB = ["MEMORY.md", "analysis/*.md"]  # 核心索引
    LAYER_2_MAP = {
        "enforcement-agent": ["fusion-plan.md", "frameworks-*.md", "taiji-*.md"],
        "monitoring-agent":  ["opensource-scan*.md", "frameworks-*.md"],
        "approval-agent":    ["tech-development-plan*.md", "taiji-*.md", "compliance-*.md"],
        "public-agent":      ["business-model*.md", "competitive-*.md", "user-interview*.md"],
    }
    
    def preload(self, agent_type: str) -> dict:
        layer1 = self._load_layer1()            # 全量核心索引
        layer2 = self._load_layer2(agent_type)  # 按Agent类型裁剪
        rag_index = self._init_rag_index()      # LlamaIndex + pgvector
        return {
            "system_prompt_extension": layer1 + layer2,
            "rag_retriever": rag_index,
            "file_watcher": self._start_watchdog(),
        }
```

---

## 5. 国产大模型兼容层

### 5.1 LiteLLM + EcomodelAdapter 架构

```
Agent 请求 → LiteLLM 统一接口
    ↓
EcomodelAdapter（格式适配 + 降级策略）
    ↓
┌─ OpenAI-compatible 模型（Qwen/GLM/DeepSeek/Yi/Baichuan/MiniCPM/InternLM/Aquila/Skywork）
│   → 直接走 vLLM/SGLang OpenAI-compatible API
│
└─ 非 OpenAI-compatible 模型（早期 ChatGLM/自定义部署）
    → EcomodelAdapter 封装为 OpenAI 格式
```

### 5.2 模型路由策略更新

v3.0 的 opus/sonnet/haiku 三级路由需要适配国产模型：

| v3.0 级别 | 对应国产模型 | 适用场景 |
|-----------|------------|---------|
| opus（最强推理） | DeepSeek-V3/R1-671B, Qwen3-72B | 执法/审批的复杂推理 |
| sonnet（平衡） | Qwen3-14B, GLM-4-9B, DeepSeek-V3-7B | 监测/公众的中等推理 |
| haiku（快速） | Qwen3-4B, MiniCPM-4B, Yi-1.5-6B | 简单查询/直通执行 |

### 5.3 本地微调训练管道

```
Step 1: 语料收集
    → 桌面生态环境文件（28MB, 1445文件）
    → 环保法规/标准/案例（外部采集）
    → 监测数据/审批记录（脱敏后）

Step 2: 指令数据构造
    → 法规问答对（5000+条）
    → 执法推理链（2000+条）
    → 审批决策记录（1000+条）
    → 监测异常分析（3000+条）

Step 3: 微调训练
    → LoRA/QLoRA（r=16, α=32）在 Qwen3-14B 上
    → P-Tuning v2 在 GLM-4-9B 上
    → 训练框架: LLaMA-Factory / Swift

Step 4: 验证部署
    → TAIJI-VERIFY 六层验证
    → 基准测试（执法准确率/审批合规率/监测漏报率）
    → vLLM/SGLang 部署
```

---

## 6. 本地部署架构

### 6.1 硬件配置方案

| 配置级别 | GPU | CPU | RAM | 存储 | 适用规模 |
|---------|-----|-----|-----|------|---------|
| 最低 | 1× A100 80GB | 32核 | 128GB | 500GB NVMe | 1-2 Agent, 7B-14B 模型 |
| 推荐 | 2× A100 80GB | 64核 | 256GB | 1TB NVMe | 4 Agent, 14B-72B 模型 |
| 生产 | 4× A100 80GB | 96核 | 512GB | 2TB NVMe | 全量部署 + 微调 |

### 6.2 安全合规

| 等级 | 要求 | 当前覆盖 | 差距 |
|------|------|---------|------|
| 等保二级 | 基础安全 + 审计 + 访问控制 | GOVMCP 审计 + SM2/3/4 | 补全日志审计 + 入侵检测 |
| 等保三级 | 二级 + 强身份认证 + 数据加密 | SM4 数据加密已有 | 补全双因子认证 + 安全域划分 |

---

## 7. 更新后 Phase 1 实施计划

### Phase 1A：基础验证（2 周）

| # | 任务 | 内容 | 验收标准 |
|---|------|------|---------|
| T1 | TAIJI-AGENT 本地启动 | 克隆自有仓库，本地启动 Agent Loop | 单 Agent 能接收请求→推理→返回 |
| T2 | GOVMCP 验证 | 确认内嵌 GOVMCP 三层集成可用 | SM2 签名/验签 + 审批流跑通 |
| T3 | vLLM/SGLang 部署 | 部署 Qwen3-14B 到本地 GPU | OpenAI-compatible API 可用 |
| T4 | LiteLLM 适配 | 配置 LiteLLM 接 vLLM | Agent 能通过 LiteLLM 调用本地模型 |

### Phase 1B：文件知识预加载（2 周）

| # | 任务 | 内容 | 验收标准 |
|---|------|------|---------|
| T5 | 文件索引引擎 | LlamaIndex 扫描桌面文件 → 向量化 | 全部 1445 文件完成索引 |
| T6 | 三层加载实现 | Layer 1/2/3 分级加载逻辑 | Agent 启动时自动加载对应层级知识 |
| T7 | RAG 检索集成 | pgvector + 语义检索 | Agent 能检索到相关文件内容 |
| T8 | 文件变更监听 | watchdog + 增量更新 | 文件修改后向量索引自动更新 |

### Phase 1C：单 Agent Demo（2 周）

| # | 任务 | 内容 | 验收标准 |
|---|------|------|---------|
| T9 | 环境监测 Agent | 第一个可运行的 Agent | 用户问"今天PM2.5为什么飙升"→ Agent 返回根因分析 |
| T10 | MCP 工具接入 | 最少3个工具（法规查询/数据查询/报告生成） | Agent 能调用 MCP 工具 |
| T11 | OpenClaw Gateway | 路由分发层 | 用户消息→Gateway→Agent→响应 |

### Phase 1D：国产模型适配（2 周）

| # | 任务 | 内容 | 验收标准 |
|---|------|------|---------|
| T12 | EcomodelAdapter | 非 OpenAI-compatible 模型适配 | ChatGLM 能通过适配器接入 |
| T13 | 模型路由策略 | opus→DeepSeek-671B, sonnet→Qwen3-14B, haiku→Qwen3-4B | 按请求复杂度自动选模型 |
| T14 | LoRA 微调 POC | Qwen3-14B + 环保领域指令 | 微调后执法问答准确率提升 10%+ |

### Phase 1E：本地部署验证（1 周）

| # | 任务 | 内容 | 验收标准 |
|---|------|------|---------|
| T15 | Docker Compose 编排 | 全栈本地部署 | `docker-compose up` 一键启动 |
| T16 | 等保二级自评估 | 安全合规检查 | 通过等保二级差距分析 |
| T17 | 端到端 Demo | 完整闭环演示 | 从用户请求到 Agent 响应全链路跑通 |

**Phase 1 总工期：9 周（含 2 周缓冲）**

---

## 8. 风险评估与缓解

| # | 风险 | 概率 | 影响 | 缓解措施 |
|---|------|------|------|---------|
| R1 | 10+ 国产模型适配工作量巨大 | 高 | 高 | 优先适配 Qwen3 + DeepSeek + GLM 三家；其余走 vLLM OpenAI-compatible 自动覆盖 |
| R2 | 文件预加载 28MB 可能超出 context window | 高 | 中 | 严格三层加载，Layer 1 < 500KB，Layer 2 < 5MB，Layer 3 RAG 检索 |
| R3 | 本地 GPU 资源不足 | 中 | 高 | 准备 CPU 推理方案（Qwen3-7B-Q4 量化） |
| R4 | 自有仓库无社区支持，Bug 修复慢 | 中 | 中 | 建立与 xiejianjun000 的技术交流渠道；关注上游 cherry-pick |
| R5 | LoRA 微调效果不达标 | 中 | 低 | 先用 RAG + 大 prompt 补偿，微调是锦上添花 |
| R6 | 等保三级认证周期长 | 低 | 高 | Phase 1 先做等保二级，Phase 2 再升三级 |

---

## 附录：v4.0 完整决策矩阵

| 决策 | 版本 | 选择 | 状态 |
|------|------|------|------|
| D1 后端核心 | v1.0 | TAIJI-AGENT (fork) | **→ 更新为自有仓库** |
| D2 验证引擎 | v1.0 | TAIJI-VERIFY (pip) | 不变 |
| D3 记忆系统 | v1.0 | Hermes MemoryProvider | 不变 |
| D4 路由编排 | v1.0 | OpenClaw Gateway + ACP | 不变 |
| D5 OpenHuman | v1.0 | 仅参考设计 | 不变 |
| D6 记忆升级 | v2.0 | Mem0+Graphiti+GraphRAG | 不变 |
| D7 L5八层防御 | v2.0 | 象信+NeMo+LettuceDetect+Langfuse | 不变 |
| D8 数据三合一 | v2.0 | TimescaleDB+PostGIS | 不变 |
| D9 协议矩阵 | v2.0 | MCP+ACP+A2A | 不变 |
| D10 本地推理 | v2.0 | SGLang+vLLM | 不变（强化） |
| D11 Agent团队 | v2.0 | LangGraph+CrewAI | 不变 |
| D12 提示词工程 | v3.0 | wshobson三层+CreatorEdition双模式 | 不变 |
| **D13 仓库策略** | **v4.0** | **自有 Git 仓库** | **新增** |
| **D14 模型兼容** | **v4.0** | **全量国产模型+本地微调** | **新增** |
| **D15 部署架构** | **v4.0** | **纯本地部署** | **新增** |
| **D16 文件预加载** | **v4.0** | **三层渐进加载+RAG+watchdog** | **新增** |
