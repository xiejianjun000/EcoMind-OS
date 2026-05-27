# 🌿 EcoMind OS

<p align="center">
  <strong>🌍 以智慧，哺育星球</strong><br/>
  <em>Intelligence that Nurtures the Planet.</em>
</p>

<p align="center">
  <a href="./backend"><img src="https://img.shields.io/badge/Backend-FastAPI-009688?style=flat-square"/></a>
  <a href="./frontend"><img src="https://img.shields.io/badge/Frontend-React%2018-61DAFB?style=flat-square"/></a>
  <a href="./backend/engine"><img src="https://img.shields.io/badge/Engine-EcoMind%20自建-success?style=flat-square"/></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-Apache--2.0-blue?style=flat-square"/></a>
  <img src="https://img.shields.io/badge/Version-2.0.0-green?style=flat-square"/>
</p>

---

## 🧠 什么是 EcoMind OS？

**EcoMind OS** 是**生态环境垂直领域 AI Agent 管理平台**，一个独立完整的项目，不依赖任何外部 Agent 框架。

核心理念：**"会思考的生态大脑"（A Thinking Ecological Brain）**。

它融合了：
- 🌿 **生态智能**：面向环保、政务、企业碳排放等场景
- 🧠 **自建 Agent 引擎**：纯 Python 对话循环 + 工具执行 + 流式输出，零外部 Agent 框架依赖
- 🛡️ **安全验证**：自建 EcoVerifier 输出验证 + 安全事件管理
- 💾 **本地记忆**：SQLite 持久化三层记忆（会话/长期/工作）
- 🔄 **工作流编排**：自建有向图状态机，支持节点/边定义 + 条件分支

---

## ✨ 核心特性

### 1. 🤖 多模态 Agent 管理
- **4 类 Agent 角色**：enforcement（执法）/ monitoring（监测）/ approval（审批）/ public（公众）
- **权限分级**：L1-L5 五级权限体系
- **流式输出**：WebSocket 实时流式响应
- **15+ 国产模型**：通过 LiteLLM 路由，支持 opus/sonnet/haiku 三级切换

### 2. 🔄 工作流编排
- **自建有向图状态机**：节点/边定义 + 串行执行 + 条件分支
- **节点类型**：llm_call / tool_call / transform / condition / approval
- **超时控制** + **取消支持**

### 3. 🛡️ 安全验证（EcoVerifier）
- 空响应 / 过短响应检测
- 不确定性标记检测（"可能"/"据称"/"有待核实" 等）
- 合规敏感词告警
- 置信度评分（0.0-1.0），低于阈值自动标记

### 4. 💾 本地记忆系统（EcoMemory）
- **会话记忆**（短）：当前对话上下文，内存中
- **长期记忆**（久）：跨会话保留，SQLite 持久化
- **工作记忆**（临）：当前任务临时状态
- 支持按类别/关键词搜索，TTL 过期自动清理

### 4. 🧠 持久化记忆系统
- **SQLite 三层记忆**：会话上下文 / 用户偏好 / 知识图谱关联
- 跨会话持久化：AI 压缩摘要自动注入
- 参考 Claude-Mem (78K ⭐) 理念

### 5. 🛡️ 六层安全链（SafetyChain）
| 层级 | 实现 | 功能 |
|------|------|------|
| L1 | 输入检查 | Prompt 注入检测 / PII 脱敏 |
| L2 | 策略护栏 | 合规范围检查 / 执法质量控制 |
| L3 | 输出验证 | 数据真实性 / 法规引用准确性 |
| L4 | 幻觉检测 | 数值合理性检查 |
| L5 | 审计追踪 | Agent 决策日志 |
| L6 | 政务审批 | GOVMCP SM2/SM3/SM4 国密加密 |

> 参考 Anthropic-Cybersecurity-Skills (9.6K ⭐) 754 条安全技能

### 6. 🔗 知识图谱
- 环境法规 → 条款 → 案例关联图
- Agent → 工具 → 法规调用链可视化
- 参考 Understand-Anything (33K ⭐) 理念

### 7. 🎯 ECC 技能系统
- **6 大生态技能**：环境监测 / 碳排放 / 执法决策 / 审批辅助 / 报告生成 / 安全审计
- **Instincts 直觉规则**：优先于工具调用，防幻觉 / 合规优先 / 数据验证
- **Markdown 加载**：兼容 ECC (193K ⭐) 技能文件格式

### 8. 🌍 3D 可视化（Cesium）
- 湖南省地形 3D 场景
- 监测站点实时数据叠加
- Deck.gl 数据图层（热力图 / 散点图 / 聚合图）

### 6. 🔌 模型路由（LiteLLM Proxy）
- **Qwen 系列**（Qwen-Max / Plus / Turbo）
- **DeepSeek 系列**（Chat / Coder）
- **GLM 系列**（GLM-4 / ChatGLM）
- **Yi 系列**（Yi-Large / Yi-Medium）
- **本地推理**：vLLM / SGLang 部署

---

## 🏗️ 技术架构

```
用户 → React 前端 (Ant Design + Cesium + ECharts)
        │
        ├── REST API ──────────── FastAPI 后端
        │                              │
        │    ┌─────────────────────────┼─────────────────────────┐
        │    │                         │                         │
        │    ▼                         ▼                         ▼
        │  AgentService         WorkflowService         SecurityService
        │    │                         │                         │
        │    ▼                         ▼                         ▼
        │  EcoAgentEngine        自建状态机              EcoVerifier
        │  (Agent Loop)           (节点/边图)            (输出验证)
        │    │
        │    ├──► EcoToolRegistry (5个内置工具 + 可扩展)
        │    ├──► EcoMemory (SQLite三层记忆)
        │    └──► LiteLLM (15+国产模型路由)
        │
        └── WebSocket ───────── 实时进度推送
```

---

## 📁 项目结构

```
EcoMind-OS/
├── backend/                      # FastAPI 后端
│   ├── api/                     # API 路由
│   │   ├── main.py              # FastAPI 入口
│   │   ├── routers/             # 路由（agents/workflows/security/models）
│   │   ├── services/            # 业务逻辑层（自建引擎）
│   │   ├── schemas/             # Pydantic 数据模型
│   │   └── websocket/           # WebSocket 管理器
│   ├── engine/                  # ⭐ 自建 Agent 引擎（零外部框架依赖）
│   │   ├── loop.py              # Agent 对话循环 + SSE 流式
│   │   ├── tool_registry.py     # 工具注册与执行 + OpenAI/MCP Schema
│   │   ├── verify.py            # EcoVerifier 输出验证
│   │   └── memory.py            # SQLite 三层持久化记忆
│   ├── skills/                  # 🆕 ECC 技能系统 (193K ⭐)
│   │   ├── ecc_bridge.py        # ECC 技能加载器 + Instincts 引擎
│   │   └── *.md                 # 生态领域技能文件
│   ├── memory/                  # 🆕 Claude-Mem 风格记忆 (78K ⭐)
│   │   └── claude_mem_bridge.py # 跨会话持久化 + AI 压缩摘要
│   ├── safety/                  # 🆕 安全技能层 (9.6K ⭐)
│   │   └── cybersec_skills.py   # 754 条安全规则 → 6 层 SafetyChain
│   ├── graph/                   # 🆕 知识图谱 (33K ⭐)
│   │   └── understand_adapter.py # 法规/Agent/工具关系图谱
│   ├── inference/               # 推理引擎配置
│   ├── litellm-proxy/           # LiteLLM 代理
│   └── vllm/                   # vLLM 部署配置
├── frontend/                     # React 前端
│   └── src/
│       └── pages/               # 9 个功能模块
├── VI/                          # 品牌视觉识别系统
└── README.md
```

---

## 🚀 快速开始

### 前置条件

| 依赖 | 版本 | 说明 |
|------|------|------|
| **Node.js** | v22+ | 前端构建环境 |
| **pnpm** | v11+ | 前端包管理器 |
| **Python** | 3.11+ | 后端运行环境 |

### 1. 克隆项目

```bash
git clone https://github.com/xiejianjun000/EcoMind-OS.git
cd EcoMind-OS
```

### 2. 启动后端

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn api.main:app --reload --port 8000
```

### 3. 启动前端（开发模式）

```bash
cd frontend
pnpm install
pnpm dev  # http://localhost:5173
```

### 4. 配置 LLM API Key

```bash
export DEEPSEEK_API_KEY="sk-your-key"
# 或其他模型提供商的 API Key
```

---

## 🛠️ 技术栈

### 前端
| 技术 | 用途 |
|------|------|
| React 18 + TypeScript 5.7 + Vite 6 | 核心框架 |
| Ant Design 5.24 + Ant Design Pro | UI 组件库 |
| Cesium 1.127 + Deck.gl 9 + Turf.js 7 | 3D 地图 |
| ECharts 5.6 | 数据可视化 |
| Zustand 5 | 状态管理 |
| Socket.IO Client | WebSocket |
| i18next + Tailwind CSS 4 | 国际化 + 样式 |

### 后端
| 技术 | 用途 |
|------|------|
| FastAPI + Pydantic | Web 框架 + 数据验证 |
| **EcoAgentEngine（自建）** | Agent 对话循环 |
| **EcoToolRegistry（自建）** | 工具注册与执行 |
| **EcoVerifier（自建）** | 输出验证 |
| **EcoMemory（自建）** | SQLite 记忆系统 |
| LiteLLM | 模型路由代理 |
| httpx | LLM API 调用 |

---

## 📊 项目状态

### Phase 1A（✅ 已完成）
- 前端 9 模块路由 + Dashboard 原型
- i18n 双语 + 亮/暗主题
- 后端 API 骨架 + WebSocket

### Phase 1B（🔶 进行中）
- Cesium 3D 场景
- 前后端联调
- 本地推理部署

### v2.0（✅ 刚完成）
- **自建 Agent 引擎** — 切断全部 TAIJI-AGENT 依赖
- **自建安全验证** — 替代 TAIJI-VERIFY
- **自建记忆系统** — 替代 Hermes/Mem0/Graphiti/GraphRAG
- **自建工作流** — 替代 LangGraph/CrewAI
- **零外部 Agent 框架依赖** — 安装即用

---

## 🏆 灵感来源

EcoMind OS v2.0 独立架构受以下开源项目启发：

| 项目 | Stars | 集成模块 | 理念贡献 |
|------|-------|----------|----------|
| [affaan-m/ECC](https://github.com/affaan-m/ECC) | 193K ⭐ | `backend/skills/` | Skills + Instincts + Memory + Security |
| [thedotmack/claude-mem](https://github.com/thedotmack/claude-mem) | 78K ⭐ | `backend/memory/` | 跨会话持久化 + AI 压缩上下文 |
| [Lum1104/Understand-Anything](https://github.com/Lum1104/Understand-Anything) | 33K ⭐ | `backend/graph/` | 交互式知识图谱 |
| [mukul975/Anthropic-Cybersecurity-Skills](https://github.com/mukul975/Anthropic-Cybersecurity-Skills) | 9.6K ⭐ | `backend/safety/` | 754 条结构化安全技能 |
| [anthropics/knowledge-work-plugins](https://github.com/anthropics/knowledge-work-plugins) | 16K ⭐ | `backend/skills/knowledge-work/` | 知识工作者插件范式 |
| [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) | 20K ⭐ | `backend/engine/verify.py` | AI 输出质量品味 |

---

## 🎨 品牌视觉识别（VI）

核心理念 **"会思考的生态大脑"**：
- 🍃 **Logo**：叶脉轮廓 × AI 神经网络拓扑
- 🎨 **色彩**：生态绿 #00C9A7 → 智慧青 #0E7490
- 🌐 **口号**：*以智慧，哺育星球。*

> 📖 完整 VI 手册：[VI/EcoMind_OS_VI_Brand_Manual.md](./VI/EcoMind_OS_VI_Brand_Manual.md)

---

## 📄 许可证

Apache License 2.0

---

<p align="center">
  <em>🌱 EcoMind OS — 生态，自此思考。</em><br/>
  <em>🌍 Intelligence that Nurtures the Planet.</em>
</p>
