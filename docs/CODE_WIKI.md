# EcoMind OS Code Wiki

## 目录

1. [项目概述](#1-项目概述)
2. [项目架构](#2-项目架构)
3. [主要模块职责](#3-主要模块职责)
4. [关键类与函数说明](#4-关键类与函数说明)
5. [依赖关系](#5-依赖关系)
6. [项目运行方式](#6-项目运行方式)
7. [API接口文档](#7-api接口文档)
8. [前端组件结构](#8-前端组件结构)

---

## 1. 项目概述

### 1.1 项目简介

**EcoMind OS** 是一个全栈 AI Agent 智能管理平台，核心理念为"会思考的生态大脑"（A Thinking Ecological Brain）。项目融合了生态智能、Agent 编排、安全治理、记忆系统和政务集成等核心能力。

### 1.2 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| **前端框架** | React | 18.3.1 |
| **前端构建** | Vite | 6.1.0 |
| **前端UI库** | Ant Design | 5.24.0 |
| **后端框架** | FastAPI | 最新 |
| **Agent核心** | Taiji Agent | 2.0 |
| **状态管理** | Zustand | 5.0.3 |
| **地理可视化** | Cesium | 1.127.0 |
| **图表库** | ECharts | 5.6.0 |
| **3D渲染** | Deck.gl | 9.1.8 |

### 1.3 核心特性

- **多模态 Agent 管理**：4类Agent角色、5级权限体系、人在环路(HITL)
- **工作流编排**：LangGraph + CrewAI 双引擎
- **安全治理**：六层 VERIFY 验证 + 多层安全防护链
- **四层记忆系统**：Hermes + Mem0 + Graphiti + GraphRAG
- **政务集成**：GOVMCP 政务模型协作协议（SM2/SM3/SM4 国密算法）
- **模型路由**：LiteLLM Proxy 支持多模型智能路由

---

## 2. 项目架构

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                          EcoMind OS                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌─────────────────────┐      ┌─────────────────────────────────┐  │
│  │    Frontend         │      │    Backend                       │  │
│  │    (React + Vite)   │      │    (FastAPI + Taiji Agent)       │  │
│  │                     │      │                                   │  │
│  │  - Pages/          │      │  - API Routes/                   │  │
│  │  - Components/     │◄────►│    - agents                      │  │
│  │  - Store/          │      │    - workflows                    │  │
│  │  - Services/       │      │    - security                     │  │
│  │  - Hooks/          │      │    - models                       │  │
│  │                     │      │                                   │  │
│  │  ┌───────────────┐ │      │  ┌─────────────────────────────┐ │  │
│  │  │ WebSocket     │ │      │  │ WebSocket Manager           │ │  │
│  │  │ Client       │ │◄────►│  │                             │ │  │
│  │  └───────────────┘ │      │  └─────────────────────────────┘ │  │
│  └─────────────────────┘      └─────────────────────────────────┘  │
│                                       │                              │
│                              ┌────────▼────────┐                    │
│                              │ Taiji Agent 2.0 │                    │
│                              │                 │                    │
│                              │ ┌─────────────┐ │                    │
│                              │ │ Agent Engine│ │                    │
│                              │ └─────────────┘ │                    │
│                              │ ┌─────────────┐ │                    │
│                              │ │ GovMCP      │ │                    │
│                              │ └─────────────┘ │                    │
│                              │ ┌─────────────┐ │                    │
│                              │ │ Workflow    │ │                    │
│                              │ └─────────────┘ │                    │
│                              │ ┌─────────────┐ │                    │
│                              │ │ Guardrails  │ │                    │
│                              │ └─────────────┘ │                    │
│                              └─────────────────┘                    │
│                                       │                              │
│                              ┌────────▼────────┐                    │
│                              │ LiteLLM Proxy   │                    │
│                              │ (模型路由)       │                    │
│                              └─────────────────┘                    │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 目录结构

```
EcoMind OS/
├── backend/                           # FastAPI 后端
│   ├── api/                          # API 路由层
│   │   ├── main.py                   # FastAPI 应用入口
│   │   ├── routers/                  # 路由模块
│   │   │   ├── agents.py             # Agent CRUD 路由
│   │   │   ├── workflows.py          # 工作流路由
│   │   │   ├── security.py           # 安全路由
│   │   │   └── models.py             # 模型路由
│   │   ├── services/                 # 业务逻辑层
│   │   │   ├── agent_service.py      # Agent 服务
│   │   │   ├── workflow_service.py   # 工作流服务
│   │   │   ├── security_service.py   # 安全服务
│   │   │   └── model_service.py      # 模型服务
│   │   ├── schemas/                  # Pydantic 数据模型
│   │   │   ├── agent.py             # Agent 数据模型
│   │   │   ├── workflow.py           # 工作流数据模型
│   │   │   ├── security.py           # 安全数据模型
│   │   │   └── model.py             # 模型数据模型
│   │   └── websocket/               # WebSocket 管理
│   │       └── manager.py            # WebSocket 管理器
│   │
│   ├── taiji-agent/                  # Taiji Agent 2.0 核心
│   │   └── src/taiji_agent/
│   │       ├── agent/                # Agent 引擎核心
│   │       │   └── engine.py         # TaijiAgent 主类
│   │       ├── workflow/             # 工作流引擎
│   │       │   ├── engine.py         # WorkflowEngine 主类
│   │       │   └── graph.py         # 状态图定义
│   │       ├── govmcp/               # 政务MCP协议
│   │       │   ├── server.py         # GovMCPServer 主类
│   │       │   ├── crypto.py         # 国密加密
│   │       │   ├── workflow.py       # 审批工作流
│   │       │   └── tools.py          # 政务工具
│   │       ├── guardrails/           # 安全护栏
│   │       │   ├── core.py          # 护栏核心
│   │       │   ├── input_guardrail.py # 输入护栏
│   │       │   └── output_guardrail.py # 输出护栏
│   │       ├── hitl/                 # 人机协作
│   │       │   ├── approval.py       # 审批队列
│   │       │   ├── checkpoint.py     # 断点管理
│   │       │   └── confidence.py     # 置信度门控
│   │       ├── mcp/                 # MCP协议
│   │       │   ├── client.py        # MCP客户端
│   │       │   ├── server.py        # MCP服务端
│   │       │   └── protocol.py      # 协议定义
│   │       ├── providers/            # LLM提供商
│   │       │   ├── base.py          # 基类
│   │       │   ├── anthropic.py     # Anthropic
│   │       │   ├── openai.py        # OpenAI
│   │       │   └── chinese/         # 国产模型
│   │       │       ├── qwen.py      # 通义千问
│   │       │       ├── glm.py       # 智谱GLM
│   │       │       ├── kimi.py      # Kimi
│   │       │       └── doubao.py     # 豆包
│   │       ├── memory/              # 记忆系统
│   │       │   └── session.py       # 会话记忆
│   │       ├── memory_tree/         # 三层记忆树
│   │       │   ├── tree.py          # 记忆树主类
│   │       │   └── storage/         # 存储后端
│   │       ├── skills/              # 技能系统
│   │       │   └── hub.py           # 技能中心
│   │       ├── souls/               # 人格系统
│   │       │   └── loader.py        # Soul加载器
│   │       ├── taiji_verify/        # 防幻觉验证
│   │       │   ├── verifier.py      # 验证器
│   │       │   └── plugins/         # 验证插件
│   │       ├── wfgy/                # WFGY防幻觉
│   │       │   └── verifier.py      # 验证核心
│   │       ├── events/              # 事件总线
│   │       │   └── bus.py           # EventBus
│   │       ├── multiagent/          # 多智能体
│   │       │   └── coordinator.py   # 协调器
│   │       ├── observability/        # 可观测性
│   │       │   ├── tracing.py       # 追踪
│   │       │   └── exporter.py      # 导出器
│   │       ├── code/                # 代码代理
│   │       │   ├── executor.py      # 执行器
│   │       │   └── sandbox.py      # 沙箱
│   │       ├── visual/              # 可视化
│   │       │   └── export.py        # 导出器
│   │       ├── desktop/             # 桌面系统
│   │       │   ├── main.py         # 桌面入口
│   │       │   ├── window.py        # 窗口管理
│   │       │   ├── chat_view.py     # 聊天视图
│   │       │   ├── mascot/          # 吉祥物
│   │       │   └── voice/           # 语音
│   │       └── cli/                 # 命令行
│   │           └── main.py         # CLI入口
│   │
│   ├── inference/                    # 推理引擎配置
│   │   ├── adapter.py              # vLLM/SGLang适配器
│   │   ├── config.yaml             # 模型映射配置
│   │   ├── start_sglang.sh         # SGLang启动脚本
│   │   └── start_vllm.sh           # vLLM启动脚本
│   │
│   ├── litellm-proxy/               # LiteLLM代理
│   │   ├── config/config.yaml      # 代理配置
│   │   └── start_proxy.py          # 启动脚本
│   │
│   └── vllm/                        # vLLM部署
│       └── docker-compose.yml       # Docker编排
│
├── frontend/                         # React前端
│   ├── src/
│   │   ├── pages/                  # 页面组件
│   │   │   ├── Dashboard/         # 总览页
│   │   │   ├── Agents/            # Agent管理
│   │   │   ├── Workflows/          # 工作流编排
│   │   │   ├── Security/          # 安全治理
│   │   │   ├── Models/             # 模型管理
│   │   │   ├── Domains/           # 业务域配置
│   │   │   ├── Conversations/     # 对话审计
│   │   │   ├── Cesium/            # 3D地图场景
│   │   │   ├── Chat/              # 聊天界面
│   │   │   └── Settings/          # 系统设置
│   │   ├── components/            # 公共组件
│   │   │   ├── Sidebar/           # 侧边栏
│   │   │   └── ArtifactPanel/      # 工件面板
│   │   ├── layouts/               # 布局组件
│   │   │   ├── MainLayout.tsx     # 主布局
│   │   │   ├── ChatLayout.tsx     # 聊天布局
│   │   │   └── AdminLayout.tsx    # 管理布局
│   │   ├── store/                 # Zustand状态管理
│   │   │   ├── appStore.ts        # 应用状态
│   │   │   ├── chatStore.ts       # 聊天状态
│   │   │   ├── agentStore.ts      # Agent状态
│   │   │   └── artifactStore.ts   # 工件状态
│   │   ├── services/              # API服务层
│   │   │   ├── api.ts            # API封装
│   │   │   ├── chatApi.ts        # 聊天API
│   │   │   └── types.ts          # 类型定义
│   │   ├── hooks/                 # 自定义Hooks
│   │   │   └── useWebSocket.ts   # WebSocket Hook
│   │   ├── providers/             # React Providers
│   │   │   └── WebSocketProvider.tsx # WebSocket提供者
│   │   ├── locales/               # 国际化
│   │   │   ├── zh-CN.json        # 中文
│   │   │   └── en-US.json        # 英文
│   │   ├── router/               # 路由配置
│   │   │   └── index.tsx         # 路由定义
│   │   ├── theme/                # 主题配置
│   │   │   └── index.tsx         # Ant Design主题
│   │   ├── types/                # 类型定义
│   │   │   ├── chat.ts
│   │   │   ├── agent.ts
│   │   │   └── artifact.ts
│   │   ├── App.tsx               # 应用入口
│   │   ├── main.tsx              # 主入口
│   │   └── index.css             # 全局样式
│   ├── package.json              # 依赖配置
│   ├── vite.config.ts            # Vite配置
│   └── tsconfig.json             # TypeScript配置
│
├── docs/                          # 设计文档
│   ├── class-diagram.mermaid     # 类图
│   └── sequence-diagram.mermaid  # 时序图
│
├── VI/                           # 品牌视觉识别
│   ├── EcoMind_OS_VI_Brand_Manual.md
│   └── overview.md
│
├── deliverables/                  # 交付物
├── agent-prompts-collection/      # Agent提示词集合
└── README.md                     # 项目说明
```

---

## 3. 主要模块职责

### 3.1 前端模块

#### 3.1.1 页面模块 (Pages)

| 页面 | 路径 | 职责 |
|------|------|------|
| Dashboard | `/admin/dashboard` | 总览页，展示KPI统计、Agent状态、安全事件、待审批队列 |
| Agents | `/admin/agents` | Agent管理，创建、配置、监控Agent实例 |
| Workflows | `/admin/workflows` | 工作流编排，可视化工作流设计与执行 |
| Security | `/admin/security` | 安全治理，审批队列、审计日志、安全事件 |
| Models | `/admin/models` | 模型管理，模型路由、健康检查、配置 |
| Domains | `/admin/domains` | 业务域配置，环保、碳排放等业务场景 |
| Conversations | `/admin/audit` | 对话审计，记录和回放Agent对话 |
| Cesium | `/map` | 3D地图场景，湖南省地形、监测站点叠加 |
| Chat | `/chat` | 主聊天界面，三栏式布局 |
| Settings | `/settings` | 系统设置，主题、语言等配置 |

#### 3.1.2 组件模块 (Components)

| 组件 | 职责 |
|------|------|
| Sidebar | 应用侧边栏，包含导航菜单、会话列表、专家列表、技能菜单 |
| ArtifactPanel | 工件面板，展示任务列表、通知列表 |
| WsStatusIndicator | WebSocket连接状态指示器 |

#### 3.1.3 状态管理 (Store)

| Store | 职责 |
|-------|------|
| appStore | 全局应用状态：主题、语言、用户偏好 |
| chatStore | 聊天状态：消息列表、会话管理 |
| agentStore | Agent状态：Agent列表、选中Agent |
| artifactStore | 工件状态：生成的艺术品、代码片段 |

### 3.2 后端模块

#### 3.2.1 API层

| 路由 | 文件 | 职责 |
|------|------|------|
| /api/agents | agents.py | Agent CRUD、状态管理、消息发送 |
| /api/workflows | workflows.py | 工作流创建、执行、监控 |
| /api/security | security.py | 安全事件、审批流程、审计日志 |
| /api/models | models.py | 模型列表、健康检查、路由配置 |
| /ws | websocket_endpoint | WebSocket实时通信 |

#### 3.2.2 服务层

| 服务 | 职责 |
|------|------|
| AgentService | Agent生命周期管理，调用TaijiAgent执行任务 |
| WorkflowService | 工作流编排，管理状态图执行 |
| SecurityService | 安全事件处理，审批流程管理 |
| ModelService | 模型路由，负载均衡 |

#### 3.2.3 Taiji Agent核心模块

| 模块 | 职责 |
|------|------|
| Agent Engine | Agent Loop核心，任务执行、防幻觉验证 |
| Workflow Engine | 状态机工作流，节点编排、条件路由 |
| GovMCP | 政务合规协议，SM2/SM3/SM4国密加密 |
| Guardrails | 安全护栏，输入/输出内容审核 |
| HITL | 人机协作，审批队列、置信度门控 |
| Memory | 记忆系统，会话记忆、知识图谱 |
| Providers | LLM提供商适配器 |

---

## 4. 关键类与函数说明

### 4.1 前端关键类型

#### 4.1.1 API服务类型 (services/types.ts)

```typescript
// Agent相关类型
interface AgentCreateRequest {
  name: string;
  description?: string;
  provider: 'openai' | 'anthropic' | 'qwen' | 'glm' | 'kimi' | 'deepseek' | 'yi';
  model: string;
  soul?: string;
  temperature?: number;
  max_tokens?: number;
  max_iterations?: number;
  taiji_verify_enabled?: boolean;
  tools?: string[];
  metadata?: Record<string, unknown>;
}

interface AgentResponse {
  agent_id: string;
  name: string;
  description: string;
  status: 'running' | 'paused' | 'stopped' | 'error';
  provider: string;
  model: string;
  soul: string;
  temperature: number;
  max_tokens: number;
  max_iterations: number;
  taiji_verify_enabled: boolean;
  tools: string[];
  created_at: string;
  updated_at: string;
}

// 工作流相关类型
interface WorkflowCreateRequest {
  name: string;
  description?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  config?: WorkflowConfig;
}

interface WorkflowExecuteRequest {
  initial_state?: Record<string, unknown>;
}
```

#### 4.1.2 聊天类型 (types/chat.ts)

```typescript
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

interface Session {
  id: string;
  title: string;
  messages: Message[];
  created_at: number;
  updated_at: number;
}
```

### 4.2 后端关键类

#### 4.2.1 Agent Engine (taiji_agent/agent/engine.py)

**TaijiAgent** - Agent执行核心类

| 属性 | 类型 | 说明 |
|------|------|------|
| config | AgentConfig | Agent配置 |
| provider | LLMProvider | LLM提供商 |
| event_bus | EventBus | 事件总线 |
| taiji_verifier | TaijiVerifier | 防幻觉验证器 |
| hallucination_detector | HallucinationDetector | 幻觉检测器 |
| memory | SessionMemory | 会话记忆 |
| tools | ToolRegistry | 工具注册表 |

| 方法 | 说明 |
|------|------|
| `run(task: str, system_message?: str) -> TaskResult` | 同步执行任务 |
| `stream_run(task: str) -> AsyncGenerator[str]` | 流式执行任务 |
| `_build_system_prompt() -> str` | 构建系统提示 |
| `_verify_and_annotate(response) -> Any` | 验证并注解响应 |
| `get_event_bus() -> EventBus` | 获取事件总线 |
| `get_memory() -> SessionMemory` | 获取记忆 |

**AgentConfig** - Agent配置数据类

```python
@dataclass
class AgentConfig:
    provider: str = "anthropic"           # LLM提供商
    model: str = "claude-sonnet-4-20250514"  # 模型名称
    api_key: str | None = None            # API密钥
    base_url: str | None = None          # 自定义API地址
    soul: str = "default"                 # 人格标识
    temperature: float = 0.7             # 生成温度
    max_tokens: int = 4096               # 最大token数
    max_iterations: int = 25             # 最大迭代次数
    taiji_verify_enabled: bool = True   # 启用防幻觉验证
    taiji_verify_threshold: float = 0.7 # 验证阈值
    self_consistency_samples: int = 3   # 自一致性采样数
    stream: bool = True                  # 流式输出
```

**TaskResult** - 任务执行结果

```python
@dataclass
class TaskResult:
    status: TaskStatus                   # 任务状态
    content: str | None = None          # 执行结果内容
    error: str | None = None            # 错误信息
    iterations: int = 0                 # 迭代次数
    tools_used: list[str] = field(default_factory=list)  # 使用的工具
    verify_blocked: int = 0             # 被验证拦截次数
    hallucination_risk: float = 0.0     # 幻觉风险值
```

#### 4.2.2 Workflow Engine (taiji_agent/workflow/engine.py)

**WorkflowEngine** - 工作流执行引擎

| 方法 | 说明 |
|------|------|
| `add_node(name, func)` | 添加工作流节点 |
| `add_edge(source, target)` | 添加节点边 |
| `add_conditional_edges(source, conditions, default)` | 添加条件边 |
| `interrupt_at(node_names)` | 设置中断节点 |
| `run(initial_state?, start_node?) -> WorkflowState` | 执行工作流 |
| `resume(state?) -> WorkflowState` | 从中断点恢复执行 |
| `get_state() -> WorkflowState` | 获取当前状态 |
| `visualize_mermaid() -> str` | 生成Mermaid图 |

**WorkflowState** - 工作流状态

```python
@dataclass
class WorkflowState:
    current_node: str                    # 当前节点
    history: list[dict] = field(default_factory=list)  # 执行历史
    metadata: dict = field(default_factory=dict)        # 元数据
    errors: list[str] = field(default_factory=list)    # 错误列表
    checkpoint_id: str | None = None     # 检查点ID
```

#### 4.2.3 GovMCP Server (taiji_agent/govmcp/server.py)

**GovMCPServer** - 政务MCP服务器

| 方法 | 说明 |
|------|------|
| `initialize() -> dict` | 初始化服务器 |
| `get_tools() -> list[dict]` | 获取工具列表 |
| `call_tool(tool_name, arguments) -> str` | 调用工具 |

**提供的政务工具**：

| 工具名称 | 说明 |
|----------|------|
| `sm3_hash` | SM3哈希算法 |
| `sm4_encrypt/decrypt` | SM4对称加密/解密 |
| `sm2_encrypt/decrypt` | SM2公钥加密/解密 |
| `sm2_generate_keypair` | SM2密钥对生成 |
| `approval_create` | 创建审批请求 |
| `approval_submit` | 提交审批 |
| `approval_approve` | 审批通过 |
| `approval_reject` | 审批拒绝 |
| `approval_status` | 查询审批状态 |
| `audit_log` | 记录审计日志 |
| `audit_query` | 查询审计日志 |
| `audit_verify` | 验证审计链 |
| `mask_id_number` | 身份证号脱敏 |
| `mask_phone` | 手机号脱敏 |
| `mask_bank_card` | 银行卡号脱敏 |
| `validate_id_number` | 身份证号验证 |
| `validate_credit_code` | 统一社会信用代码验证 |
| `calculate_workday` | 工作日计算 |

#### 4.2.4 WebSocket Manager (api/websocket/manager.py)

**WebSocketManager** - WebSocket连接管理器

| 方法 | 说明 |
|------|------|
| `connect(websocket, client_id?) -> str` | 接受连接 |
| `disconnect(client_id)` | 断开连接 |
| `disconnect_all()` | 断开所有连接 |
| `subscribe(client_id, topic)` | 订阅主题 |
| `unsubscribe(client_id, topic)` | 取消订阅 |
| `broadcast_to_topic(topic, data) -> int` | 广播到主题 |
| `broadcast_all(data) -> int` | 广播到所有客户端 |
| `send_to_client(client_id, data) -> bool` | 发送到指定客户端 |
| `enqueue_broadcast(topic, data)` | 入队广播 |
| `get_stats() -> dict` | 获取统计信息 |

**支持的主题**：

| 主题 | 说明 |
|------|------|
| `agent:status` | Agent状态变化 |
| `security:alert` | 安全告警 |
| `approval:notification` | 审批通知 |
| `workflow:progress` | 工作流进度 |

#### 4.2.5 Agent Service (api/services/agent_service.py)

**AgentService** - Agent业务逻辑服务

| 方法 | 说明 |
|------|------|
| `create_agent(request) -> AgentResponse` | 创建Agent |
| `list_agents(status?, provider?, limit?, offset?) -> AgentListResponse` | 列出Agent |
| `get_agent(agent_id) -> AgentResponse` | 获取Agent详情 |
| `update_status(agent_id, request) -> AgentResponse` | 更新Agent状态 |
| `send_message(agent_id, request) -> AgentMessageResponse` | 发送消息 |
| `agent_exists(agent_id) -> bool` | 检查Agent是否存在 |

---

## 5. 依赖关系

### 5.1 前端依赖 (frontend/package.json)

```json
{
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.28.2",
    "antd": "^5.24.0",
    "@ant-design/icons": "^5.6.1",
    "@ant-design/pro-components": "^2.8.6",
    "@ant-design/pro-layout": "^7.21.3",
    "echarts": "^5.6.0",
    "echarts-for-react": "^3.0.2",
    "cesium": "^1.127.0",
    "@deck.gl/core": "^9.1.8",
    "@deck.gl/geo-layers": "^9.1.8",
    "@deck.gl/layers": "^9.1.8",
    "@turf/turf": "^7.1.0",
    "i18next": "^24.2.3",
    "react-i18next": "^15.4.1",
    "socket.io-client": "^4.8.1",
    "zustand": "^5.0.3"
  },
  "devDependencies": {
    "typescript": "^5.7.3",
    "vite": "^6.1.0",
    "@vitejs/plugin-react": "^4.3.4",
    "tailwindcss": "^4.1.7",
    "@tailwindcss/vite": "^4.1.7",
    "vite-plugin-cesium": "^1.2.23",
    "eslint": "^9.20.0"
  }
}
```

### 5.2 后端依赖 (backend/taiji-agent/pyproject.toml)

```toml
[project]
dependencies = [
    "openai>=1.50.0,<2.0.0",
    "anthropic>=0.40.0,<1.0.0",
    "pydantic>=2.10.0,<3.0.0",
    "pyyaml>=6.0.2,<7.0.0",
    "rich>=13.9.0,<14.0.0",
    "httpx>=0.28.0,<1.0.0",
    "tenacity>=9.0.0,<10.0.0",
    "python-dotenv>=1.0.0,<2.0.0",
    "jinja2>=3.1.0,<4.0.0",
    "fire>=0.7.0,<1.0.0",
    "exa-py>=2.9.0,<3.0.0",
    "firecrawl-py>=4.16.0,<5.0.0",
    "tabulate>=0.9.0,<1.0.0",
    "tiktoken>=0.8.0,<1.0.0",
    "watchdog>=6.0.0,<7.0.0",
    "click>=8.1.0,<9.0.0",
    "typer>=0.14.0,<1.0.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.3.0,<9.0.0",
    "pytest-asyncio>=0.24.0,<1.0.0",
    "ruff>=0.8.0,<1.0.0",
    "mypy>=1.14.0,<2.0.0",
]
messaging = [
    "python-telegram-bot>=22.6,<23.0",
    "discord.py>=2.7.0,<3.0.0",
    "slack-sdk>=3.27.0,<4.0.0",
]
voice = [
    "edge-tts>=7.0.0,<8.0.0",
    "faster-whisper>=1.0.0,<2.0.0",
]
browser = [
    "playwright>=1.48.0,<2.0.0",
    "selenium>=4.25.0,<5.0.0",
]
memory = [
    "aiosqlite>=0.20.0,<1.0.0",
]
desktop = [
    "PyQt6>=6.8.0,<7.0.0",
    "lottie>=0.7.0,<0.8.0",
]
all = [
    "taiji_agent[dev,messaging,voice,browser,tokenjuice,memory,desktop]",
]
```

### 5.3 模块依赖关系图

```
┌────────────────────────────────────────────────────────────────────┐
│                         依赖层级图                                   │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   [Frontend]                                                        │
│       │                                                             │
│       ├──► [Ant Design]                                             │
│       ├──► [Zustand]                                                │
│       ├──► [Socket.IO Client]                                       │
│       ├──► [ECharts]                                                │
│       ├──► [Cesium]                                                 │
│       └──► [i18next]                                                │
│                                                                     │
│   [Backend API]                                                     │
│       │                                                             │
│       ├──► [FastAPI]                                                │
│       ├──► [Pydantic]                                               │
│       └──► [Taiji Agent]                                            │
│               │                                                      │
│               ├──► [OpenAI/Anthropic]                               │
│               ├──► [LangGraph] (optional)                          │
│               ├──► [CrewAI] (optional)                              │
│               └──► [LiteLLM] (optional)                             │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

---

## 6. 项目运行方式

### 6.1 前端运行

```bash
# 进入前端目录
cd frontend

# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev
# 默认访问 http://localhost:5173

# 构建生产版本
pnpm build

# 代码检查
pnpm lint

# 代码格式化
pnpm format
```

### 6.2 后端运行

```bash
# 进入Taiji Agent目录
cd backend/taiji-agent

# 创建虚拟环境
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate   # Windows

# 安装依赖
pip install -e ".[dev]"

# 运行测试
pytest tests/

# 启动API服务
cd backend/api
uvicorn main:app --reload --port 8000
```

### 6.3 推理引擎运行（可选）

```bash
# vLLM部署
cd backend/vllm
docker-compose up -d

# SGLang部署
cd backend/inference
bash start_sglang.sh
```

### 6.4 环境变量配置

```bash
# .env 文件
# LLM API Keys
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# 国产模型 Keys
DASHSCOPE_API_KEY=...      # 通义千问
ZHIPU_API_KEY=...          # 智谱GLM
MOONSHOT_API_KEY=...       # Kimi
DOUBAO_API_KEY=...         # 豆包
```

---

## 7. API接口文档

### 7.1 Agent API

#### 创建Agent
```
POST /api/agents/
Content-Type: application/json

Request Body:
{
  "name": "政务助手",
  "description": "政务审批流程智能助手",
  "provider": "qwen",
  "model": "qwen-max",
  "soul": "gov-assistant",
  "temperature": 0.7,
  "max_tokens": 4096,
  "max_iterations": 25,
  "taiji_verify_enabled": true
}

Response (201):
{
  "agent_id": "uuid",
  "name": "政务助手",
  "status": "stopped",
  "provider": "qwen",
  "model": "qwen-max",
  ...
}
```

#### 列出Agent
```
GET /api/agents/?status=running&provider=qwen&limit=100&offset=0

Response:
{
  "agents": [...],
  "total": 10
}
```

#### 获取Agent详情
```
GET /api/agents/{agent_id}

Response:
{
  "agent_id": "uuid",
  "name": "政务助手",
  "status": "running",
  ...
}
```

#### 更新Agent状态
```
PUT /api/agents/{agent_id}/status
Content-Type: application/json

Request Body:
{
  "status": "running"  // running, paused, stopped
}

Response:
{
  "agent_id": "uuid",
  "status": "running",
  ...
}
```

#### 发送消息给Agent
```
POST /api/agents/{agent_id}/message
Content-Type: application/json

Request Body:
{
  "message": "帮我分析这个环保案件",
  "system_message": null,
  "stream": false
}

Response:
{
  "agent_id": "uuid",
  "message": "根据您提供的案件信息...",
  "iterations": 3,
  "tools_used": ["web_search", "file_read"],
  "hallucination_risk": 0.15,
  "status": "completed"
}
```

### 7.2 Workflow API

#### 创建工作流
```
POST /api/workflows/
Content-Type: application/json

Request Body:
{
  "name": "环保审批流程",
  "description": "环保案件三级审批流程",
  "nodes": [
    {"id": "start", "type": "start"},
    {"id": "review", "type": "agent", "config": {...}},
    {"id": "approve", "type": "approval", "config": {...}},
    {"id": "end", "type": "end"}
  ],
  "edges": [
    {"source": "start", "target": "review"},
    {"source": "review", "target": "approve"},
    {"source": "approve", "target": "end"}
  ]
}
```

#### 执行工作流
```
POST /api/workflows/{workflow_id}/execute
Content-Type: application/json

Request Body:
{
  "initial_state": {
    "case_id": "case-001",
    "department": "环保部门"
  }
}
```

### 7.3 Security API

#### 安全事件列表
```
GET /api/security/events?event_type=guardrail&severity=high&limit=100

Response:
{
  "events": [
    {
      "event_id": "uuid",
      "event_type": "guardrail",
      "severity": "high",
      "description": "输入内容触发安全护栏",
      "timestamp": "2024-01-15T10:30:00Z",
      "resolved": false
    }
  ],
  "total": 25
}
```

#### 审批队列
```
GET /api/security/approvals?status=pending&department=环保部门

Response:
{
  "approvals": [
    {
      "approval_id": "uuid",
      "title": "某企业排污许可申请",
      "requester": "user-001",
      "department": "环保部门",
      "status": "pending",
      "current_step": 1,
      "created_at": "2024-01-15T09:00:00Z"
    }
  ],
  "total": 5
}
```

#### 审批通过/驳回
```
POST /api/security/approvals/{approval_id}/approve
Content-Type: application/json

Request Body:
{
  "approver_id": "approver-001",
  "comment": "同意该申请"
}

POST /api/security/approvals/{approval_id}/reject
Content-Type: application/json

Request Body:
{
  "approver_id": "approver-001",
  "comment": "材料不完整，请补充"
}
```

### 7.4 WebSocket API

#### 连接
```
WebSocket /ws
```

#### 客户端发送消息
```json
// 订阅主题
{"action": "subscribe", "topic": "agent:status"}

// 取消订阅
{"action": "unsubscribe", "topic": "agent:status"}

// 心跳
{"action": "ping"}
```

#### 服务端推送消息
```json
// Agent状态变化
{
  "topic": "agent:status",
  "data": {
    "agent_id": "uuid",
    "old_status": "stopped",
    "new_status": "running",
    "name": "政务助手"
  },
  "timestamp": 1705312200
}

// 安全告警
{
  "topic": "security:alert",
  "data": {
    "event_id": "uuid",
    "severity": "high",
    "description": "检测到异常行为"
  },
  "timestamp": 1705312200
}
```

---

## 8. 前端组件结构

### 8.1 路由配置 (router/index.tsx)

```typescript
// 主路由结构
const router = createBrowserRouter([
  {
    path: '/',
    element: <ChatLayout />,         // 聊天界面布局
    children: [
      { path: 'chat', element: <ChatPage /> },
      { path: 'chat/:sessionId', element: <ChatPage /> },
    ],
  },
  {
    path: '/map',
    element: <CesiumPage />,          // 全屏地图
  },
  {
    path: '/admin',
    element: <AdminLayout />,         // 管理后台布局
    children: [
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'agents', element: <AgentsPage /> },
      { path: 'workflows', element: <WorkflowsPage /> },
      { path: 'security', element: <SecurityPage /> },
      { path: 'models', element: <ModelsPage /> },
      { path: 'domains', element: <DomainsPage /> },
      { path: 'audit', element: <ConversationsPage /> },
      { path: 'cesium', element: <CesiumPage /> },
    ],
  },
]);
```

### 8.2 API服务封装 (services/api.ts)

```typescript
// 基础请求方法
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!response.ok) {
    throw new Error(`请求失败 (${response.status})`);
  }
  return response.json();
}

// Agent API
export const agentApi = {
  list: (params?) => request<AgentListResponse>(`/agents/${buildQuery(params)}`),
  create: (data) => request<AgentResponse>('/agents/', { method: 'POST', body: JSON.stringify(data) }),
  get: (id) => request<AgentResponse>(`/agents/${id}`),
  updateStatus: (id, status) => request<AgentResponse>(`/agents/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  sendMessage: (id, msg) => request<AgentMessageResponse>(`/agents/${id}/message`, { method: 'POST', body: JSON.stringify({ message: msg }) }),
};

// Workflow API
export const workflowApi = {
  list: (params?) => request<WorkflowListResponse>(`/workflows/${buildQuery(params)}`),
  create: (data) => request<WorkflowResponse>('/workflows/', { method: 'POST', body: JSON.stringify(data) }),
  execute: (id, data?) => request<WorkflowExecuteResponse>(`/workflows/${id}/execute`, { method: 'POST', body: JSON.stringify(data ?? {}) }),
};

// Security API
export const securityApi = {
  events: (params?) => request<SecurityEventListResponse>(`/security/events${buildQuery(params)}`),
  approvals: (params?) => request<ApprovalListResponse>(`/security/approvals${buildQuery(params)}`),
  approve: (id, data) => request<ApprovalResponse>(`/security/approvals/${id}/approve`, { method: 'POST', body: JSON.stringify(data) }),
  reject: (id, data) => request<ApprovalResponse>(`/security/approvals/${id}/reject`, { method: 'POST', body: JSON.stringify(data) }),
};

// Model API
export const modelApi = {
  list: (params?) => request<ModelListResponse>(`/models/${buildQuery(params)}`),
  health: () => request<ModelHealthResponse>('/models/status'),
  route: (data) => request<ModelRouteResponse>('/models/route', { method: 'POST', body: JSON.stringify(data) }),
};
```

### 8.3 WebSocket Hook (hooks/useWebSocket.ts)

```typescript
export function useWebSocket() {
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map());

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8000/ws');
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (event) => {
      const { topic, data } = JSON.parse(event.data);
      handlersRef.current.get(topic)?.forEach(handler => handler(data));
    };
    wsRef.current = ws;
    return () => ws.close();
  }, []);

  const subscribe = (topic: string, handler: (data: any) => void) => {
    wsRef.current?.send(JSON.stringify({ action: 'subscribe', topic }));
    if (!handlersRef.current.has(topic)) {
      handlersRef.current.set(topic, new Set());
    }
    handlersRef.current.get(topic)!.add(handler);
  };

  return { connected, subscribe };
}
```

### 8.4 状态管理 Store (store/)

#### appStore.ts
```typescript
interface AppState {
  theme: 'light' | 'dark';
  language: 'zh-CN' | 'en-US';
  sidebarCollapsed: boolean;
  setTheme: (theme: 'light' | 'dark') => void;
  setLanguage: (lang: 'zh-CN' | 'en-US') => void;
  toggleSidebar: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  theme: 'light',
  language: 'zh-CN',
  sidebarCollapsed: false,
  setTheme: (theme) => set({ theme }),
  setLanguage: (language) => set({ language }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
}));
```

#### chatStore.ts
```typescript
interface ChatState {
  sessions: Session[];
  currentSessionId: string | null;
  messages: Message[];
  sendMessage: (content: string) => Promise<void>;
  loadSession: (sessionId: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [],
  currentSessionId: null,
  messages: [],
  sendMessage: async (content) => {
    // 发送消息逻辑
  },
  loadSession: (sessionId) => {
    // 加载会话逻辑
  },
}));
```

---

## 附录

### A. 配置参考

#### vite.config.ts
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import cesium from 'vite-plugin-cesium';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), cesium(), tailwindcss()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8000',
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      },
    },
  },
});
```

#### LiteLLM配置 (backend/litellm-proxy/config/config.yaml)
```yaml
model_list:
  - model_name: qwen3-14b
    litellm_params:
      model: openai/qwen/qwen3-14b
      api_base: http://localhost:8000/v1
      api_key: token-xxxx
      rpm: 100

  - model_name: deepseek-671b
    litellm_params:
      model: openai/deepseek/deepseek-671b
      rpm: 50

router_settings:
  num_retries: 3
  timeout: 60
```

### B. 命名规范

- **前端组件**: PascalCase (e.g., `AgentTable.tsx`)
- **前端函数/变量**: camelCase (e.g., `sendMessage`)
- **Python类**: PascalCase (e.g., `TaijiAgent`)
- **Python函数/变量**: snake_case (e.g., `send_message`)
- **API路由**: kebab-case (e.g., `/agent-status`)
- **文件命名**: kebab-case (e.g., `agent-service.py`)

### C. 贡献指南

1. Fork本仓库
2. 创建特性分支：`git checkout -b feature/YourFeature`
3. 提交更改：`git commit -m "feat: 描述你的更改"`
4. 推送到分支：`git push origin feature/YourFeature`
5. 创建Pull Request

---

*本文档由 EcoMind OS 开发团队维护*
*最后更新: 2026-05-26*
