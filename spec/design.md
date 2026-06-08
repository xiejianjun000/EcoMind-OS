# EcoMind OS — 架构设计书

> 版本：1.0 | 最后更新：2026-05-27
> 对应需求：spec/requirements.md

---

## 一、技术栈总览

| 层级 | 选型 | 版本 |
|:---|:---|:---|
| **前端框架** | React | 18.3.1 |
| **构建工具** | Vite | 6.1+ |
| **UI 组件库** | Ant Design + Pro Components | 5.24+ |
| **3D 地球** | Cesium + Deck.gl | 1.127 / 9.1 |
| **地理分析** | Turf.js | 7.1 |
| **图表** | ECharts | 5.6 |
| **状态管理** | Zustand | 5.0 |
| **路由** | React Router | 6.28 |
| **实时通信** | Socket.IO Client | 4.8 |
| **国际化** | i18next | 24.2 |
| **后端框架** | FastAPI | — |
| **数据验证** | Pydantic | — |
| **Agent 引擎** | EcoAgentEngine（自建） | — |
| **工具注册** | EcoToolRegistry（自建） | — |
| **输出验证** | EcoVerifier（自建） | — |
| **记忆系统** | EcoMemory SQLite（自建） | — |
| **模型路由** | LiteLLM | — |
| **政务协议** | GOVMCP（自建，SM2/SM3/SM4） | — |
| **数据存储** | SQLite | — |

---

## 二、系统架构图

```
┌─────────────────────────────────────────────────────────┐
│                     Browser (React 18)                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐ │
│  │Dashboard │ │ Cesium3D │ │Enforce   │ │ Command    │ │
│  │          │ │          │ │Approval  │ │ Cockpit    │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └─────┬──────┘ │
└───────┼────────────┼────────────┼─────────────┼────────┘
        │    HTTP/SSE/WebSocket      │             │
┌───────┴────────────┴────────────┴─────────────┴────────┐
│                   FastAPI Backend                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Routers: agents / workflows / security / models │  │
│  │           departments / environment               │  │
│  └──────────────────────┬───────────────────────────┘  │
│                         │                               │
│  ┌──────────────────────┴───────────────────────────┐  │
│  │              engine/ (自建 Agent 引擎)              │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │  │
│  │  │ loop.py  │ │ tool_reg │ │ verify.py/memory │  │  │
│  │  │ Agent循环 │ │ 工具注册  │ │ 验证 + 记忆      │  │  │
│  │  └──────────┘ └──────────┘ └──────────────────┘  │  │
│  └──────────────────────┬───────────────────────────┘  │
└─────────────────────────┼──────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
┌───────┴───────┐ ┌───────┴───────┐ ┌───────┴───────┐
│   GOVMCP      │ │   LiteLLM     │ │   ECC Skills  │
│  SM2/SM3/SM4  │ │  17 模型路由   │ │  9 Agent/     │
│  20 MCP工具    │ │ opus/sonnet/  │ │  4 工作空间    │
│  审批流引擎    │ │ haiku 三级    │ │  19 部门映射   │
└───────────────┘ └───────────────┘ └───────────────┘
                          │
┌─────────────────────────┴──────────────────────────────┐
│                   数据层                                 │
│  ┌──────────────────┐  ┌────────────────────────────┐  │
│  │ SQLite           │  │ Agent 5 文件夹规范          │  │
│  │ ecomind_memory.db│  │ personality/knowledge/      │  │
│  │                  │  │ memory/skills/workspace     │  │
│  └──────────────────┘  └────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

---

## 三、模块职责表

| 目录 | 职责 | 状态 |
|:---|:---|:---|
| **frontend/** | React 18 前端：22 路由、20+ 页面、6 Zustand Store | ✅ 含占位页 |
| **backend/api/** | FastAPI 接口层：6 路由模块、WebSocket、CORS | ✅ |
| **backend/engine/** | 自建 Agent 引擎：对话循环、工具注册、验证、记忆 | ✅ |
| **backend/govmcp/** | 国密协议层：SM2/SM3/SM4、20 MCP 工具、审批引擎 | ✅ 最完善 |
| **backend/skills/** | ECC 技能系统：Agent 映射、工作空间、Instincts 引擎 | ✅ |
| **backend/litellm-proxy/** | LiteLLM 模型路由代理（17 模型） | ✅ |
| **vendor/** | 外部依赖本地化 | ⚠️ 与 backend/govmcp 重复 |
| **data/** | SQLite 记忆数据库 | ✅ |
| **docs/** | 技术方案 V6.5 + 类图 + 时序图 | ✅ |
| **VI/** | 品牌视觉识别手册 | ✅ |
| **deliverables/** | Phase 1A + 1B 交付报告 | ✅ |
| **agent-prompts-collection/** | Agent Prompt 集合（规划中） | ⬜ 空 |
| **.github-clone/** | 19 篇分析文档 + 历史版本 | ✅ |

---

## 四、数据流设计

### 4.1 Agent 对话流（EcoAgentEngine）

```
用户发送消息
    │
    ▼
POST /api/agents/{id}/messages
    │
    ▼
EcoAgentEngine.loop.py
    ├── 加载 Agent 配置 + 记忆
    ├── 构建 system prompt + 工具列表
    ├── 调用 LLM（LiteLLM 路由 → opus/sonnet/haiku）
    ├── 解析 tool_calls → EcoToolRegistry 执行
    ├── EcoVerifier 验证输出
    ├── EcoMemory 持久化记忆
    └── SSE 流式返回
```

### 4.2 审批流转（GOVMCP）

```
draft → submitted → under_review → countersigning → approved/rejected → archived
                                          │
                                   SM3 哈希链签名
                                   每步不可篡改
```

### 4.3 模型路由（LiteLLM 三级）

```
任务复杂度评估
    │
    ├── 高 → opus: DeepSeek-671B / Qwen-Max / GLM-4
    ├── 中 → sonnet: Qwen-Plus / DeepSeek-Coder / InternLM2-20B
    └── 低 → haiku: Qwen-Turbo / MiniCPM-4B / ChatGLM-Turbo
```

---

## 五、关键设计决策

### 决策 1：自建引擎 vs 开源 Agent 框架

| 选项 | EcoAgentEngine（自建） | LangGraph/CrewAI 等 |
|:---|:---|:---|
| 优势 | 零外部依赖、可控性强、适配国密 | 功能完善、社区支持 |
| 劣势 | 功能有限、需长期维护 | 依赖重、国密适配困难 |

**选型**：当前走自建路线。TECH_PLAN v6.5 规划引入 Taiji Agent 2.0 + LangGraph，两路线如何合并待定。

### 决策 2：GOVMCP 独立模块

**选型**：将国密协议独立为 GOVMCP 模块。理由：SM2/SM3/SM4 实现是项目核心竞争力，独立维护可复用至其他政务系统。

### 决策 3：React 18 + Ant Design Pro

**选型**：React 18 + AntD Pro。理由：政务系统 UI 标准化需求高，AntD Pro 提供现成的表格/表单/审批流组件，减少前端开发量。

---

## 六、架构演进路线

```
v2.0（当前）                  v6.5（规划）
─────────────────────────────────────────────
EcoAgentEngine 自建    →     Taiji Agent 2.0 + LangGraph
EcoMemory SQLite       →     Hermes + Mem0 + GraphRAG
EcoVerifier 轻量       →     TAIJI-VERIFY 六层 + LettuceDetect
LiteLLM 云端路由       →     Ollama 本地 + 联邦蒸馏
WebSocket 直连         →     NATS 消息总线 + P2P
```

---

⚠️ 此文件为人工维护。AI 不得擅自修改。