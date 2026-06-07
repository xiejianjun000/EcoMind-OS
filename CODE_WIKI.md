# EcoMind OS Code Wiki

> **版本**: v2.1.0 | **许可证**: Apache-2.0 | **最后更新**: 2026-06-07

---

## 📖 目录

- [1. 项目概述](#1-项目概述)
- [2. 技术架构](#2-技术架构)
- [3. 项目结构详解](#3-项目结构详解)
- [4. 后端核心模块](#4-后端核心模块)
- [5. 前端架构](#5-前端架构)
- [6. 关键类与函数说明](#6-关键类与函数说明)
- [7. 依赖关系分析](#7-依赖关系分析)
- [8. 运行方式](#8-运行方式)
- [9. 数据流与交互流程](#9-数据流与交互流程)
- [10. 开发指南](#10-开发指南)

---

## 1. 项目概述

### 1.1 项目简介

**EcoMind OS** 是一个**生态环境垂直领域 AI Agent 管理平台**，定位为"会思考的生态大脑"（A Thinking Ecological Brain）。该项目是一个独立完整的系统，**不依赖任何外部 Agent 框架**（如 LangChain、CrewAI、TAIJI-AGENT 等），所有核心引擎均为自研实现。

### 1.2 核心特性

| 特性 | 描述 |
|------|------|
| **多模态 Agent 管理** | 支持 4 类角色（enforcement/monitoring/approval/public），L1-L5 五级权限体系 |
| **自建 Agent 引擎** | `EcoAgentEngine` — 纯 Python 对话循环 + 工具执行 + 流式输出 |
| **工具注册系统** | `EcoToolRegistry` — 动态注册、按角色过滤、支持 OpenAI/MCP Schema 导出 |
| **输出验证层** | `EcoVerifier` — 空/过短响应检测、不确定性标记检测、合规敏感词告警 |
| **本地记忆系统** | `EcoMemory` — SQLite 三层记忆（会话/长期/工作） |
| **工作流编排** | 自建有向图状态机，支持节点/边定义 + 条件分支 |
| **ECC 技能系统** | 兼容 ECC (193K⭐) 格式，6 大内置生态技能 + Instincts 直觉规则 |
| **部门智能体** | 湖南省生态环境厅 19 个部门专属智能体自动初始化 |
| **3D 可视化** | Cesium + Deck.gl 实现湖南省地形 3D 场景 + 监测数据叠加 |
| **模型路由** | LiteLLM Proxy 支持 15+ 国产模型（Qwen/DeepSeek/GLM/Yi 等） |

### 1.3 设计理念

```
核心理念: "会思考的生态大脑"

┌─────────────────────────────────────────────────────┐
│                  EcoMind OS                         │
│                                                     │
│  🌿 生态智能    → 面向环保、政务、企业碳排放场景     │
│  🧠 自建引擎    → 零外部框架依赖，安装即用           │
│  🛡️ 安全验证    → 输出验证 + 安全事件管理            │
│  💾 本地记忆    → SQLite 持久化三层记忆             │
│  🔄 工作流编排  → 有向图状态机                      │
└─────────────────────────────────────────────────────┘
```

---

## 2. 技术架构

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                          用户界面层                                  │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  React 18 + TypeScript + Ant Design + Cesium + ECharts        │  │
│  │  (20+ 页面 / 4 类角色 / i18n 双语 / 亮暗主题)                 │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
              REST API         WebSocket      Socket.IO
                    │               │               │
                    ▼               ▼               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        后端服务层 (FastAPI)                          │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │AgentSvc  │  │Workflow  │  │Security  │  │  Department Svc  │   │
│  │          │  │  Service │  │  Service │  │  (19 部门智能体)  │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┬─────────┘   │
│       │             │             │                   │             │
│       ▼             ▼             ▼                   ▼             │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                     EcoMind 自建引擎层                       │   │
│  │                                                             │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │   │
│  │  │EcoAgentEngine│  │EcoToolRegist │  │   EcoVerifier    │  │   │
│  │  │(对话循环)    │  │ry (工具注册) │  │  (输出验证)      │  │   │
│  │  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │   │
│  │         │                 │                    │            │   │
│  │         ▼                 ▼                    ▼            │   │
│  │  ┌──────────────────────────────────────────────────────┐  │   │
│  │  │                  EcoMemory (SQLite)                  │  │   │
│  │  │         会话记忆 / 长期记忆 / 工作记忆                │  │   │
│  │  └──────────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │ECC Skills│  │ GOVMCP   │  │Knowledge │  │  Safety Chain    │   │
│  │(技能系统)│  │ (政务加密)│  │  Graph   │  │  (六层安全)      │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │      LiteLLM Proxy            │
                    │  (模型路由: Qwen/DeepSeek/     │
                    │   GLM/Yi/vLLM/SGLang)         │
                    └───────────────────────────────┘
```

### 2.2 分层设计原则

| 层级 | 职责 | 技术 |
|------|------|------|
| **表现层** | 用户界面、交互逻辑 | React + Ant Design + Cesium |
| **API 层** | 路由定义、请求验证、响应格式化 | FastAPI + Pydantic |
| **服务层** | 业务逻辑、状态管理、Agent 生命周期 | Python asyncio |
| **引擎层** | Agent 循环、工具执行、输出验证 | 自建 (零依赖) |
| **数据层** | 记忆持久化、会话历史 | SQLite |
| **基础设施层** | 模型路由、消息队列、加密 | LiteLLM / NATS / SM2-4 |

---

## 3. 项目结构详解

### 3.1 顶层目录结构

```
EcoMind-OS/
│
├── backend/                      # 🔵 FastAPI 后端 (Python 3.11+)
│   ├── api/                      # API 层
│   │   ├── main.py              # ✅ FastAPI 应用入口
│   │   ├── routers/             # 15 个路由模块
│   │   ├── services/            # 11 个业务服务
│   │   ├── schemas/             # Pydantic 数据模型
│   │   └── websocket/           # WebSocket 管理器
│   │
│   ├── engine/                  # ⭐ 自建 Agent 引擎 (核心)
│   │   ├── loop.py              # EcoAgentEngine 对话循环
│   │   ├── tool_registry.py     # EcoToolRegistry 工具注册表
│   │   ├── verify.py            # EcoVerifier 输出验证器
│   │   └── memory.py            # EcoMemory SQLite 记忆系统
│   │
│   ├── skills/                  # 🆕 ECC 技能系统
│   │   ├── ecc_bridge.py        # ECC 技能加载器 + Instincts 引擎
│   │   └── ecc/hunan-agents/    # 19 个湖南部门智能体工作区
│   │
│   ├── memory/                  # Claude-Mem 风格记忆桥接
│   ├── safety/                  # 安全技能层 (754 条规则)
│   ├── graph/                   # 知识图谱适配器
│   ├── govmcp/                  # 政务 MCP (SM2/SM3/SM4 加密)
│   ├── inference/               # 推理引擎配置 (vLLM/SGLang)
│   ├── litellm-proxy/           # LiteLLM 代理配置
│   ├── nats/                    # NATS 消息队列客户端
│   └── tests/                   # 测试套件
│       ├── unit/                # 单元测试
│       ├── integration/         # 集成测试
│       ├── contract/            # 契约测试
│       ├── security/            # 安全测试
│       └── chaos/               # 混沌测试
│
├── frontend/                     # 🟢 React 前端 (TypeScript)
│   └── src/
│       ├── App.tsx              # 应用根组件
│       ├── main.tsx             # 入口文件
│       ├── router/              # 路由配置 (25+ 页面)
│       ├── pages/               # 20+ 功能页面
│       ├── components/          # 可复用组件库
│       ├── store/               # Zustand 状态管理
│       ├── services/            # API 服务层
│       ├── hooks/               # 自定义 Hooks
│       ├── layouts/             # 布局组件
│       ├── providers/           # Context Providers
│       ├── locales/             # 国际化 (中/英)
│       ├── theme/               # 主题配置
│       └── types/               # TypeScript 类型定义
│
├── VI/                          # 🎨 品牌视觉识别系统
├── docs/                        # 📚 文档
├── spec/                        # 📋 规格说明
├── openspec/                    # 🔄 变更规格管理
├── deploy/                      # 🐳 Docker 部署配置
├── agent-prompts-collection/    # 🤖 Agent Prompt 收集
└── data/                        # 💾 运行时数据 (SQLite DB)
```

### 3.2 后端目录详细说明

#### `/backend/api` — API 层

| 文件/目录 | 职责 | 关键内容 |
|-----------|------|----------|
| `main.py` | FastAPI 应用入口 | CORS 配置、路由注册、生命周期管理、WebSocket 端点 |
| `routers/` | API 路由定义 | 15 个路由模块，涵盖 Agent/Workflow/Security/业务等 |
| `services/` | 业务逻辑层 | 11 个服务类，封装核心引擎调用 |
| `schemas/` | 数据模型 | Pydantic 模型用于请求/响应验证 |
| `websocket/` | WebSocket 管理 | 连接管理、广播、进度推送 |

#### `/backend/engine` — 自建引擎层 (⭐ 核心)

| 文件 | 类名 | 职责 | 代码行数 |
|------|------|------|----------|
| `loop.py` | `EcoAgentEngine` | Agent 对话循环引擎 | ~507 行 |
| `tool_registry.py` | `EcoToolRegistry` | 工具注册与执行 | ~200 行 |
| `verify.py` | `EcoVerifier` | 输出质量验证 | ~172 行 |
| `memory.py` | `EcoMemory` | SQLite 三层记忆系统 | ~290 行 |

#### `/backend/skills` — ECC 技能系统

| 文件/目录 | 职责 |
|-----------|------|
| `ecc_bridge.py` | ECC 技能加载器、Instincts 引擎、19 个部门智能体路由 (~507 行) |
| `ecc/hunan-agents/` | 湖南省生态环境厅 19 个部门智能体工作区文件 |
| `ecc/hunan-agents/workspaces/` | 各部门的 SOUL.md/AGENTS.md/TOOLS.md 等工作区文件 |

#### 其他后端模块

| 目录 | 职责 |
|------|------|
| `/backend/govmcp/` | 政务 MCP 协议实现 (SM2/SM3/SM4 国密加密) |
| `/backend/graph/` | 知识图谱适配器 (法规→条款→案例关联) |
| `/backend/safety/` | 安全技能层 (754 条 MITRE ATT&CK 规则) |
| `/backend/memory/` | Claude-Mem 风格跨会话持久化记忆 |
| `/backend/inference/` | 推理引擎配置 (vLLM/SGLang/Ollama) |
| `/backend/nats/` | NATS 消息队列客户端 |

### 3.3 前端目录详细说明

#### `/frontend/src/pages` — 页面组件 (20+ 页面)

| 页面路径 | 组件名 | 功能描述 | 角色 |
|---------|--------|----------|------|
| `/command-cockpit` | CommandCockpit | 全局指挥驾驶舱 | leader |
| `/chief-dashboard` | ChiefDashboard | 处长部门工作台 | chief |
| `/city-dashboard` | CityDashboard | 市州属地工作台 | city |
| `/dashboard` | Dashboard | 系统 Dashboard | admin |
| `/agents` | Agents | Agent 管理列表 | all |
| `/enforcement` | Enforcement | 执法办案管理 | all |
| `/approval` | Approval | 环评审批管理 | all |
| `/reports` | Reports | 报告生成管理 | all |
| `/security` | Security | 安全治理中心 | admin |
| `/models` | Models | 模型路由配置 | admin |
| `/cesium` | Cesium | 3D 地图监测 | all |
| `/settings` | Settings | 系统设置 | admin |

#### `/frontend/src/store` — Zustand 状态管理

| Store 文件 | 用途 |
|------------|------|
| `appStore.ts` | 全局应用状态 (主题/语言) |
| `authStore.ts` | 认证状态 (用户/角色/权限) |
| `chatStore.ts` | 聊天会话状态 |
| `agentStore.ts` | Agent 列表与状态 |
| `memoryStore.ts` | 记忆系统状态 |
| `securityStore.ts` | 安全事件状态 |
| `automationStore.ts` | 自动化流程状态 |

---

## 4. 后端核心模块

### 4.1 EcoAgentEngine — Agent 对话循环引擎

**文件位置**: [backend/engine/loop.py](backend/engine/loop.py)

#### 类定义

```python
class EcoAgentEngine:
    """EcoMind 自主 Agent 对话引擎"""
```

#### 核心方法

| 方法 | 类型 | 描述 |
|------|------|------|
| `__init__(config, tool_registry, api_key, api_base, on_progress)` | 构造函数 | 初始化引擎，配置模型参数和回调 |
| `run(task, system_message)` -> `AgentResult` | async | 执行任务（非流式），返回完整结果 |
| `run_stream(task, system_message)` -> `AsyncIterator[str]` | async generator | 流式执行任务，yield 文本增量 |

#### 核心循环流程

```
用户输入 task
    │
    ▼
构建 messages (system + user)
    │
    ▼
┌─────────────────────────────────┐
│   WHILE iteration < max_iterations │
│                                   │
│   1. 获取工具 schemas             │
│   2. 调用 LLM API (流式)          │
│      ├─ text_delta → yield 文本   │
│      ├─ tool_call → 执行工具       │
│      │   ├─ 成功 → 追加结果        │
│      │   └─ 失败 → 追加错误信息    │
│      │   → 回到步骤 2              │
│      ├─ finished → 返回最终结果    │
│      └─ error → yield 错误并返回  │
│                                   │
└─────────────────────────────────┘
    │
    ▼
返回 AgentResult
```

#### 配置类 - AgentConfig

```python
@dataclass
class AgentConfig:
    provider: str = "deepseek"        # 模型提供商
    model: str = "deepseek-chat"      # 模型名称
    soul: str = ""                    # Agent 角色/灵魂定义
    temperature: float = 0.7          # 温度参数
    max_tokens: int = 4096            # 最大 token 数
    max_iterations: int = 10          # 最大循环轮数
    stream: bool = True               # 流式输出开关
    tools: list[str] = []             # 启用的工具列表
    tier: AgentTier = SONNET          # 模型层级 (opus/sonnet/haiku)
    verify_enabled: bool = True       # 输出验证开关
```

#### 结果类 - AgentResult

```python
@dataclass
class AgentResult:
    content: str                      # 最终输出内容
    status: AgentRunStatus            # 执行状态 (running/completed/error/max_iterations)
    iterations: int = 0               # 实际迭代次数
    tools_used: list[str] = []        # 使用的工具列表
    error: Optional[str] = None       # 错误信息
    hallucination_risk: float = 0.0   # 幻觉风险评分 (0.0-1.0)
    session_id: str = ""              # 会话 ID
    started_at: datetime              # 开始时间
    finished_at: Optional[datetime]   # 结束时间
```

---

### 4.2 EcoToolRegistry — 工具注册表

**文件位置**: [backend/engine/tool_registry.py](backend/engine/tool_registry.py)

#### 类定义

```python
class EcoTool:
    """单个工具定义"""
    - name: str                           # 工具名称
    - description: str                    # 工具描述
    - handler: Callable                   # 执行函数
    - requires_approval: bool             # 是否需要审批
    - permission_level: int               # 权限等级 (1-5)
    - category: str                       # 分类
    - parameters: dict                    # 参数 schema


class EcoToolRegistry:
    """全局工具注册表（单例模式）"""
```

#### 核心方法

| 方法 | 描述 |
|------|------|
| `register(tool: EcoTool)` | 注册新工具 |
| `unregister(name: str)` | 注销工具 |
| `get(name: str) -> Optional[EcoTool]` | 按名称获取工具 |
| `get_all() -> list[EcoTool]` | 获取所有工具 |
| `get_openai_schemas(names) -> list[dict]` | 导出 OpenAI function calling 格式 |
| `bind_role(role, tool_names)` | 将工具绑定到角色 |
| `get_for_role(role) -> list[EcoTool]` | 获取角色可用工具 |
| `execute(name, **kwargs) -> Any` | 异步执行工具 |

#### 内置工具 (5 个)

| 工具名 | 分类 | 描述 | 参数 |
|--------|------|------|------|
| `query_environment_data` | environment | 查询生态环境数据 (AQI/PM2.5/水质/噪声) | data_type, location, start_time, end_time |
| `query_emission_data` | carbon | 查询碳排放数据 (排放量/配额/减排) | enterprise_id, year, scope |
| `submit_approval` | approval | 提交审批 (排污许可/环评/执法) | type, title, content |
| `generate_report` | report | 生成报告 (日报/周报/月报/环评) | report_type, start_date, end_date |
| `search_regulation` | legal | 搜索法律法规 | keyword, category |

---

### 4.3 EcoVerifier — 输出验证器

**文件位置**: [backend/engine/verify.py](backend/engine/verify.py)

#### 类定义

```python
class EcoVerifier:
    """轻量级 LLM 输出验证器"""
```

#### 验证规则

| 规则 | 检测内容 | 严重程度 | 置信度扣减 |
|------|----------|----------|------------|
| 空响应检测 | 输出为空或空白 | high | -100% (confidence=0) |
| 过短响应 | 少于 5 个字符 | medium | -50% |
| 不确定性标记 | "可能"/"据称"/"有待核实" 等 (>3处) | medium | -20% 或 -5%/处 |
| 合规敏感词 | "伪造数据"/"偷排"/"行贿" 等 | high | -50%/词 |
| 系统错误标记 | "[工具执行失败]"/"[错误]" 等 | high | -30%/处 |

#### 验证结果

```python
@dataclass
class VerifyResult:
    verify_id: str                    # 验证 ID (UUID)
    is_passing: bool                  # 是否通过
    verdict: str                      # 判定: pass/warning/fail
    confidence: float                 # 置信度评分 (0.0-1.0)
    failure_modes: list[dict]         # 失败模式详情
    violations: list[str]             # 违规项列表
    verified_at: datetime             # 验证时间
    llm_output_hash: str              # 输出 MD5 哈希
```

#### 使用示例

```python
verifier = EcoVerifier(min_confidence=0.6)
result = verifier.verify(
    user_input="湘江水质怎么样？",
    llm_output="根据监测数据，湘江水质可能达到II类标准..."
)
print(result.verdict)      # "warning"
print(result.confidence)   # 0.85 (检测到"可能")
```

---

### 4.4 EcoMemory — 本地记忆系统

**文件位置**: [backend/engine/memory.py](backend/engine/memory.py)

#### 三层记忆架构

```
┌─────────────────────────────────────────────────────────┐
│                    EcoMemory                             │
│                                                         │
│  ┌─────────────┐  ┌──────────────────┐  ┌───────────┐  │
│  │  会话记忆    │  │    长期记忆       │  │  工作记忆  │  │
│  │ (short_term) │  │  (long_term)     │  │ (working) │  │
│  │             │  │                  │  │           │  │
│  │ • 内存存储   │  │ • SQLite 持久化  │  │ • 内存存储 │  │
│  │ • 当前对话   │  │ • 跨会话保留     │  │ • 任务临时 │  │
│  │ • 会话结束   │  │ • TTL 过期清理   │  │ • 任务清除 │  │
│  │   自动释放   │  │ • 按类别/关键词  │  │           │  │
│  │             │  │   搜索           │  │           │  │
│  └─────────────┘  └──────────────────┘  └───────────┘  │
└─────────────────────────────────────────────────────────┘
```

#### 数据库表结构

**long_term_memory 表**

| 字段 | 类型 | 描述 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| key | TEXT UNIQUE | 记忆键 |
| value | TEXT | JSON 序列化的值 |
| category | TEXT | 分类 (default: 'general') |
| importance | REAL | 重要程度 (0.0-1.0) |
| created_at | REAL | 创建时间戳 |
| updated_at | REAL | 更新时间戳 |
| expires_at | REAL | 过期时间戳 (NULL=永不过期) |
| tags | TEXT | 标签 JSON 数组 |

**session_history 表**

| 字段 | 类型 | 描述 |
|------|------|------|
| id | INTEGER PK | 自增主键 |
| session_id | TEXT | 会话 ID |
| role | TEXT | 角色 (user/assistant/system) |
| content | TEXT | 消息内容 |
| metadata | TEXT | 元数据 JSON |
| created_at | REAL | 创建时间戳 |

#### 核心方法

| 方法 | 描述 |
|------|------|
| `remember(key, value, category, importance, ttl_seconds, tags)` | 存储长期记忆 |
| `recall(key) -> Any` | 按 key 召回记忆 |
| `recall_by_category(category, limit) -> list` | 按类别召回 |
| `search(keyword, limit) -> list` | 关键词搜索 |
| `forget(key) -> bool` | 删除记忆 |
| `start_session(session_id)` | 创建会话 |
| `add_message(session_id, role, content, metadata)` | 添加消息 |
| `get_session_messages(session_id, limit) -> list` | 获取会话消息 |
| `end_session(session_id)` | 结束会话 |
| `set_working(key, value)` / `get_working(key)` / `clear_working()` | 工作记忆操作 |
| `cleanup_expired() -> int` | 清理过期记忆 |
| `stats() -> dict` | 获取统计信息 |

---

### 4.5 AgentService — Agent 业务服务

**文件位置**: [backend/api/services/agent_service.py](backend/api/services/agent_service.py)

#### 类定义

```python
class AgentService:
    """Agent 业务逻辑服务 — CRUD + 状态管理 + 消息交互 + 部门智能体管理"""
```

#### 核心方法

| 方法 | 描述 |
|------|------|
| `create_agent(request) -> AgentResponse` | 创建新 Agent |
| `create_dept_agent(department, name, soul, tools, ...)` | 创建部门专属智能体 |
| `init_all_dept_agents() -> dict` | 一键初始化全部 19 个部门智能体 |
| `get_agent_by_department(department)` | 根据部门获取智能体 |
| `send_to_department(department, message)` | 向部门智能体发送消息 |
| `list_agents(status, provider, department, limit, offset)` | 列出 Agent (支持筛选) |
| `get_agent(agent_id)` | 获取 Agent 详情 |
| `update_status(agent_id, request)` | 更新 Agent 状态 |
| `send_message(agent_id, request)` | 发送消息并获取回复 |
| `get_all_departments() -> list` | 获取所有部门智能体状态 |

#### 部门智能体映射 (19 个)

| 优先级 | 部门 | 智能体名称 | 主要技能 |
|--------|------|------------|----------|
| P0 | 生态环境执法局 | 执法办案智能体 | enforcement-decision, environment-monitoring |
| P0 | 生态环境监测处 | 监测分析智能体 | environment-monitoring, report-generation |
| P0 | 环境影响评价与排放管理处 | 环评审批智能体 | approval-workflow, security-audit |
| P0 | 大气环境与应对气候变化处 | 大气治理智能体 | carbon-emission, environment-monitoring |
| P0 | 水生态环境处 | 水环境治理智能体 | environment-monitoring, report-generation |
| P0 | 土壤生态环境处 | 土壤治理智能体 | environment-monitoring, report-generation |
| P1 | 办公室 | 政务综合智能体 | report-generation, approval-workflow |
| P1 | 综合协调处 | 综合协调智能体 | environment-monitoring, report-generation |
| P1 | 法规与标准处 | 法规标准智能体 | enforcement-decision, approval-workflow |
| P1 | 科技与财务处 | 科技财务智能体 | report-generation |
| P1 | 宣传教育与对外合作处 | 宣传合作智能体 | report-generation |
| P2-P3 | 督察/固废/核辐射/生态/人事/党建等 | ... | ... |

---

### 4.6 ECC Skill Bridge — 技能系统桥接

**文件位置**: [backend/skills/ecc_bridge.py](backend/skills/ecc_bridge.py)

#### 核心类

| 类名 | 描述 |
|------|------|
| `ECCSkill` | ECC 格式技能定义 (兼容 193K⭐ ECC 仓库) |
| `DepartmentAgent` | 部门智能体完整定义 |
| `AgentWorkspace` | EcoMind 工作区 (5 文件结构) |
| `ECCInstinctEngine` | Instincts 直觉规则引擎 |
| `ECCSkillLoader` | 技能加载器 (从 .md 文件 + 工作区加载) |

#### 6 大内置生态技能

| 技能名 | 分类 | 触发关键词 | 内置工具 | 直觉规则数 |
|--------|------|------------|----------|------------|
| `environment-monitoring` | 环境 | 监测/AQI/PM2.5/水质 | query_environment_data, generate_report | 4 |
| `carbon-emission` | 碳排放 | 碳排放/碳配额/减排/碳中和 | query_emission_data, generate_report, search_regulation | 4 |
| `enforcement-decision` | 执法 | 执法/违法/处罚/罚款 | search_regulation, submit_approval, generate_report | 5 |
| `approval-workflow` | 审批 | 审批/许可/环评/排污许可 | submit_approval, search_regulation | 4 |
| `report-generation` | 报告 | 报告/日报/周报/月报 | generate_report, query_environment_data, query_emission_data | 2 |
| `security-audit` | 安全 | 安全/审计/漏洞/攻击 | search_regulation | 4 |

#### 工作区文件结构 (5 文件)

```
agent-{dept-name}/
├── SOUL.md        # 人格、规则、沟通风格
├── AGENTS.md      # 任务、工作流、输出格式
├── IDENTITY.md    # 身份卡片
├── MEMORY.md      # 持久化记忆
├── TOOLS.md       # 工具列表
└── HEARTBEAT.md   # 心跳配置 (可选)
```

---

## 5. 前端架构

### 5.1 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 18.3.1 | UI 框架 |
| TypeScript | 5.7.3 | 类型安全 |
| Vite | 6.1.0 | 构建工具 |
| Ant Design | 5.24.0 | UI 组件库 |
| Ant Design Pro | 2.8.6 | 高级组件 |
| Zustand | 5.0.3 | 状态管理 |
| React Router DOM | 6.28.2 | 路由管理 |
| Cesium | 1.127.0 | 3D 地球/地图 |
| Deck.gl | 9.1.8 | 数据可视化图层 |
| ECharts | 5.6.0 | 图表库 |
| Socket.IO Client | 4.8.1 | WebSocket 通信 |
| i18next | 24.2.3 | 国际化 |
| Tailwind CSS | 4.1.7 | 原子化 CSS |

### 5.2 路由结构

**文件位置**: [frontend/src/router/index.tsx](frontend/src/router/index.tsx)

#### 四类角色路由

| 角色 | 主页面 | 可访问模块 |
|------|--------|------------|
| **leader** (厅领导) | `/command-cockpit` | 全部模块 |
| **chief** (处长) | `/chief-dashboard` | 部门工作台 + 业务模块 |
| **city** (市州) | `/city-dashboard` | 属地工作台 + 监测模块 |
| **admin** (管理员) | `/security` | 系统管理 + 安全治理 |

#### 路由分组

```
/login                              # 登录页 (无需认证)
│
└── / (MainLayout + AuthGuard)
    ├── /command-cockpit            # 🏛️ 指挥驾驶舱
    ├── /monitoring-map             #    3D 监测地图 (Cesium)
    ├── /dashboard                  #    系统 Dashboard
    │
    ├── /chief-dashboard            # 👔 处长工作台
    ├── /city-dashboard             # 🏙️ 市州工作台
    │
    ├── /agents                     # 🤖 智能体管理
    ├── /agents/departments         #    部门智能体
    ├── /skills                     #    技能管理
    ├── /memory-knowledge           #    记忆与知识
    │
    ├── /enforcement                # ⚖️ 执法办案
    ├── /enforcement/:caseId        #    案件详情
    ├── /enforcement/create         #    创建案件
    ├── /approval                   #    审批管理
    ├── /reports                    #    报告生成
    │
    ├── /security                   # 🛡️ 安全治理
    ├── /audit-log                  #    审计日志
    ├── /compliance                 #    合规检查
    │
    ├── /models                     # ⚙️ 模型路由
    ├── /settings                   #    系统设置
    ├── /users                      #    用户管理
    │
    ├── /workflows                  #    工作流 (保留)
    ├── /domains                    #    领域管理 (保留)
    └── /conversations              #    会话管理 (保留)
```

### 5.3 状态管理架构

**文件位置**: [frontend/src/store/](frontend/src/store/)

```
store/
├── index.ts              # 统一导出
├── appStore.ts           # 全局应用状态
│   - theme: 'light' | 'dark'
│   - locale: 'zh-CN' | 'en-US'
│
├── authStore.ts          # 认证状态
│   - user: UserInfo
│   - role: UserRole (leader/chief/city/admin)
│   - isAuthenticated: boolean
│   - ROLE_CONFIGS: 角色配置映射
│
├── chatStore.ts          # 聊天状态
├── agentStore.ts         # Agent 状态
├── memoryStore.ts        # 记忆系统状态
├── securityStore.ts      # 安全事件状态
├── automationStore.ts    # 自动化流程状态
├── deptStore.ts          # 部门状态
└── emailConnectorStore.ts # 邮件连接器状态
```

### 5.4 组件层次结构

```
App.tsx
└── WebSocketProvider
    └── ConfigProvider (Ant Design Theme + i18n)
        └── ThemeInitializer
            └── AntdApp
                └── RouterProvider
                    └── MainLayout
                        ├── Sidebar (导航菜单)
                        ├── ChatTopBar
                        └── <Page Content>
                            ├── Dashboard / CommandCockpit / ...
                            ├── Components
                            │   ├── ChatCanvas (聊天画布)
                            │   ├── ModelSelectorBar
                            │   ├── ToolCallMessage
                            │   └── ...
                            └── Right Panel
                                ├── MemoryPanel
                                ├── DiaryPanel
                                └── ChangeLogPanel
```

---

## 6. 关键类与函数说明

### 6.1 后端关键类汇总

| 类名 | 文件位置 | 职责 | 关键方法数 |
|------|----------|------|------------|
| `EcoAgentEngine` | `engine/loop.py` | Agent 对话循环引擎 | 8 |
| `EcoToolRegistry` | `engine/tool_registry.py` | 工具注册表 | 10 |
| `EcoTool` | `engine/tool_registry.py` | 工具定义 | 3 |
| `EcoVerifier` | `engine/verify.py` | 输出验证器 | 2 |
| `EcoMemory` | `engine/memory.py` | 记忆系统 | 16 |
| `AgentService` | `api/services/agent_service.py` | Agent 业务服务 | 12 |
| `AgentRecord` | `api/services/agent_service.py` | Agent 运行时记录 | 2 |
| `ECCSkillLoader` | `skills/ecc_bridge.py` | ECC 技能加载器 | 14 |
| `ECCInstinctEngine` | `skills/ecc_bridge.py` | Instincts 引擎 | 3 |
| `ECCSkill` | `skills/ecc_bridge.py` | ECC 技能定义 | - |
| `DepartmentAgent` | `skills/ecc_bridge.py` | 部门智能体定义 | - |
| `AgentWorkspace` | `skills/ecc_bridge.py` | 工作区定义 | 2 |
| `WebSocketManager` | `api/websocket/manager.py` | WebSocket 管理 | 6 |

### 6.2 前端关键组件

| 组件 | 文件位置 | 职责 |
|------|----------|------|
| `App` | `src/App.tsx` | 应用根组件 |
| `MainLayout` | `src/layouts/MainLayout.tsx` | 主布局 (侧边栏 + 内容区) |
| `ChatLayout` | `src/layouts/ChatLayout.tsx` | 聊天布局 |
| `AdminLayout` | `src/layouts/AdminLayout.tsx` | 管理后台布局 |
| `AuthGuard` | `src/components/AuthGuard.tsx` | 路由守卫 |
| `WebSocketProvider` | `src/providers/WebSocketProvider.tsx` | WebSocket Context |
| `ChatCanvas` | `src/components/Chat/ChatCanvas.tsx` | 聊天画布 |
| `ModelSelectorBar` | `src/components/Chat/ModelSelectorBar.tsx` | 模型选择栏 |
| `Sidebar` | `src/components/Sidebar/index.tsx` | 侧边导航栏 |

### 6.3 全局单例模式

后端使用全局单例模式管理核心实例：

```python
# 在各模块底部定义的全局单例获取函数

def get_tool_registry() -> EcoToolRegistry      # tool_registry.py
def get_memory() -> EcoMemory                   # memory.py
def get_verifier() -> EcoVerifier               # verify.py
def get_agent_service() -> AgentService         # agent_service.py
def get_ecc_loader() -> ECCSkillLoader          # ecc_bridge.py
def get_ecc_instincts() -> ECCInstinctEngine    # ecc_bridge.py
def get_dept_loader() -> ECCSkillLoader         # ecc_bridge.py (别名)
```

---

## 7. 依赖关系分析

### 7.1 后端 Python 依赖

| 依赖包 | 版本要求 | 用途 |
|--------|----------|------|
| fastapi | >=0.100 | Web 框架 |
| uvicorn | >=0.23 | ASGI 服务器 |
| pydantic | >=2.0 | 数据验证 |
| httpx | >=0.25 | HTTP 客户端 (LLM API 调用) |
| python-multipart | >=0.0.6 | 文件上传 |
| websockets | >=12.0 | WebSocket 支持 |
| litellm | >=1.0 | 模型路由代理 |
| sqlite3 | (内置) | 数据库 |

### 7.2 前端 npm 依赖

**生产依赖**:

| 包名 | 版本 | 用途 |
|------|------|------|
| react | ^18.3.1 | UI 框架 |
| react-dom | ^18.3.1 | DOM 渲染 |
| antd | ^5.24.0 | UI 组件库 |
| @ant-design/pro-components | ^2.8.6 | 高级组件 |
| @ant-design/icons | ^5.6.1 | 图标库 |
| cesium | ^1.127.0 | 3D 地球 |
| @deck.gl/* | ^9.1.8 | 数据可视化图层 |
| @turf/turf | ^7.1.0 | 地理空间分析 |
| echarts | ^5.6.0 | 图表 |
| echarts-for-react | ^3.0.2 | React ECharts 封装 |
| zustand | ^5.0.3 | 状态管理 |
| react-router-dom | ^6.28.2 | 路由 |
| socket.io-client | ^4.8.1 | WebSocket |
| i18next | ^24.2.3 | 国际化 |
| react-i18next | ^15.4.1 | React i18n 封装 |
| tailwindcss | ^4.1.7 | CSS 框架 |

**开发依赖**:

| 包名 | 版本 | 用途 |
|------|------|------|
| typescript | ^5.7.3 | TypeScript 编译器 |
| vite | ^6.1.0 | 构建工具 |
| @vitejs/plugin-react | ^4.3.4 | React Vite 插件 |
| eslint | ^9.20.0 | 代码检查 |
| prettier | ^3.5.3 | 代码格式化 |
| vitest | - | 单元测试 |

### 7.3 模块依赖关系图

```
┌─────────────────────────────────────────────────────────────────┐
│                        api/main.py                              │
│                           │                                     │
│         ┌─────────────────┼─────────────────┐                   │
│         ▼                 ▼                 ▼                   │
│   routers/          services/         websocket/                │
│    │                   │                  │                     │
│    ▼                   ▼                  ▼                     │
│ agents.py        agent_service.py    manager.py                 │
│ workflows.py     workflow_service.py     │                     │
│ security.py      security_service.py     │ (broadcast)         │
│ models.py        model_service.py                               │
│ departments.py   dept_service.py                                │
│ enforcement.py   enforcement_service.py                         │
│ approval.py      approval_service.py                            │
│ compliance.py    compliance_service.py                          │
│ reports.py       report_service.py                              │
│                                                           │     │
│         ┌────────────────────────────────────────┐             │
│         │         services 依赖引擎层             │             │
│         └────────────────────────────────────────┘             │
│                           │                                     │
│         ┌─────────────────┼─────────────────┐                   │
│         ▼                 ▼                 ▼                   │
│   engine/loop.py    engine/verify.py   engine/memory.py         │
│   (EcoAgentEngine)  (EcoVerifier)     (EcoMemory)               │
│         │                                                   │   │
│         ▼                                                       │
│   engine/tool_registry.py                                       │
│   (EcoToolRegistry)                                             │
│         │                                                       │
│         ▼                                                       │
│   skills/ecc_bridge.py                                          │
│   (ECCSkillLoader + Instincts)                                  │
│                                                                 │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│   │ govmcp/  │  │ graph/   │  │ safety/  │  │ memory/  │       │
│   │ (政务加密)│  │ (知识图谱)│  │ (安全)   │  │ (Claude) │       │
│   └──────────┘  └──────────┘  └──────────┘  └──────────┘       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. 运行方式

### 8.1 环境要求

| 依赖 | 版本 | 说明 |
|------|------|------|
| Node.js | v22+ | 前端构建环境 |
| pnpm | v11+ | 前端包管理器 |
| Python | 3.11+ | 后端运行环境 |
| SQLite3 | (内置) | 数据库 (无需额外安装) |

### 8.2 快速启动

#### 1. 克隆项目

```bash
git clone https://github.com/xiejianjun000/EcoMind-OS.git
cd EcoMind-OS
```

#### 2. 启动后端

```bash
cd backend

# 创建虚拟环境 (推荐)
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate   # Windows

# 安装依赖
pip install -r requirements.txt

# 启动服务
python -m uvicorn api.main:app --reload --port 8000
```

后端启动后访问: **http://localhost:8000/docs** (Swagger API 文档)

#### 3. 启动前端

```bash
cd frontend

# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev
```

前端启动后访问: **http://localhost:5173**

#### 4. 配置 LLM API Key

```bash
# DeepSeek (默认)
export DEEPSEEK_API_KEY="sk-your-deepseek-key"

# 或其他模型提供商
export DASHSCOPE_API_KEY="sk-your-qwen-key"     # 通义千问
export GLM_API_KEY="your-glm-key"                # 智谱 GLM
export OPENAI_API_KEY="your-openai-key"          # OpenAI
```

### 8.3 Docker 部署

项目提供多架构 Docker 部署配置：

```bash
# 使用 docker-compose
cd deploy
docker-compose up -d

# 或选择特定芯片架构
docker-compose -f docker-compose.kunpeng.yml up -d   # 鲲鹏
docker-compose -f docker-compose.loongson.yml up -d   # 龙芯
docker-compose -f docker-compose.phytium.yml up -d    # 飞腾
```

### 8.4 本地推理部署 (可选)

```bash
# 使用 vLLM 部署本地模型
cd backend/vllm
bash start_vllm.sh

# 或使用 SGLang
cd backend/inference
bash start_sglang.sh

# 启动 LiteLLM 代理
cd backend/litellm-proxy
python start_proxy.py
```

### 8.5 测试

```bash
# 后端测试
cd backend
pytest tests/unit/           # 单元测试
pytest tests/integration/    # 集成测试
pytest tests/security/       # 安全测试
pytest tests/chaos/          # 混沌测试

# 前端测试
cd frontend
pnpm test                    # Vitest 单元测试
pnpm lint                    # ESLint 检查
```

---

## 9. 数据流与交互流程

### 9.1 用户聊天流程

```
用户输入消息
    │
    ▼
┌─────────────┐     POST /api/agents/{id}/message
│  Frontend   │ ─────────────────────────────────►
│  ChatCanvas │                                    │
└─────────────┘                                    │
                                                    ▼
                                           ┌────────────────┐
                                           │  AgentService  │
                                           │  .send_message │
                                           └───────┬────────┘
                                                   │
                                    ┌──────────────┼──────────────┐
                                    ▼              ▼              ▼
                            ┌────────────┐ ┌────────────┐ ┌────────────┐
                            │ EcoMemory  │ │EcoAgentEng │ │EcoVerifier │
                            │ .add_msg   │ │ .run()     │ │ .verify()  │
                            └────────────┘ └─────┬──────┘ └─────┬──────┘
                                                  │              │
                                                  ▼              ▼
                                         ┌──────────────────────────────┐
                                         │      LLM API (HTTP Stream)   │
                                         │  DeepSeek/Qwen/GLM/...      │
                                         └──────────────┬───────────────┘
                                                        │
                                            ┌───────────┼───────────┐
                                            ▼           ▼           ▼
                                        text_delta  tool_call   finished
                                            │           │           │
                                            ▼           ▼           ▼
                                       yield 文本  执行工具    返回结果
                                                   │
                                                   ▼
                                          ┌────────────────┐
                                          │EcoToolRegistry│
                                          │  .execute()   │
                                          └───────────────┘
                                                        │
                                                        ▼
                                                  返回给 LLM
                                                        │
                                                        ▼
                                                   继续循环...
                                                        │
                                                        ▼
                                                   WebSocket 推送进度
                                                        │
                                                        ▼
                                                   Frontend 实时显示
```

### 9.2 部门智能体初始化流程

```
POST /api/agents/init-departments
    │
    ▼
AgentService.init_all_dept_agents()
    │
    ├── ECCSkillLoader.load_hunan_agents()
    │       │
    │       ├── 加载 _DEFAULT_DEPT_CONFIG (19 个部门)
    │       ├── 加载 ecc/hunan-agents/workspaces/ (SOUL.md 等)
    │       └── 构建 DepartmentAgent 列表
    │
    └── FOR EACH department:
            │
            ▼
        AgentService.create_dept_agent()
            │
            ├── assemble_agent_prompt()  # 从工作区组装 prompt
            ├── AgentCreateRequest       # 构建请求
            └── AgentService.create_agent()
                    │
                    ▼
                EcoAgentEngine(config)    # 初始化引擎
                    │
                    ▼
                存入 self._agents[] + self._dept_agents[]
    │
    ▼
返回 {initialized: 19, agents: [...]}
```

### 9.3 WebSocket 事件流

```
后端事件                          前端处理
─────────                        ─────────

agent:status              →  更新 Agent 状态指示器
agent:progress            →  显示思考/工具调用进度
  ├─ thinking             →  显示"思考中..."动画
  ├─ tool_call            →  展示工具调用卡片
  ├─ tool_result          →  更新工具结果
  ├─ text_delta           →  追加文本到聊天框
  ├─ completed            →  显示完成标记
  └─ error                →  显示错误提示

ws:connected              →  显示连接状态绿点
ws:disconnected           →  显示断连警告
ws:message                →  通用消息处理
```

---

## 10. 开发指南

### 10.1 添加新的内置工具

在 [backend/engine/tool_registry.py](backend/engine/tool_registry.py) 的 `_register_builtin_tools()` 函数中添加：

```python
registry.register(EcoTool(
    name="your_tool_name",
    description="工具描述",
    handler=lambda **kw: {"result": f"处理结果 {kw}"},
    category="your_category",
    parameters={
        "param1": {"type": "string", "description": "参数1"},
        "param2": {"type": "integer", "description": "参数2"},
    },
))
```

### 10.2 添加新的部门智能体

1. 在 [backend/skills/ecc_bridge.py](backend/skills/ecc_bridge.py) 的 `_DEFAULT_DEPT_CONFIG` 中添加配置：

```python
{"key": "new-agent", "dept": "新部门名称", "display": "显示名称", 
 "priority": "P1", "skills": ["skill1", "skill2"], 
 "color": "#XXXXXX", "emoji": "🎯"},
```

2. 创建工作区目录：`backend/skills/ecc/hunan-agents/workspaces/agent-new-agent/`

3. 添加工作区文件：
   - `SOUL.md` — 人格定义
   - `AGENTS.md` — 任务描述
   - `TOOLS.md` — 工具列表

### 10.3 添加新的前端页面

1. 在 `frontend/src/pages/` 创建页面组件
2. 在 [frontend/src/router/index.tsx](frontend/src/router/index.tsx) 添加路由：

```typescript
const NewPage = lazy(() => import('@/pages/NewPage'));

// 在 children 数组中添加
{ path: 'new-page', element: <LazyPage><NewPage /></LazyPage> },
```

3. 在侧边栏配置中添加导航项

### 10.4 添加新的 API 路由

1. 在 `backend/api/routers/` 创建路由文件：

```python
from fastapi import APIRouter

router = APIRouter()

@router.get("/items")
async def list_items():
    return {"items": []}
```

2. 在 [backend/api/main.py](backend/api/main.py) 的 `create_app()` 中注册：

```python
from api.routers import your_module
application.include_router(your_module.router, prefix="/api/your-module", tags=["Your Module"])
```

### 10.5 代码规范

#### Python 后端

- 使用 **Type Hints** (类型注解)
- 使用 **dataclass** 定义数据结构
- 使用 **async/await** 处理异步操作
- 日志使用 `logging.getLogger(__name__)`
- 全局单例使用延迟初始化模式 (`_instance = None` + `get_instance()`)

#### TypeScript 前端

- 使用 **Functional Components** + **Hooks**
- 使用 **Zustand** 进行状态管理
- 组件使用 **lazy loading** + **Suspense**
- Props 使用 **Interface** 定义类型
- 样式优先使用 **Tailwind CSS** 类名

### 10.6 调试技巧

#### 后端调试

```bash
# 启用 DEBUG 日志
export LOG_LEVEL=DEBUG

# 查看 Swagger API 文档
open http://localhost:8000/docs

# 查看健康检查
curl http://localhost:8000/health
```

#### 前端调试

```bash
# 启用 Vue/React DevTools
# 浏览器扩展: React Developer Tools

# 查看 Vite 开发服务器日志
# 终端输出包含 HMR 和编译信息
```

---

## 附录

### A. 端口说明

| 服务 | 端口 | 说明 |
|------|------|------|
| Frontend (Vite) | 5173 | 前端开发服务器 |
| Backend (FastAPI) | 8000 | 后端 API 服务 |
| WebSocket | 8000/ws | WebSocket 端点 |
| LiteLLM Proxy | 4000 | 模型路由代理 (可选) |
| vLLM | 8000 | 本地推理服务 (可选) |

### B. 环境变量

| 变量名 | 描述 | 默认值 |
|--------|------|--------|
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥 | (必填) |
| `DASHSCOPE_API_KEY` | 通义千问 API 密钥 | (可选) |
| `GLM_API_KEY` | 智谱 GLM API 密钥 | (可选) |
| `OPENAI_API_KEY` | OpenAI API 密钥 | (可选) |
| `LOG_LEVEL` | 日志级别 | INFO |

### C. 项目灵感来源

| 项目 | Stars | 集成模块 | 理念贡献 |
|------|-------|----------|----------|
| [affaan-m/ECC](https://github.com/affaan-m/ECC) | 193K ⭐ | `backend/skills/` | Skills + Instincts + Memory + Security |
| [thedotmack/claude-mem](https://github.com/thedotmack/claude-mem) | 78K ⭐ | `backend/memory/` | 跨会话持久化 + AI 压缩上下文 |
| [Lum1104/Understand-Anything](https://github.com/Lum1104/Understand-Anything) | 33K ⭐ | `backend/graph/` | 交互式知识图谱 |
| [mukul975/Anthropic-Cybersecurity-Skills](https://github.com/mukul975/Anthropic-Cybersecurity-Skills) | 9.6K ⭐ | `backend/safety/` | 754 条结构化安全技能 |
| [anthropics/knowledge-work-plugins](https://github.com/anthropics/knowledge-work-plugins) | 16K ⭐ | Knowledge Work | 知识工作者插件范式 |
| [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) | 20K ⭐ | Verify | AI 输出质量品味 |

### D. 许可证

```
Copyright 2024-2026 EcoMind OS Contributors

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

---

## 11. ⚠️ 真实实现状态审计报告

> **审计日期**: 2026-05-28 | **审计范围**: README 声明 vs 实际代码 | **审计方法**: 静态分析 + 动态验证

### 11.1 审计结论总览

| 类别 | 声明数 | ✅ 完全实现 | 🟡 部分实现 | ❌ 未实现 | 实现率 |
|------|--------|------------|------------|----------|--------|
| **核心引擎** | 8 | 7 | 1 | 0 | **94%** |
| **安全系统** | 6 (L1-L6) | 2 | 2 | 2 | **50%** |
| **记忆系统** | 4 (四层) | 2 | 2 | 0 | **67%** |
| **外部依赖集成** | 9 | 0 | 1 | 8 | **11%** |
| **模型路由** | 5 | 0 | 3 | 2 | **30%** |
| **政务集成** | 4 | 1 | 2 | 1 | **38%** |
| **总计** | **36** | **10** | **11** | **15** | **42%** |

### 11.2 详细审计结果

#### ✅ 完全实现的模块 (10/36)

| 模块 | 文件位置 | 验证状态 |
|------|----------|----------|
| **EcoAgentEngine** | [backend/engine/loop.py](backend/engine/loop.py) | ✅ 可导入、可实例化、run/run_stream 正常 |
| **EcoToolRegistry** | [backend/engine/tool_registry.py](backend/engine/tool_registry.py) | ✅ 5 个内置工具全部注册并可执行 |
| **EcoVerifier** | [backend/engine/verify.py](backend/engine/verify.py) | ✅ 6 大验证规则全部生效，置信度评分正常 |
| **EcoMemory (三层)** | [backend/engine/memory.py](backend/engine/memory.py) | ✅ SQLite 三层记忆完整可用 |
| **ECC 技能系统** | [backend/skills/ecc_bridge.py](backend/skills/ecc_bridge.py) | ✅ 25 个技能 (6 内置 + 19 部门) 全部加载 |
| **AgentService** | [backend/api/services/agent_service.py](backend/api/services/agent_service.py) | ✅ CRUD + 19 部门智能体管理正常 |
| **FastAPI 应用** | [backend/api/main.py](backend/api/main.py) | ✅ 15 路由 + WebSocket + CORS 配置完整 |
| **前端 Vite 应用** | [frontend/src/App.tsx](frontend/src/App.tsx) | ✅ 25+ 页面、4 角色权限、i18n 双语、亮暗主题 |
| **Cesium 3D 场景** | [frontend/src/pages/Cesium/](frontend/src/pages/Cesium/) | ✅ 6 组件 (HunanTerrainScene/MonitoringStation 等) |
| **SafetyChain L1-L4** | [backend/api/routers/safety_chain.py](backend/api/routers/safety_chain.py) | ✅ 正则规则引擎完整 (Prompt注入/PII/SQL/XSS/幻觉检测) |

#### 🟡 部分实现的模块 (11/36)

| 模块 | 声明 | 实际情况 | 差距说明 |
|------|------|----------|----------|
| **SafetyChain L5-L6** | "Langfuse Tracer 审计" / "GOVMCP 国密审批" | L5/L6 有路由和规则定义，但 pattern 为空 | 🔸 占位符实现，需补充实际逻辑 |
| **四层记忆 L2-L3** | "Mem0 用户偏好" / "Graphiti 关联记忆" | L2 用 SQLite key-value 替代 Mem0；L3 用关键词搜索替代图数据库 | 🔸 功能等效但非原库集成 |
| **GOVMCP 国密加密** | "SM2/SM3/SM4 国密算法" | crypto.py 有完整代码，使用 gmssl 或内置简化实现 | 🔸 代码存在，gmssl 库可选依赖 |
| **LiteLLM Proxy** | "15+ 国产模型路由" | config.yaml 配置了 15+ 模型，但需要 API Key | 🔸 配置完整，缺运行时环境变量 |
| **vLLM/SGLang 推理** | "本地模型部署" | docker-compose.yml + 启动脚本存在 | 🔸 缺 GPU 硬件，无法实测 |
| **WebSocket 联调** | "实时进度推送" | manager.py 有 ConnectedClient + EventBus + broadcast | 🔸 后端就绪，需前后端联调验证 |
| **工作流编排** | "自建有向图状态机" | workflow_service.py 存在，有基础 CRUD | 🔸 缺少实际的节点执行引擎 |

#### ❌ 未实现的外部依赖集成 (8/9)

| 声明的依赖 | pyproject.toml 中？ | 实际情况 | 备注 |
|-----------|-------------------|----------|------|
| **LangGraph** | ❌ 无 | backend 无任何 langgraph 导入 | loop.py 明确声明"不依赖 LangChain" |
| **CrewAI** | ❌ 无 | pyproject.toml 无 crewai | 完全未集成 |
| **TAIJI-AGENT** | ⚠️ 仅注释引用 | `backend/taiji-agent/` 只有 MIGRATION.md | 目录基本为空 |
| **Mem0** | ❌ 无 | memory/claude_mem_bridge.py 自建 user_preferences 表 | 用 SQLite key-value 替代 |
| **Graphiti** | ❌ 无 | 无图数据库集成 | L3 用关键词搜索替代 |
| **GraphRAG** | ❌ 无 | 无向量检索或 RAG 功能 | L4 用会话摘要替代 |
| **Xiangxin Guardrails** | ❌ 无 | safety/cybersec_skills.py 注释提到"等效" | 用自研正则规则替代 |
| **NeMo Guardrails** | ❌ 无 | safety/cybersec_skills.py 注释提到"等效" | 同上 |
| **LettuceDetect** | ❌ 无 | safety/cybersec_skills.py 注释提到"等效" | 幻觉检测用正则替代 |

### 11.3 核心发现：README vs 实际代码的差距

#### 发现 1：项目采用"自研替代"策略

README 声明集成了大量外部开源库，但实际代码采用了**自研简化方案**：

```
声明                          实际
────                          ────
LangGraph 状态机              → 自研 EcoAgentEngine 对话循环
CrewAI 团队协作               → AgentService 单例模式
Hermes/Mem0/Graphiti/GraphRAG → EcoMemory (SQLite)
Xiangxin/NeMo Guardrails      → EcoVerifier (正则表达式)
TAIJI-AGENT 112 模块           → ECC Bridge (25 技能)
```

#### 发现 2：v2.0 版本的架构转型

根据代码注释，项目经历了从 v1.x 到 v2.0 的重大重构：

```python
# engine/loop.py 第4行:
"""
不依赖 taiji_agent、Claude Code、LangChain 等任何外部 Agent 框架。
纯 Python asyncio + HTTPX 调 LLM API（OpenAI 兼容格式）。
"""
```

这说明 **v2.0 是有意切断外部依赖的版本**，采用完全自研路线。

#### 发现 3：配置驱动的"预留接口"

许多未实现的功能以**配置文件 + API 路由占位符**形式存在：

- LiteLLM config.yaml 定义了 15+ 模型 → 但需要外部 API
- SafetyChain L5-L6 有路由和规则结构 → 但 pattern 为空
- GOVMCP crypto.py 有完整 SM2/SM3/SM4 代码 → 但 gmssl 是可选依赖

### 11.4 真实可用功能清单

#### 🟢 开箱即用（无需额外配置）

1. **FastAPI 后端服务** — `python -m uvicorn api.main:app --port 8000`
2. **React 前端应用** — `pnpm dev` → http://localhost:5174
3. **Agent 引擎** — EcoAgentEngine 支持流式对话 + 工具调用循环
4. **工具注册表** — 5 个内置工具（环境数据/碳排放/审批/报告/法规）
5. **输出验证** — EcoVerifier 空/过短/不确定性/敏感词检测
6. **SQLite 记忆** — 三层记忆（会话/长期/工作）自动持久化
7. **ECC 技能系统** — 25 个技能 + 19 个部门智能体
8. **SafetyChain L1-L4** — 输入护栏/策略护栏/输出验证/幻觉检测
9. **Cesium 3D 地图** — 湖南省 3D 场景 + 监测站点组件
10. **API 文档** — http://localhost:8000/docs (Swagger UI)

#### 🟡 需要配置才能用

11. **LLM 对话功能** — 需设置 `DEEPSEEK_API_KEY` 或其他模型 API Key
12. **LiteLLM 模型路由** — 需配置对应的环境变量（DASHSCOPE/GLM/YI 等）
13. **GOVMCP 国密加密** — 可选安装 `gmssl` 库，否则使用内置简化实现
14. **本地推理 (vLLM/SGLang)** — 需要 GPU 硬件 + 模型权重文件

#### 🔴 未实现/占位符

15. **LangGraph/CrewAI 工作流** — 完全未集成，workflow_service.py 只有基础 CRUD
16. **四层记忆的外部库** — Hermes/Mem0/Graphiti/GraphRAG 均未安装
17. **六层安全的 L5-L6** — Langfuse 审计追踪和 GOVMCP 区块链存证缺失
18. **TAIJI-AGENT 112 模块** — `backend/taiji-agent/` 基本为空目录

### 11.5 项目定位修正建议

基于审计结果，建议将项目描述修正为：

**当前真实状态（v2.0）：**
> EcoMind OS 是一个**生态环境垂直领域 AI Agent 原型平台**，
> 采用**完全自研的核心引擎**（EcoAgentEngine/EcoToolRegistry/EcoVerifier/EcoMemory），
> 集成了 **ECC 技能系统**（25 个技能）和 **19 个湖南环保部门智能体**，
> 提供完整的 **前后端界面**（React + FastAPI）和 **3D 可视化**（Cesium）。
>
> **注意**：项目 v2.0 有意切断了所有外部 Agent 框架依赖（LangChain/CrewAI/TAIJI-AGENT），
> 采用自研方案替代。README 中声明的部分高级特性（LangGraph 工作流、四层外部记忆库、
> 六层完整安全链）属于**规划中的功能**或**配置级占位符**，尚未完全实现。

### 11.6 审计数据来源

所有审计结论均基于以下验证方法：

```bash
# 1. 静态代码分析
grep -r "langgraph\|crewai\|mem0\|graphiti" backend/
# 结果: 仅在注释中引用，无实际 import

# 2. 动态导入测试
python -c "from engine.loop import EcoAgentEngine; print('✅')"
python -c "from skills.ecc_bridge import get_ecc_loader; loader = get_ecc_loader(); print(f'{len(loader.get_all())} skills')"

# 3. 服务启动测试
pnpm dev  # 前端: http://localhost:5174 ✅
python -m uvicorn api.main:app --port 8000  # 后端: http://localhost:8000/docs ✅

# 4. 依赖检查
pip show langgraph crewai mem0 graphiti graphrag xiangxin nemo-guardrails
# 结果: Package(s) not found
```

---

> 📄 **文档版本**: v1.1 (含审计报告) | **审计时间**: 2026-05-28
>
> ⚠️ **重要提示**: 本文档已包含真实实现状态审计，请结合第 11 章阅读其他章节。
>
> 🌱 *EcoMind OS — 生态，自此思考。*
