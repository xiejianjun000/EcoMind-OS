# EcoMind OS — 前后端详细设计方案

> **版本：** v1.0  
> **日期：** 2026-06-08  
> **基于：** CODE_WIKI.md + class-diagram.mermaid + sequence-diagram.mermaid + 底层代码分析  
> **作者：** WorkBuddy AI · 架构分析输出

---

## 目录

1. [架构总览](#1-架构总览)
2. [前端详细设计](#2-前端详细设计)
   - 2.1 技术选型与分层
   - 2.2 路由与布局设计
   - 2.3 状态管理设计（Zustand）
   - 2.4 页面模块详细设计
   - 2.5 组件库与设计系统
   - 2.6 WebSocket 客户端设计
   - 2.7 前端 API 服务层设计
3. [后端详细设计](#3-后端详细设计)
   - 3.1 FastAPI 应用入口层
   - 3.2 路由层（Routers）
   - 3.3 服务层（Services）
   - 3.4 Pydantic Schema 层
   - 3.5 WebSocket 管理器
4. [TAIJI-AGENT 核心引擎设计](#4-taiji-agent-核心引擎设计)
   - 4.1 Agent Engine（TaijiAgent Loop）
   - 4.2 WorkflowEngine（状态机编排）
   - 4.3 记忆系统四层架构
   - 4.4 SafetyChain 六层安全链
   - 4.5 HITL 人在环路
   - 4.6 GovMCP 政务协议
   - 4.7 LiteLLM 模型路由
5. [前后端接口契约](#5-前后端接口契约)
   - 5.1 REST API 完整清单
   - 5.2 WebSocket 协议规范
   - 5.3 数据模型 Schema
6. [安全设计](#6-安全设计)
7. [性能与可观测性设计](#7-性能与可观测性设计)
8. [设计系统与 VI 规范](#8-设计系统与-vi-规范)
9. [部署架构](#9-部署架构)
10. [待解决问题与改进建议](#10-待解决问题与改进建议)

---

## 1. 架构总览

### 1.1 四层架构全景图

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          EcoMind OS — 四层架构                                │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                                │
│  ████████████████████████  Layer 1: 前端展示层  ████████████████████████████  │
│                                                                                │
│  React 18 + TypeScript + Vite + Ant Design 5                                  │
│  ├── ChatLayout    ── /chat            (三栏式：侧边栏+对话+工件面板)           │
│  ├── AdminLayout   ── /admin/**        (管理后台：导航+内容区)                 │
│  └── FullPage      ── /map             (全屏 Cesium 3D 地图)                  │
│                                                                                │
│  Zustand Store: appStore | chatStore | agentStore | artifactStore             │
│  Services Layer: agentApi | workflowApi | securityApi | modelApi              │
│  WebSocket: Socket.IO Client ← useWebSocket Hook ← WebSocketProvider         │
│                                                                                │
│  ████████████████████████  Layer 2: API 路由层  ████████████████████████████  │
│                                                                                │
│  FastAPI + Uvicorn                                                             │
│  ├── /api/agents       ── AgentsRouter   (CRUD + 状态机 + 消息)               │
│  ├── /api/workflows    ── WorkflowsRouter (创建 + 执行 + 监控)                │
│  ├── /api/security     ── SecurityRouter  (事件 + 审批队列 + 审计)            │
│  ├── /api/models       ── ModelsRouter    (列表 + 健康检查 + 路由配置)        │
│  └── /ws               ── WebSocket Endpoint (主题订阅推送)                   │
│                                                                                │
│  ████████████████████████  Layer 3: 服务业务层  ████████████████████████████  │
│                                                                                │
│  ├── AgentService      ── TaijiAgent 生命周期管理                             │
│  ├── WorkflowService   ── WorkflowEngine 编排调度                             │
│  ├── SecurityService   ── 安全事件、审批流、审计                               │
│  └── ModelService      ── LiteLLM 路由、负载均衡                              │
│                                                                                │
│  ████████████████████████  Layer 4: TAIJI-AGENT 核心层  ███████████████████  │
│                                                                                │
│  TaijiAgent (engine.py)                                                        │
│  ├── AgentLoop: 最大25次迭代 → 工具调用 → TaijiVerify → 流式输出              │
│  ├── Memory: Hermes(短期) → Mem0(中期) → Graphiti(关联) → GraphRAG(长期)     │
│  ├── SafetyChain: XiangxinGuardrails → NeMo → EcoVerify → Lettuce → Langfuse │
│  ├── Orchestration: LangGraphOrchestrator ↔ CrewAITeamBuilder                │
│  ├── GovMCP: SM2/SM3/SM4 + 三级审批工作流                                     │
│  └── HITL: 置信度门控 + 审批队列 + Checkpoint 断点                            │
│                                                                                │
│                    ↓ LiteLLM Proxy 模型路由层                                 │
│  Qwen3-14B(45%) | DeepSeek-671B(28%) | Qwen3-72B(18%) | GLM-4-9B(9%)        │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 关键数据流时序（核心请求链路）

```
用户输入
   │
   ▼
[前端 Chat/index.tsx]
   │  POST /api/agents/{id}/message  (HTTP) 或 WebSocket stream
   ▼
[FastAPI Gateway — main.py]
   │  CORS 验证 + 路由分发
   ▼
[AgentsRouter — agents.py]
   │  Pydantic 参数校验
   ▼
[AgentService — agent_service.py]
   │  获取/创建 TaijiAgent 实例
   ▼
[SafetyChain 六层过滤]
   ├── XiangxinGuardrails (输入内容审核)
   ├── NeMoGuardrails (规则护栏)
   ├── EcoVerifyAdapter (六层VERIFY验证)
   └── LettuceDetect (幻觉检测前置)
   │
   ▼
[TaijiAgent.run() — engine.py]
   │  Agent Loop (max 25 iterations)
   ├── _build_system_prompt() → Soul + TaijiVerify Prompt 融合
   ├── LLM 调用 (via LiteLLM Proxy)
   ├── 工具执行 (ToolRegistry)
   ├── _verify_and_annotate() → 防幻觉验证
   └── 置信度 < threshold → HITL 触发人工审批
   │
   ▼
[TaskResult 封装]
   ├── status / content / iterations / tools_used
   ├── hallucination_risk / verify_blocked
   └── GovMCP 政务签名 (如需)
   │
   ▼
[AgentService.update_status()]
   │  WebSocket 推送 agent:status 主题
   ▼
[前端 WebSocketProvider]
   └── 实时更新 UI 状态
```

---

## 2. 前端详细设计

### 2.1 技术选型与分层

#### 技术栈确认

| 层级 | 技术 | 版本 | 职责 |
|------|------|------|------|
| 框架 | React | 18.3.1 | 组件化 UI |
| 构建 | Vite | 6.1.0 | 极速 HMR + ESM |
| 类型 | TypeScript | 5.7.3 | 类型安全 |
| UI 库 | Ant Design | 5.24.0 | 管理后台组件 |
| 布局增强 | @ant-design/pro-layout | 7.21.3 | 复杂管理布局 |
| 状态管理 | Zustand | 5.0.3 | 轻量全局状态 |
| 路由 | React Router DOM | 6.28.2 | SPA 路由 |
| WebSocket | Socket.IO Client | 4.8.1 | 双向实时通信 |
| 图表 | ECharts | 5.6.0 | 数据可视化 |
| 地图 | Cesium | 1.127.0 | 3D 地理场景 |
| 3D 叠加 | Deck.gl | 9.1.8 | 空间数据层叠加 |
| 地理计算 | @turf/turf | 7.1.0 | GeoJSON 处理 |
| 国际化 | i18next + react-i18next | 24.2.3 | 中英文切换 |
| 样式 | Tailwind CSS | 4.1.7 | 原子化 CSS |
| 代码规范 | ESLint | 9.20.0 | 代码质量 |

#### 注意事项：技术栈混用问题

> **当前问题（已识别）**：`frontend/src/pages/Chat/index.tsx` 中使用了 shadcn/ui 风格组件（`cn()`、`ScrollArea`、`Avatar`、`Badge`），与其他页面使用的 Ant Design 存在不一致。
>
> **建议**：统一选型，Chat 页面回归 Ant Design 组件，或全局引入 shadcn/ui 替换 Ant Design。当前 MVP 阶段保持现状，需在 Phase 2 统一。

### 2.2 路由与布局设计

#### 路由层次结构

```typescript
// router/index.tsx — 三大路由域

// ① 聊天域（主功能入口）
{
  path: '/',
  element: <ChatLayout />,    // 三栏式布局：侧边栏 | 对话区 | 工件面板
  children: [
    { index: true, redirect: '/chat' },
    { path: 'chat', element: <ChatPage /> },
    { path: 'chat/:sessionId', element: <ChatPage /> },  // 特定会话
  ]
}

// ② 地图域（全屏沉浸式）
{
  path: '/map',
  element: <CesiumPage />     // 无布局包裹，全屏渲染
}

// ③ 管理域（后台运营）
{
  path: '/admin',
  element: <AdminLayout />,   // 侧导航 + 面包屑 + 内容区
  children: [
    { path: 'dashboard',   element: <DashboardPage /> },
    { path: 'agents',      element: <AgentsPage /> },
    { path: 'workflows',   element: <WorkflowsPage /> },
    { path: 'security',    element: <SecurityPage /> },
    { path: 'models',      element: <ModelsPage /> },
    { path: 'domains',     element: <DomainsPage /> },
    { path: 'audit',       element: <ConversationsPage /> },
    { path: 'cesium',      element: <CesiumPage /> },
  ]
}
```

#### 三大布局详细设计

**① ChatLayout（主界面）**

```
┌─────────────────────────────────────────────────────────────┐
│  Sidebar (260px)  │  ChatArea (flex-1)  │  ArtifactPanel (360px) │
│                   │                     │                     │
│  ◎ EcoMind OS     │  ┌─────────────┐   │  [工件面板]          │
│  ─────────────    │  │ 消息气泡区   │   │  ┌───────────────┐  │
│  会话列表          │  │ (滚动区域)   │   │  │ 任务进度卡片   │  │
│  · 环保案件分析    │  │             │   │  │ 审批待办提醒   │  │
│  · 碳排放报告      │  └─────────────┘   │  │ 代码预览块     │  │
│  ─────────────    │  ┌─────────────┐   │  └───────────────┘  │
│  专家列表          │  │ 输入区域     │   │  WsStatusIndicator  │
│  · 许清楚(PM)      │  │ [textarea]  │   │  ● 已连接           │
│  · 高见远(架构)    │  │ [发送按钮]  │   │                     │
│  ─────────────    │  └─────────────┘   │                     │
│  技能菜单          │                     │                     │
└─────────────────────────────────────────────────────────────┘
```

**② AdminLayout（管理后台）**

```
┌─────────────────────────────────────────────────────────────┐
│  ProLayout Header: Logo + 用户头像 + 通知铃 + 语言切换        │
├────────────┬────────────────────────────────────────────────┤
│ 侧导航      │  面包屑: 首页 / Agent管理                       │
│ (200px)    │  ─────────────────────────────────────────────  │
│ ■ 总览     │                                                  │
│ ● Agent管理 │         页面内容区域 (Content)                  │
│ ○ 工作流   │                                                  │
│ ○ 安全治理 │                                                  │
│ ○ 模型管理 │                                                  │
│ ○ 业务域   │                                                  │
│ ○ 对话审计 │                                                  │
└────────────┴────────────────────────────────────────────────┘
```

### 2.3 状态管理设计（Zustand）

#### Store 架构

```typescript
// ① appStore.ts — 全局应用状态
interface AppState {
  theme: 'light' | 'dark';
  language: 'zh-CN' | 'en-US';
  sidebarCollapsed: boolean;
  artifactPanelOpen: boolean;
  wsConnected: boolean;
  // Actions
  setTheme: (theme: 'light' | 'dark') => void;
  setLanguage: (lang: 'zh-CN' | 'en-US') => void;
  toggleSidebar: () => void;
  setWsConnected: (connected: boolean) => void;
}

// ② chatStore.ts — 聊天状态
interface ChatState {
  sessions: Session[];
  currentSessionId: string | null;
  participants: Participant[];  // GAIA、许清楚、寇豆码、高见远
  isStreaming: boolean;
  pendingMessage: string;
  // Actions
  createSession: () => Session;
  selectSession: (id: string) => void;
  addMessage: (sessionId: string, message: Message) => void;
  updateLastMessage: (sessionId: string, delta: string) => void; // 流式更新
  setStreaming: (streaming: boolean) => void;
}

// ③ agentStore.ts — Agent 状态
interface AgentState {
  agents: AgentResponse[];
  selectedAgentId: string | null;
  loading: boolean;
  // Actions
  fetchAgents: () => Promise<void>;
  createAgent: (data: AgentCreateRequest) => Promise<AgentResponse>;
  updateAgentStatus: (id: string, status: AgentStatus) => void; // WS 实时更新
  selectAgent: (id: string) => void;
}

// ④ artifactStore.ts — 工件状态
interface ArtifactState {
  artifacts: Artifact[];  // 代码、图表、文件
  notifications: Notification[];  // 审批通知、告警
  pendingApprovals: number;
  // Actions
  addArtifact: (artifact: Artifact) => void;
  addNotification: (notification: Notification) => void;
  clearNotifications: () => void;
}
```

#### Zustand 中间件策略

```typescript
// 持久化：appStore 持久化到 localStorage（主题、语言偏好）
import { persist } from 'zustand/middleware';

const useAppStore = create<AppState>()(
  persist(
    (set) => ({ /* ... */ }),
    { name: 'ecomind-app-state', partialize: (s) => ({ theme: s.theme, language: s.language }) }
  )
);

// Immer：agentStore / chatStore 使用 immer 简化嵌套更新
import { immer } from 'zustand/middleware/immer';
```

### 2.4 页面模块详细设计

#### Dashboard 页面 (/)

| 区域 | 组件 | 数据来源 |
|------|------|--------|
| KPI 统计卡片 | Ant Design `Statistic` × 4 | `GET /api/agents/stats` |
| Agent 状态分布 | ECharts 饼图 | agentStore.agents |
| 安全事件时间线 | Ant Design `Timeline` | `GET /api/security/events?limit=10` |
| 待审批队列 | Ant Design `Badge + List` | `GET /api/security/approvals?status=pending` |
| 模型健康状态 | 自定义状态指示器 | `GET /api/models/status` + WS `workflow:progress` |

**实时更新策略**：Dashboard 订阅 4 个 WS 主题，任意事件推送后 revalidate 对应数据。

#### Agents 页面 (/admin/agents)

```
操作面板
├── 新建 Agent 按钮 → 抽屉式表单 (Ant Design Drawer)
│   ├── 名称 / 描述
│   ├── Provider 选择 (openai/qwen/glm/kimi/deepseek...)
│   ├── 模型选择 (动态加载对应 provider 的模型列表)
│   ├── Soul 选择 (default/gov-assistant/eco-analyst...)
│   ├── 高级配置折叠面板 (temperature/max_tokens/taiji_verify)
│   └── 工具绑定多选
├── 过滤栏 (状态 + Provider)
└── Agent 卡片网格 / 表格切换
    ├── 实时状态 Badge (running/paused/stopped/error)
    ├── 操作: 启动 | 暂停 | 发消息 | 删除
    └── 点击 → 详情侧边栏 (消息历史 + 性能指标)
```

**状态机设计**：

```
stopped  ──[start]──►  running  ──[pause]──►  paused
   ▲                      │                      │
   └────[stop]────────────┘◄────[resume]──────────┘
                           │
                        [error]
                           │
                         error ──[reset]──► stopped
```

#### Workflows 页面 (/admin/workflows)

| 子区域 | 实现方案 |
|--------|---------|
| 工作流列表 | Ant Design Pro Table，带排序/过滤 |
| 可视化节点编辑器 | 基于 `WorkflowEngine.visualize_mermaid()` 渲染 Mermaid 图 + 自定义节点叠加层 |
| 执行监控 | WebSocket `workflow:progress` 主题实时进度条 |
| 节点详情 | 点击节点弹出抽屉，显示节点输入/输出 JSON |
| 手动触发 | `POST /api/workflows/{id}/execute` + 初始状态编辑器 |

#### Security 页面 (/admin/security)

```
安全治理页面三栏：
┌──────────────────┬────────────────────┬──────────────────┐
│  安全事件列表      │   审批队列          │  审计日志         │
│  severity 过滤   │  待我审批           │  时间范围搜索     │
│  ECharts 趋势图  │  ≥L2 需双因子认证   │  区块链验证状态   │
│  实时 WS 推送    │  L3 会签流程        │  导出 CSV        │
└──────────────────┴────────────────────┴──────────────────┘
```

**审批流 UI 状态机**：

```
pending → [审批人操作] → approved / rejected
             │
           [L2] 需要二次因子验证 (短信/TOTP)
           [L3] 需要多人会签 + 区块链存证
```

#### Chat 页面 (/chat)

**核心数据结构**（基于代码分析）：

```typescript
interface Participant {
  id: string;
  name: string;     // 'GAIA' | '许清楚' | '寇豆码' | '高见远'
  role: string;     // 'assistant' | 'pm' | 'developer' | 'architect'
  avatar: string;
  color: string;
  agentId?: string; // 关联的后端 Agent ID
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;
  participantId?: string;  // 多 Agent 区分
  metadata?: {
    tools_used?: string[];
    hallucination_risk?: number;
    iterations?: number;
    artifact?: Artifact;   // 附带工件
  };
}
```

**流式输出设计**：

```typescript
// 流式消息处理流程
async function handleStreamMessage(agentId: string, content: string) {
  // 1. 创建占位消息
  const msgId = chatStore.addPlaceholderMessage(sessionId, agentId);
  
  // 2. 流式更新 (SSE 或 WebSocket)
  for await (const delta of agentApi.streamMessage(agentId, content)) {
    chatStore.updateMessageDelta(sessionId, msgId, delta);
  }
  
  // 3. 完成标记
  chatStore.finalizeMessage(sessionId, msgId);
}
```

#### Cesium 3D 地图页面 (/map)

| 功能 | 技术实现 | 数据源 |
|------|---------|-------|
| 湖南省地形底图 | Cesium Terrain Provider | 高程数据服务 |
| 监测站点标注 | Cesium Billboard + Label | `GET /api/domains/stations` |
| 污染扩散热力图 | Deck.gl HeatmapLayer 叠加 Cesium | 实时监测数据 |
| 行政区划 | GeoJSON + @turf/turf 处理 | 本地静态数据 |
| 时间轴动画 | Cesium Clock + CZML | 历史数据回放 |

### 2.5 组件库与设计系统

#### 颜色 Token（基于 VI 手册）

```css
/* 品牌主色 */
--eco-green: #00C9A7;        /* 生态绿：Logo、强调、成功状态 */
--eco-cyan: #0E7490;         /* 智慧青：按钮、标题、UI 组件 */
--eco-deep: #0B1E28;         /* 深空底色：暗色模式背景 */

/* 渐变 */
--eco-gradient: linear-gradient(90deg, #00C9A7, #0E7490, #00C9A7);

/* 功能色 */
--color-success: #00C9A7;    /* 对齐品牌绿 */
--color-warning: #F59E0B;
--color-error: #EF4444;
--color-info: #0E7490;       /* 对齐品牌青 */

/* 中性色 */
--color-bg-base: #F0F4F8;    /* 浅色模式背景 */
--color-text-primary: #0B1E28;
--color-text-secondary: #4A5568;
--color-border: #E2E8F0;
```

#### Ant Design 主题定制

```typescript
// theme/index.tsx
const ecoMindTheme: ThemeConfig = {
  token: {
    colorPrimary: '#00C9A7',
    colorSuccess: '#00C9A7',
    colorInfo: '#0E7490',
    colorWarning: '#F59E0B',
    colorError: '#EF4444',
    borderRadius: 8,
    fontFamily: "'Inter', 'Noto Sans SC', sans-serif",
    fontSize: 14,
  },
  algorithm: theme.defaultAlgorithm,  // 切换为 theme.darkAlgorithm 实现暗色
};
```

#### 公共组件清单

```
components/
├── Sidebar/
│   ├── index.tsx           主侧边栏（会话列表 + 专家列表 + 技能菜单）
│   ├── SessionList.tsx     会话条目
│   ├── ExpertList.tsx      Agent 专家条目
│   └── SkillMenu.tsx       技能快捷入口
│
├── ArtifactPanel/
│   ├── index.tsx           工件面板容器
│   ├── TaskCard.tsx        任务进度卡片
│   ├── NotificationItem.tsx 通知条目
│   └── CodeArtifact.tsx    代码预览块（语法高亮）
│
├── WsStatusIndicator/
│   └── index.tsx           WebSocket 连接状态（● 已连接 / ○ 重连中）
│
├── AgentStatusBadge/       Agent 状态标签（颜色编码）
├── HallucinationRiskMeter/ 幻觉风险值可视化（进度条）
├── ApprovalFlowStepper/    审批流步骤条
└── MermaidRenderer/        Mermaid 图渲染器（工作流可视化）
```

### 2.6 WebSocket 客户端设计

#### 连接架构

```
WebSocketProvider (React Context)
    │
    ├── socket = io('ws://api-host/ws', { autoConnect: true, reconnection: true })
    │
    ├── useEffect: 订阅默认主题
    │   ├── socket.emit('subscribe', 'agent:status')
    │   ├── socket.emit('subscribe', 'security:alert')
    │   ├── socket.emit('subscribe', 'approval:notification')
    │   └── socket.emit('subscribe', 'workflow:progress')
    │
    └── 事件处理
        ├── 'agent:status'          → agentStore.updateAgentStatus()
        ├── 'security:alert'        → artifactStore.addNotification()
        ├── 'approval:notification' → artifactStore.setPendingApprovals()
        └── 'workflow:progress'     → workflowStore.updateProgress()
```

#### useWebSocket Hook 设计

```typescript
// hooks/useWebSocket.ts
export function useWebSocket(topics: WsTopic[]) {
  const { socket, connected } = useWebSocketContext();
  
  useEffect(() => {
    // 订阅指定主题
    topics.forEach(t => socket.emit('subscribe', t));
    return () => topics.forEach(t => socket.emit('unsubscribe', t));
  }, [topics]);
  
  // 心跳保活
  useEffect(() => {
    const interval = setInterval(() => socket.emit('ping'), 30_000);
    return () => clearInterval(interval);
  }, []);
  
  return { connected, send: (topic, data) => socket.emit(topic, data) };
}
```

#### 断线重连策略

```typescript
const socket = io(WS_URL, {
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 10000,
  timeout: 20000,
});

socket.on('reconnect_attempt', (attempt) => {
  appStore.setWsConnected(false);
  console.info(`[WS] 重连尝试 ${attempt}/5`);
});

socket.on('reconnect', () => {
  appStore.setWsConnected(true);
  // 重新订阅所有主题
  resubscribeAllTopics();
});
```

### 2.7 前端 API 服务层设计

#### 统一请求封装

```typescript
// services/api.ts
const API_BASE = import.meta.env.VITE_API_BASE || '/api';

async function request<T>(
  path: string, 
  options?: RequestInit & { retries?: number }
): Promise<T> {
  const maxRetries = options?.retries ?? 0;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(`${API_BASE}${path}`, {
        headers: {
          'Content-Type': 'application/json',
          'X-Request-ID': crypto.randomUUID(),    // 请求追踪
          'Accept-Language': appStore.language,   // 国际化头
        },
        ...options,
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new ApiError(response.status, error.detail || '请求失败');
      }
      
      return response.json() as Promise<T>;
    } catch (e) {
      if (attempt === maxRetries) throw e;
      await sleep(1000 * (attempt + 1)); // 指数退避
    }
  }
}

// 统一错误处理
class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
```

#### API 模块清单

```typescript
// agentApi: Agent 生命周期
agentApi.list(params)                    // GET /api/agents/
agentApi.create(data)                    // POST /api/agents/
agentApi.get(id)                         // GET /api/agents/{id}
agentApi.updateStatus(id, status)        // PUT /api/agents/{id}/status
agentApi.sendMessage(id, msg)            // POST /api/agents/{id}/message
agentApi.streamMessage(id, msg)          // POST /api/agents/{id}/message (stream:true)

// workflowApi: 工作流编排
workflowApi.list(params)                 // GET /api/workflows/
workflowApi.create(data)                 // POST /api/workflows/
workflowApi.get(id)                      // GET /api/workflows/{id}
workflowApi.execute(id, initialState)    // POST /api/workflows/{id}/execute
workflowApi.getMermaid(id)               // GET /api/workflows/{id}/mermaid

// securityApi: 安全治理
securityApi.events(params)               // GET /api/security/events
securityApi.approvals(params)            // GET /api/security/approvals
securityApi.approve(id, data)            // POST /api/security/approvals/{id}/approve
securityApi.reject(id, data)             // POST /api/security/approvals/{id}/reject
securityApi.auditLog(params)             // GET /api/security/audit

// modelApi: 模型管理
modelApi.list(params)                    // GET /api/models/
modelApi.health()                        // GET /api/models/status
modelApi.getRouting()                    // GET /api/models/routing
```

---

## 3. 后端详细设计

### 3.1 FastAPI 应用入口层

#### main.py 关键设计

```python
# backend/api/main.py

def create_app() -> FastAPI:
    app = FastAPI(
        title="EcoMind OS API",
        version="2.0.0",
        lifespan=lifespan,           # 启动/关闭生命周期
    )
    
    # CORS 配置
    app.add_middleware(CORSMiddleware,
        allow_origins=["http://localhost:5173"],  # 开发环境
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # 路由注册（4大域）
    app.include_router(agents_router,    prefix="/api/agents",    tags=["agents"])
    app.include_router(workflows_router, prefix="/api/workflows",  tags=["workflows"])
    app.include_router(security_router,  prefix="/api/security",   tags=["security"])
    app.include_router(models_router,    prefix="/api/models",     tags=["models"])
    
    # WebSocket 端点
    @app.websocket("/ws")
    async def websocket_endpoint(websocket: WebSocket):
        client_id = await ws_manager.connect(websocket)
        try:
            while True:
                data = await websocket.receive_json()
                await handle_ws_message(client_id, data)
        except WebSocketDisconnect:
            ws_manager.disconnect(client_id)
    
    return app

# 生命周期管理
@asynccontextmanager
async def lifespan(app: FastAPI):
    # 启动：初始化 WebSocket Manager 后台队列
    asyncio.create_task(ws_manager.process_queue())
    yield
    # 关闭：断开所有 WebSocket 连接
    await ws_manager.disconnect_all()
```

### 3.2 路由层（Routers）

#### agents.py 路由详细设计

```python
# backend/api/routers/agents.py

router = APIRouter()

# 完整路由表
@router.post("/", status_code=201, response_model=AgentResponse)
async def create_agent(request: AgentCreateRequest, service: AgentService = Depends(get_agent_service)):
    """创建新 Agent，初始化 TaijiAgent 实例"""
    return await service.create_agent(request)

@router.get("/", response_model=AgentListResponse)
async def list_agents(
    status: Optional[str] = None,
    provider: Optional[str] = None,
    limit: int = Query(100, le=1000),
    offset: int = Query(0, ge=0),
    service: AgentService = Depends(get_agent_service)
):
    """分页列出 Agent，支持状态/Provider 过滤"""
    return await service.list_agents(status, provider, limit, offset)

@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(agent_id: str, service: AgentService = Depends(get_agent_service)):
    """获取单个 Agent 详情"""
    agent = await service.get_agent(agent_id)
    if not agent:
        raise HTTPException(404, f"Agent {agent_id} 不存在")
    return agent

@router.put("/{agent_id}/status", response_model=AgentResponse)
async def update_agent_status(
    agent_id: str, 
    request: AgentStatusUpdateRequest,
    service: AgentService = Depends(get_agent_service)
):
    """更新 Agent 运行状态，触发 WebSocket 广播"""
    return await service.update_status(agent_id, request)

@router.post("/{agent_id}/message", response_model=AgentMessageResponse)
async def send_message(
    agent_id: str,
    request: AgentMessageRequest,
    service: AgentService = Depends(get_agent_service)
):
    """向 Agent 发送消息，执行 TaijiAgent.run()"""
    return await service.send_message(agent_id, request)

# 统计接口（Dashboard 用）
@router.get("/stats/summary")
async def get_agents_stats(service: AgentService = Depends(get_agent_service)):
    """返回 Agent 统计摘要：总数/状态分布/活跃模型"""
    return await service.get_stats()
```

### 3.3 服务层（Services）

#### AgentService 完整设计

```python
# backend/api/services/agent_service.py

@dataclass
class AgentRecord:
    """运行时 Agent 内存记录"""
    agent_id: str
    agent: TaijiAgent           # TaijiAgent 实例
    config: AgentConfig         # 配置快照
    name: str
    description: str
    status: str                 # running | paused | stopped | error
    created_at: datetime
    updated_at: datetime
    message_count: int = 0
    total_iterations: int = 0

class AgentService:
    def __init__(self, ws_manager: WebSocketManager):
        self._agents: dict[str, AgentRecord] = {}  # 内存存储（MVP阶段）
        self._ws_manager = ws_manager
    
    async def create_agent(self, request: AgentCreateRequest) -> AgentResponse:
        """
        1. 构造 AgentConfig
        2. 初始化 TaijiAgent 实例
        3. 写入内存 Registry
        4. 返回 AgentResponse
        """
        config = AgentConfig(
            provider=request.provider,
            model=request.model,
            soul=request.soul or "default",
            temperature=request.temperature or 0.7,
            max_tokens=request.max_tokens or 4096,
            max_iterations=request.max_iterations or 25,
            taiji_verify_enabled=request.taiji_verify_enabled if request.taiji_verify_enabled is not None else True,
        )
        agent = TaijiAgent(config)
        agent_id = str(uuid4())
        
        self._agents[agent_id] = AgentRecord(
            agent_id=agent_id, agent=agent, config=config,
            name=request.name, description=request.description or "",
            status="stopped", created_at=datetime.utcnow(), updated_at=datetime.utcnow(),
        )
        return self._to_response(self._agents[agent_id])
    
    async def send_message(self, agent_id: str, request: AgentMessageRequest) -> AgentMessageResponse:
        """
        1. 获取 TaijiAgent 实例
        2. 调用 agent.run() 或 agent.stream_run()
        3. 更新 Agent 统计信息
        4. 广播 WebSocket 状态
        """
        record = self._agents.get(agent_id)
        if not record:
            raise ValueError(f"Agent {agent_id} 不存在")
        
        record.status = "running"
        await self._broadcast_status(record)
        
        try:
            result: TaskResult = await asyncio.get_event_loop().run_in_executor(
                None, record.agent.run, request.message, request.system_message
            )
            record.status = "stopped"
            record.message_count += 1
            record.total_iterations += result.iterations
            
            await self._broadcast_status(record)
            return AgentMessageResponse(
                agent_id=agent_id,
                message=result.content,
                iterations=result.iterations,
                tools_used=result.tools_used,
                hallucination_risk=result.hallucination_risk,
                status=result.status.value,
            )
        except Exception as e:
            record.status = "error"
            await self._broadcast_status(record)
            raise
    
    async def _broadcast_status(self, record: AgentRecord):
        """广播 Agent 状态到所有订阅了 agent:status 主题的客户端"""
        self._ws_manager.enqueue_broadcast("agent:status", {
            "agent_id": record.agent_id,
            "name": record.name,
            "old_status": record.status,  
            "new_status": record.status,
        })
```

### 3.4 Pydantic Schema 层

```python
# backend/api/schemas/agent.py

class AgentCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    provider: Literal['openai', 'anthropic', 'qwen', 'glm', 'kimi', 'deepseek', 'yi', 'doubao']
    model: str
    soul: Optional[str] = "default"
    temperature: Optional[float] = Field(0.7, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(4096, ge=1, le=32768)
    max_iterations: Optional[int] = Field(25, ge=1, le=100)
    taiji_verify_enabled: Optional[bool] = True
    tools: Optional[list[str]] = []
    metadata: Optional[dict] = {}

class AgentResponse(BaseModel):
    agent_id: str
    name: str
    description: str
    status: Literal['running', 'paused', 'stopped', 'error']
    provider: str
    model: str
    soul: str
    temperature: float
    max_tokens: int
    max_iterations: int
    taiji_verify_enabled: bool
    tools: list[str]
    created_at: datetime
    updated_at: datetime

class AgentMessageRequest(BaseModel):
    message: str = Field(..., min_length=1)
    system_message: Optional[str] = None
    stream: bool = False

class AgentMessageResponse(BaseModel):
    agent_id: str
    message: Optional[str]
    iterations: int
    tools_used: list[str]
    hallucination_risk: float
    status: str
```

### 3.5 WebSocket 管理器

```python
# backend/api/websocket/manager.py

@dataclass
class ConnectedClient:
    client_id: str
    websocket: WebSocket
    subscribed_topics: set[str] = field(default_factory=set)
    connected_at: datetime = field(default_factory=datetime.utcnow)

class WebSocketManager:
    def __init__(self):
        self._clients: dict[str, ConnectedClient] = {}
        self._queue: asyncio.Queue[tuple[str, dict]] = asyncio.Queue()
    
    async def connect(self, websocket: WebSocket, client_id: str = None) -> str:
        """接受连接，注册客户端，返回 client_id"""
        await websocket.accept()
        client_id = client_id or str(uuid4())
        self._clients[client_id] = ConnectedClient(client_id, websocket)
        return client_id
    
    def subscribe(self, client_id: str, topic: str):
        """订阅主题：agent:status | security:alert | approval:notification | workflow:progress"""
        if client_id in self._clients:
            self._clients[client_id].subscribed_topics.add(topic)
    
    async def broadcast_to_topic(self, topic: str, data: dict) -> int:
        """广播消息到订阅了指定主题的所有客户端，返回发送成功数"""
        payload = {"topic": topic, "data": data, "timestamp": time.time()}
        count = 0
        for client in list(self._clients.values()):
            if topic in client.subscribed_topics:
                try:
                    await client.websocket.send_json(payload)
                    count += 1
                except Exception:
                    self.disconnect(client.client_id)
        return count
    
    def enqueue_broadcast(self, topic: str, data: dict):
        """非 async 上下文（如 Service 层）调用：入队后由后台 worker 处理"""
        self._queue.put_nowait((topic, data))
    
    async def process_queue(self):
        """后台 worker：持续消费广播队列"""
        while True:
            topic, data = await self._queue.get()
            await self.broadcast_to_topic(topic, data)
```

---

## 4. TAIJI-AGENT 核心引擎设计

### 4.1 Agent Engine（TaijiAgent Loop）

#### 执行流程详解

```python
# backend/taiji-agent/src/taiji_agent/agent/engine.py

class TaijiAgent:
    """
    核心 Agent 执行引擎
    融合：Hermes(记忆) + Harness(工具管理) + TaijiVerify(防幻觉)
    """
    
    def run(self, task: str, system_message: str = None) -> TaskResult:
        """
        同步执行 Agent Loop
        
        Loop 设计（最大 25 次迭代）：
        ┌─────────────────────────────────────────────┐
        │  i = 0                                       │
        │  while i < max_iterations:                   │
        │    1. 构建消息上下文（历史 + 系统提示）          │
        │    2. LLM 调用（via LiteLLM）                │
        │    3. 解析响应（文本 or 工具调用指令）          │
        │    4. 若为工具调用 → 执行工具 → 结果写入上下文  │
        │    5. _verify_and_annotate() 防幻觉验证       │
        │       ├── risk > threshold → verify_blocked++ │
        │       └── risk 极高 → 触发 HITL               │
        │    6. 若为最终答案 → break                    │
        │    i++                                       │
        │  return TaskResult                           │
        └─────────────────────────────────────────────┘
        """
```

#### 关键配置参数详解

| 参数 | 默认值 | 作用 |
|------|--------|------|
| `provider` | `anthropic` | LLM 提供商（路由到 LiteLLM） |
| `model` | `claude-sonnet-4-20250514` | 具体模型名 |
| `soul` | `default` | 人格文件标识（从 souls/ 加载） |
| `temperature` | `0.7` | 生成随机性（0=确定性，2=高随机） |
| `max_tokens` | `4096` | 单次响应最大 token |
| `max_iterations` | `25` | Agent Loop 最大迭代次数（防无限循环） |
| `taiji_verify_enabled` | `True` | 启用防幻觉验证 |
| `taiji_verify_threshold` | `0.7` | 幻觉风险阈值（>此值则拦截/HITL） |
| `self_consistency_samples` | `3` | 自一致性采样数（多次生成对比） |
| `stream` | `True` | 启用流式输出 |

#### Soul 人格系统

```
souls/
├── default.yaml          # 通用助手人格
├── gov-assistant.yaml    # 政务助手（正式、合规语言）
├── eco-analyst.yaml      # 生态分析师（专业环保知识）
├── code-helper.yaml      # 编程助手（技术风格）
└── audit-supervisor.yaml # 审计专员（严谨、不容错）

# soul.yaml 示例结构
name: gov-assistant
description: 政务智能助手
personality: |
  你是一位严谨、专业的政务工作助手。
  在提供建议时，必须遵循相关法律法规。
  使用正式的政务语言，避免口语化表达。
constraints:
  - 不得提供具体的法律建议
  - 涉及敏感数据时自动触发脱敏
  - 审批类操作必须通过 GovMCP 工具
```

### 4.2 WorkflowEngine（状态机编排）

#### LangGraph 状态图设计

```python
# backend/taiji-agent/src/taiji_agent/workflow/engine.py

class WorkflowEngine:
    """
    基于 LangGraph 的状态机工作流引擎
    
    设计原则：
    - 节点 = 函数 (WorkflowNode)
    - 边 = 数据流 (条件边支持动态路由)
    - 状态 = WorkflowState (不可变快照)
    - 中断 = checkpoint (支持 HITL)
    """
    
    # 节点类型
    NODE_TYPES = {
        'start': StartNode,       # 工作流入口
        'end': EndNode,           # 工作流出口
        'agent': AgentNode,       # 调用 TaijiAgent
        'approval': ApprovalNode, # 人工审批（HITL）
        'condition': ConditionNode, # 条件分支
        'parallel': ParallelNode,   # 并行执行
        'tool': ToolNode,           # 直接工具调用
    }
    
    def add_conditional_edges(
        self,
        source: str,
        conditions: dict[str, Callable[[WorkflowState], bool]],
        default: str
    ):
        """
        条件路由示例（三级审批流）：
        
        add_conditional_edges('review', {
            'auto_approve': lambda s: s.metadata['risk_score'] < 0.3,
            'l2_approve': lambda s: 0.3 <= s.metadata['risk_score'] < 0.7,
            'l3_approve': lambda s: s.metadata['risk_score'] >= 0.7,
        }, default='l2_approve')
        """
```

#### WorkflowState 快照设计

```python
@dataclass
class WorkflowState:
    current_node: str
    history: list[dict]       # 每个节点的执行记录
    metadata: dict            # 业务数据（case_id、department 等）
    errors: list[str]
    checkpoint_id: str | None # 中断时保存，HITL 恢复用

# 典型政务审批工作流
#
# start → L1审核(Agent) → 条件判断 → {
#   risk<30% : auto_approve → 生成批文 → end
#   30%~70%  : L2人工审批(HITL) → 条件判断 → {
#     approved: 生成批文 → 区块链存证 → end
#     rejected: 退回申请 → 通知申请人 → end
#   }
#   risk≥70%  : L3会签(多人HITL) → 同上分支
# }
```

### 4.3 记忆系统四层架构

```
┌──────────────────────────────────────────────────────┐
│                  四层记忆系统                          │
│                                                       │
│  Layer 1: Hermes（短期/对话记忆）                      │
│  ├── 范围：当前会话内的消息历史                         │
│  ├── 存储：内存（dict[session_id, list[Message]]）    │
│  ├── 容量：最近 50 条消息（滑动窗口）                   │
│  └── 对应文件：memory/session.py                      │
│                                                       │
│  Layer 2: Mem0（中期/用户偏好记忆）                    │
│  ├── 范围：跨会话的用户偏好、常用操作                   │
│  ├── 存储：SQLite（aiosqlite）                        │
│  ├── 容量：用户级持久化，TTL 30天                      │
│  └── 对应文件：memory_tree/storage/mem0.py            │
│                                                       │
│  Layer 3: Graphiti（关联/知识图谱）                   │
│  ├── 范围：实体关系、事件关联、概念链接                  │
│  ├── 存储：Neo4j / 嵌入式图数据库                     │
│  ├── 容量：项目级持久化                               │
│  └── 对应文件：memory_tree/storage/graphiti.py       │
│                                                       │
│  Layer 4: GraphRAG（长期/文档检索增强）               │
│  ├── 范围：政策文件、法规、历史案例                     │
│  ├── 存储：向量数据库（Chroma/Qdrant）                │
│  ├── 容量：机构级持久化，全量文档索引                   │
│  └── 对应文件：memory_tree/storage/graphrag.py       │
└──────────────────────────────────────────────────────┘

记忆读取策略（MRO - Memory Resolution Order）：
query → L1命中 → 返回
      → L1未命中 → L2检索
      → L2未命中 → L3图检索
      → L3未命中 → L4 RAG 检索
      → 全未命中 → 纯 LLM 推理（标注"无历史依据"）
```

### 4.4 SafetyChain 六层安全链

```
输入 → [Layer 1: XiangxinGuardrails]  ──── 内容安全初筛（违禁词/有害内容）
     → [Layer 2: NeMoGuardrails]      ──── 规则护栏（自定义政策规则）
     → [Layer 3: EcoVerifyAdapter]    ──── 六层 VERIFY 验证
     │                                      ├── 坤守: 输入意图验证
     │                                      ├── 乾进: 信息完整性检查
     │                                      ├── 复归: 历史一致性检查
     │                                      ├── 观变: 动态风险评估
     │                                      ├── 巽调: 输出风格调节
     │                                      └── 北辰: 最终合规审核
     → [Layer 4: LettuceDetect]        ──── 幻觉检测（执行前后）
     → [Layer 5: LangfuseTracer]       ──── 全链路追踪与记录
     → [Layer 6: GovWorkflowManager]  ──── 政务合规最终门禁
     → 响应输出
     
任意层 BLOCK → 记录安全事件 → WebSocket 广播 security:alert → 可选触发 HITL
```

### 4.5 HITL 人在环路

```python
# backend/taiji-agent/src/taiji_agent/hitl/

# 触发条件（三种）
HITL_TRIGGERS = {
    'low_confidence':   hallucination_risk > 0.7,       # 幻觉风险过高
    'sensitive_action': tool_name in SENSITIVE_TOOLS,   # 执行敏感工具
    'gov_approval':     action.requires_govmcp_l2_plus, # 政务 L2+ 审批
}

# HITL 流程
class HITLApprovalFlow:
    async def request_approval(
        self,
        agent_id: str,
        context: dict,
        trigger: str
    ) -> CheckpointResult:
        """
        1. 创建 Checkpoint（保存当前 WorkflowState）
        2. 写入审批队列（GovMCP.approval_create）
        3. WebSocket 广播 approval:notification
        4. 挂起 Agent（将 token 等待审批）
        5. 等待人工操作（approve/reject）
        6. 审批通过 → 从 Checkpoint 恢复执行
           审批拒绝 → 终止任务，返回拒绝原因
        """
```

### 4.6 GovMCP 政务协议

#### 国密加密层

```
SM2（非对称）: 公钥加密敏感字段（身份证、银行账号）
SM3（哈希）:   审计日志完整性校验 + 区块链存证
SM4（对称）:   批量数据加密传输（性能优先场景）

密钥管理（KeyManager）：
├── 私钥: HSM 硬件模块存储（生产），本地文件（开发）
├── 公钥: 服务注册表分发
└── 密钥轮换: 30天周期 + 立即撤销机制
```

#### 三级审批工作流

```
L1（单签）: risk_score < 0.3
├── 单人审批即可
├── 数字签名：SM2 签名
└── 审计：SM3 哈希 + 本地审计

L2（双因子）: 0.3 ≤ risk_score < 0.7
├── 审批 + TOTP/短信二次验证
├── 数字签名：SM2 签名 + 时间戳
└── 审计：SM3 哈希 + 区块链存证

L3（会签+区块链）: risk_score ≥ 0.7
├── 多人会签（3人中2人通过）
├── 数字签名：每位审批人各自 SM2 签名
├── 区块链存证：Fabric/FISCO BCOS
└── 审计：不可篡改链上审计
```

#### 政务工具清单

```
国密工具:  sm3_hash / sm4_encrypt / sm4_decrypt / sm2_encrypt / sm2_decrypt / sm2_generate_keypair
审批工具:  approval_create / approval_submit / approval_approve / approval_reject / approval_status
审计工具:  audit_log / audit_query / audit_verify
脱敏工具:  mask_id_number / mask_phone / mask_bank_card
验证工具:  validate_id_number / validate_credit_code
业务工具:  calculate_workday
```

### 4.7 LiteLLM 模型路由

#### 路由策略

```yaml
# backend/litellm-proxy/config/config.yaml

model_list:
  - model_name: "qwen3-14b"        # 45% 流量 - 通用推理，性价比优先
    litellm_params:
      model: "qwen/qwen3-14b"
      api_base: "http://vllm-server:8001"
    
  - model_name: "deepseek-671b"    # 28% 流量 - 复杂推理任务
    litellm_params:
      model: "deepseek/deepseek-r1"
      api_base: "http://sglang-server:8002"
    
  - model_name: "qwen3-72b"        # 18% 流量 - 中等复杂度任务
    litellm_params:
      model: "qwen/qwen3-72b"
      api_base: "http://vllm-server:8001"
    
  - model_name: "glm-4-9b"         # 9%  流量 - 轻量快速任务
    litellm_params:
      model: "zhipu/glm-4-9b"
      api_base: "http://vllm-server-lite:8003"

router_settings:
  routing_strategy: "usage-based-routing-v2"  # 基于负载均衡
  fallbacks:
    - {"model": "deepseek-671b", "fallback": "qwen3-72b"}
    - {"model": "qwen3-72b", "fallback": "qwen3-14b"}
  timeout: 60
  retry_after: 3
```

#### 智能路由逻辑

```python
def select_model(task: str, config: AgentConfig) -> str:
    """
    基于任务特征和 AgentConfig 选择最优模型
    
    规则：
    1. 若 config.model 明确指定 → 直接使用
    2. 任务含代码/数学 → 路由到 deepseek-671b
    3. 任务长度 < 200 字 + 简单问答 → 路由到 glm-4-9b
    4. 默认 → usage-based 动态路由
    """
```

---

## 5. 前后端接口契约

### 5.1 REST API 完整清单

#### Agent 接口

| Method | Path | 说明 | 请求体 | 响应体 |
|--------|------|------|--------|--------|
| `POST` | `/api/agents/` | 创建 Agent | `AgentCreateRequest` | `AgentResponse 201` |
| `GET` | `/api/agents/` | 列出 Agent | Query: status, provider, limit, offset | `AgentListResponse` |
| `GET` | `/api/agents/{id}` | Agent 详情 | — | `AgentResponse` |
| `PUT` | `/api/agents/{id}/status` | 更新状态 | `{status: string}` | `AgentResponse` |
| `POST` | `/api/agents/{id}/message` | 发送消息 | `AgentMessageRequest` | `AgentMessageResponse` |
| `DELETE` | `/api/agents/{id}` | 删除 Agent | — | `204 No Content` |
| `GET` | `/api/agents/stats/summary` | 统计摘要 | — | `AgentStatsResponse` |

#### Workflow 接口

| Method | Path | 说明 | 请求体 | 响应体 |
|--------|------|------|--------|--------|
| `POST` | `/api/workflows/` | 创建工作流 | `WorkflowCreateRequest` | `WorkflowResponse 201` |
| `GET` | `/api/workflows/` | 列出工作流 | Query: status, limit, offset | `WorkflowListResponse` |
| `GET` | `/api/workflows/{id}` | 工作流详情 | — | `WorkflowResponse` |
| `POST` | `/api/workflows/{id}/execute` | 执行工作流 | `{initial_state: dict}` | `WorkflowExecuteResponse` |
| `GET` | `/api/workflows/{id}/state` | 获取当前状态 | — | `WorkflowState` |
| `POST` | `/api/workflows/{id}/resume` | 恢复中断工作流 | `{checkpoint_id: string}` | `WorkflowExecuteResponse` |
| `GET` | `/api/workflows/{id}/mermaid` | 生成 Mermaid 图 | — | `{mermaid: string}` |

#### Security 接口

| Method | Path | 说明 | 请求体 | 响应体 |
|--------|------|------|--------|--------|
| `GET` | `/api/security/events` | 安全事件列表 | Query: event_type, severity, limit | `SecurityEventListResponse` |
| `GET` | `/api/security/approvals` | 审批队列 | Query: status, department | `ApprovalListResponse` |
| `POST` | `/api/security/approvals/{id}/approve` | 审批通过 | `{approver_id, comment}` | `ApprovalResponse` |
| `POST` | `/api/security/approvals/{id}/reject` | 审批拒绝 | `{approver_id, comment}` | `ApprovalResponse` |
| `GET` | `/api/security/audit` | 审计日志 | Query: start_time, end_time, agent_id | `AuditLogResponse` |
| `POST` | `/api/security/audit/verify` | 审计链验证 | `{log_id: string}` | `{valid: bool}` |

#### Model 接口

| Method | Path | 说明 | 响应体 |
|--------|------|------|--------|
| `GET` | `/api/models/` | 模型列表 | `ModelListResponse` |
| `GET` | `/api/models/status` | 健康状态 | `ModelHealthResponse` |
| `GET` | `/api/models/routing` | 路由配置 | `ModelRoutingResponse` |
| `PUT` | `/api/models/routing` | 更新路由权重 | `ModelRoutingResponse` |

### 5.2 WebSocket 协议规范

#### 客户端→服务端协议

```json
// 订阅主题
{ "action": "subscribe", "topic": "agent:status" }

// 取消订阅  
{ "action": "unsubscribe", "topic": "agent:status" }

// 心跳（30秒发送一次）
{ "action": "ping" }
```

#### 服务端→客户端推送格式

```json
// 通用信封结构
{
  "topic": "agent:status",
  "data": { /* 业务数据 */ },
  "timestamp": 1749348735
}

// agent:status 数据
{
  "agent_id": "uuid",
  "name": "政务助手",
  "old_status": "stopped",
  "new_status": "running"
}

// security:alert 数据
{
  "event_id": "uuid",
  "severity": "high",
  "description": "检测到幻觉风险",
  "agent_id": "uuid"
}

// approval:notification 数据
{
  "approval_id": "uuid",
  "title": "某企业排污许可申请",
  "requester": "user-001",
  "level": "L2",
  "deadline": "2026-06-09T10:00:00Z"
}

// workflow:progress 数据
{
  "workflow_id": "uuid",
  "current_node": "l2_approval",
  "progress": 0.6,
  "status": "waiting_hitl"
}
```

---

## 6. 安全设计

### 6.1 认证与授权（MVP阶段建议方案）

```
当前状态：代码中尚未看到认证模块，属于待实现项

建议方案：
├── JWT Bearer Token（HTTP API）
│   ├── Access Token: 15分钟过期
│   ├── Refresh Token: 7天过期
│   └── 解码后写入 Request.state.user
│
├── 4类 Agent 角色权限
│   ├── enforcement:  执法类 Agent（可触发 L3 审批）
│   ├── monitoring:   监控类 Agent（只读 + 告警推送）
│   ├── approval:     审批类 Agent（处理审批队列）
│   └── public:       公众服务 Agent（受限访问）
│
└── L1-L5 五级操作权限（映射到 GovMCP 审批级别）
    L1: 普通查询
    L2: 数据修改
    L3: 审批流触发
    L4: 系统配置
    L5: 管理员操作
```

### 6.2 数据脱敏规则

```python
# GovMCP 自动脱敏触发规则
SENSITIVE_FIELDS = {
    'id_number': mask_id_number,    # 身份证: 110***********1234
    'phone': mask_phone,             # 手机: 138****5678
    'bank_card': mask_bank_card,     # 银行卡: 6222****1234
}

# 在 SafetyChain Layer 5 (LangfuseTracer) 记录时
# 自动替换所有敏感字段后再写入日志
```

---

## 7. 性能与可观测性设计

### 7.1 性能指标与目标

| 指标 | 目标 | 监控方式 |
|------|------|---------|
| API 响应 P50 | < 200ms | Langfuse + FastAPI middleware |
| Agent 首 token | < 1.5s | LiteLLM trace |
| WebSocket 延迟 | < 100ms | 客户端 ping-pong |
| 工作流执行（含 HITL）| < 24h SLA | 工作流引擎内部计时 |
| 幻觉拦截率 | > 95% | TaijiVerify 统计 |

### 7.2 Langfuse 全链路追踪

```python
# 追踪数据采集点
traces = {
    'agent_run':     ('agent_id', 'task', 'iterations', 'tools_used', 'hallucination_risk'),
    'tool_call':     ('tool_name', 'input', 'output', 'latency'),
    'verify_block':  ('reason', 'risk_score', 'threshold'),
    'hitl_trigger':  ('trigger_type', 'approval_level', 'wait_time'),
    'model_call':    ('model', 'prompt_tokens', 'completion_tokens', 'latency'),
}
```

### 7.3 健康检查端点

```python
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "services": {
            "ws_manager": ws_manager.get_stats(),
            "agents_count": len(agent_service._agents),
            "litellm_proxy": await check_litellm_health(),
        },
        "timestamp": datetime.utcnow().isoformat()
    }
```

---

## 8. 设计系统与 VI 规范

### 8.1 品牌色彩 Token（来自 VI 手册）

```css
/* 主色系 */
--eco-green:    #00C9A7;    /* 生态绿（Logo、成功态、强调） */
--eco-cyan:     #0E7490;    /* 智慧青（主按钮、标题） */
--eco-deep:     #0B1E28;    /* 深空黑（暗色背景、文字） */
--eco-light-bg: #F0F4F8;    /* 浅灰白（浅色背景） */
--eco-warm-white: #F0F4F8;  /* 暖白（浅色模式文字）  */

/* 渐变（品牌标志用，慎用于 UI） */
--eco-gradient: linear-gradient(90deg, #00C9A7, #0E7490, #00C9A7);

/* 功能色 */
--color-success: #00C9A7;  /* 对齐品牌绿 */
--color-warning: #F59E0B;
--color-error:   #EF4444;
--color-info:    #0E7490;  /* 对齐品牌青 */
```

### 8.2 字体规范

```css
/* 主字体栈 */
font-family: 'Inter', 'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif;

/* 代码字体 */
font-family-mono: 'JetBrains Mono', 'Fira Code', monospace;

/* 字阶 */
font-size-xs:   12px;
font-size-sm:   13px;
font-size-base: 14px;   /* 正文 */
font-size-md:   16px;
font-size-lg:   20px;
font-size-xl:   24px;
font-size-2xl:  32px;
font-size-3xl:  40px;
```

### 8.3 组件规范

```
圆角：border-radius: 8px（卡片）/ 4px（标签）/ 50%（头像）
阴影：box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)
间距：8px 基础单位（8/16/24/32/48px）
动画：transition: all 0.2s ease（交互反馈）/ 0.3s ease（面板展开）
```

---

## 9. 部署架构

### 9.1 开发环境

```bash
# 前端
cd frontend && pnpm dev           # http://localhost:5173
# 后端 API
cd backend/api && uvicorn main:app --reload --port 8000
# LiteLLM 代理（可选）
cd backend/litellm-proxy && python start_proxy.py  # http://localhost:4000
# 推理服务（可选）
cd backend/vllm && docker-compose up -d
```

### 9.2 生产部署建议

```
┌────────────────────────────────────────────────────────┐
│                     负载均衡 (Nginx)                     │
│     /          → 前端静态文件 (dist/)                   │
│     /api/*     → FastAPI (多实例, Gunicorn + Uvicorn)   │
│     /ws        → FastAPI WebSocket (粘性会话)           │
└─────────────────────┬──────────────────────────────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
   FastAPI App    LiteLLM Proxy   Redis
   (api:8000)     (proxy:4000)    (WebSocket 持久化/集群)
          │            │
          ▼            ▼
   Taiji Agent    vLLM/SGLang
   (Python 进程)   (GPU 推理服务)
```

### 9.3 环境变量清单

```bash
# API 配置
API_HOST=0.0.0.0
API_PORT=8000
API_CORS_ORIGINS=http://localhost:5173,https://ecomind.your-domain.com

# LLM Keys
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
DASHSCOPE_API_KEY=...     # 通义千问
ZHIPU_API_KEY=...         # 智谱GLM
MOONSHOT_API_KEY=...      # Kimi
DOUBAO_API_KEY=...        # 豆包

# LiteLLM
LITELLM_PROXY_URL=http://localhost:4000
LITELLM_MASTER_KEY=...

# 国密/政务
GOV_SM2_PRIVATE_KEY=...
GOV_SM2_PUBLIC_KEY=...
GOV_BLOCKCHAIN_NODE=...

# 可观测性
LANGFUSE_PUBLIC_KEY=...
LANGFUSE_SECRET_KEY=...
LANGFUSE_HOST=https://cloud.langfuse.com

# 前端 (Vite)
VITE_API_BASE=/api
VITE_WS_URL=ws://localhost:8000
```

---

## 10. 待解决问题与改进建议

### P0 — 必须解决

| 问题 | 影响 | 建议 |
|------|------|------|
| 无认证模块 | 所有 API 无保护 | 实现 JWT 认证 + RBAC 中间件 |
| AgentService 内存存储 | 重启丢失所有 Agent | 接入 SQLite/PostgreSQL 持久化 |
| Chat/index.tsx 用了 shadcn/ui | UI 不一致，引入额外依赖 | 统一回归 Ant Design，或全局引入 shadcn/ui |

### P1 — 重要改进

| 问题 | 影响 | 建议 |
|------|------|------|
| WebSocket 单节点 | 无法水平扩展 | 引入 Redis Pub/Sub 广播 |
| 流式输出未设计 | Agent 消息体验差 | 实现 SSE 或 WS stream 模式 |
| 无前端错误边界 | 单点异常崩溃全页 | 每个页面加 ErrorBoundary |
| 模型路由无熔断 | 推理服务宕机影响全局 | LiteLLM fallback + circuit breaker |

### P2 — 优化项

| 优化点 | 建议 |
|--------|------|
| API 请求无缓存 | 模型列表/Domain 配置等静态数据加 React Query 缓存 |
| 无 loading 骨架屏 | 页面数据加载时显示 Skeleton |
| 国际化覆盖率不足 | 补全所有硬编码中文字符串 |
| 无 E2E 测试 | 接入 Playwright 测试关键流程 |

---

*文档生成：WorkBuddy AI — 基于 EcoMind OS 代码库深度分析*  
*参考文档：CODE_WIKI.md + class-diagram.mermaid + sequence-diagram.mermaid + engine.py + agent_service.py + manager.py + main.py + govmcp/server.py*
