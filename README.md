# 🌿 EcoMind OS

<p align="center">
  <img src="VI/logo-placeholder.png" alt="EcoMind OS Logo" width="200"/>
</p>

<p align="center">
  <strong>🌍 以智慧，哺育星球</strong><br/>
  <em>Intelligence that Nurtures the Planet.</em>
</p>

<p align="center">
  <a href="./backend"><img src="https://img.shields.io/badge/Backend-FastAPI-009688?style=flat-square"/></a>
  <a href="./frontend"><img src="https://img.shields.io/badge/Frontend-React%2018-61DAFB?style=flat-square"/></a>
  <a href="./backend/taiji-agent"><img src="https://img.shields.io/badge/Agent-TAIJI--AGENT%202.0-orange?style=flat-square"/></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-Apache--2.0-blue?style=flat-square"/></a>
  <img src="https://img.shields.io/badge/Version-1.0.0-green?style=flat-square"/>
</p>

---

## 🧠 什么是 EcoMind OS？

**EcoMind OS** 是一个**全栈 AI Agent 智能管理平台**，核心理念为 **"会思考的生态大脑"（A Thinking Ecological Brain）**。

它融合了：
- 🌿 **生态智能**：面向环保、政务、企业碳排放等场景
- 🤖 **Agent 编排**：LangGraph + CrewAI 双引擎
- 🛡️ **安全治理**：六层 VERIFY 验证 + 多层安全防护链
- 🧠 **记忆系统**：Hermes + Mem0 + Graphiti + GraphRAG 四层记忆
- 🏛️ **政务集成**：GOVMCP 政务模型协作协议（SM2/SM3/SM4 国密算法）

---

## ✨ 核心特性

### 1. 🤖 多模态 Agent 管理
- **4 类 Agent 角色**：enforcement（执法）/ monitoring（监测）/ pproval（审批）/ public（公众）
- **权限分级**：L1-L5 五级权限体系
- **人在环路**（HITL）：低置信度自动触发人工审批
- **流式输出**：支持 SSE / WebSocket 实时流式响应

### 2. 🔄 工作流编排
- **LangGraph** 状态图编排（监督节点 + 审批节点 + 检查点）
- **CrewAI** 团队协作（监测团队 / 执法团队 / 巡检团队）
- **审批流**：GOVMCP 三级审批（L1单签 / L2双因子 / L3会签+区块链存证）

### 3. 🛡️ 安全治理链（SafetyChain）
| 层级 | 技术 | 功能 |
|------|------|------|
| L5-1 | Xiangxin Guardrails | 输入/输出内容安全审核 |
| L5-2 | NeMo Guardrails | NVIDIA 官方护栏系统 |
| L5-3 | EcoVerifyAdapter | 六层 VERIFY 验证（坤守/乾进/复归/观变/巽调/北辰） |
| L5-4 | LettuceDetect | 幻觉检测（Hallucination Detection） |
| L5-5 | Langfuse Tracer | LLM 调用审计追踪 |
| L5-6 | GovWorkflowManager | 政务审批流（SM2/SM3/SM4 国密加密） |

### 4. 🧠 四层记忆系统
- **Hermes**（短期）：会话上下文记忆
- **Mem0**（中期）：用户偏好记忆
- **Graphiti**（关联）：知识图谱时序记忆
- **GraphRAG**（长期）：全局知识库检索

### 5. 🌍 3D 可视化（Cesium）
- 湖南省地形 3D 场景
- 监测站点实时数据叠加
- Deck.gl 数据图层（热力图 / 散点图 / 聚合图）
- Turf.js 地理空间分析

### 6. 🔌 模型路由（LiteLLM Proxy）
- **Qwen3-14B**（45% 流量）：通用任务
- **DeepSeek-671B**（28% 流量）：复杂推理
- **Qwen3-72B**（18% 流量）：大规模上下文
- **GLM-4-9B**（9% 流量）：边缘推理
- **本地推理**：vLLM / SGLang 部署（Phase 1B）

---

## 🏗️ 技术架构

\\\mermaid
graph TB
    User[👤 用户] --> Frontend[🌐 Frontend<br/>React + Cesium + ECharts]
    Frontend --> WebSocket[📡 WebSocket<br/>Socket.IO]
    Frontend --> API[🔧 FastAPI Backend]
    
    API --> Engine[🧠 EcoAgentEngine<br/>LangGraph + CrewAI]
    Engine --> Safety[🛡️ SafetyChain<br/>6-Layer Guard]
    Engine --> Memory[🧠 MemoryProvider<br/>Hermes+Mem0+Graphiti]
    Engine --> GovMCP[🏛️ GovMCP<br/>政务审批流]
    
    Safety --> Verify[✅ EcoVerifyAdapter<br/>6-Layer VERIFY]
    Safety --> Guardrails[🛡️ Xiangxin+NeMo<br/>内容安全]
    Safety --> Hallucination[🔍 LettuceDetect<br/>幻觉检测]
    
    Memory --> ShortTerm[Hermes<br/>短期记忆]
    Memory --> MidTerm[Mem0<br/>用户偏好]
    Memory --> Associative[Graphiti<br/>关联记忆]
    Memory --> LongTerm[GraphRAG<br/>长期知识库]
    
    Engine --> LiteLLM[🔌 LiteLLM Proxy<br/>模型路由]
    LiteLLM --> Qwen3[Qwen3-14B]
    LiteLLM --> DeepSeek[DeepSeek-671B]
    LiteLLM --> GLM[GLM-4-9B]
    
    GovMCP --> SM2[🔐 SM2 证书]
    GovMCP --> SM3[🔐 SM3 哈希]
    GovMCP --> SM4[🔐 SM4 加密]
    
    style Frontend fill:#e1f5fe
    style Engine fill:#fff3e0
    style Safety fill:#ffebee
    style Memory fill:#e8f5e9
    style GovMCP fill:#f3e5f5
\\\

---

## 📁 项目结构

\\\ash
EcoMind OS/
├── backend/                      # FastAPI 后端
│   ├── api/                     # API 路由
│   │   ├── main.py              # FastAPI 入口
│   │   ├── routers/             # 路由模块（agents/workflows/security/models）
│   │   ├── services/            # 业务逻辑层
│   │   ├── schemas/             # Pydantic 数据模型
│   │   └── websocket/           # WebSocket 管理器
│   ├── inference/               # 推理引擎配置
│   │   ├── adapter.py           # vLLM/SGLang 适配器
│   │   ├── config.yaml          # 模型映射配置
│   │   └── start_*.sh          # 启动脚本
│   ├── litellm-proxy/           # LiteLLM 代理
│   ├── taiji-agent/             # TAIJI-AGENT 2.0 核心（112 个模块）
│   │   ├── agent/               # Agent 引擎
│   │   ├── govmcp/             # GOVMCP 政务协议
│   │   ├── workflow/            # LangGraph 工作流
│   │   ├── multiagent/          # 多 Agent 协调
│   │   ├── memory/              # 记忆系统
│   │   ├── memory_tree/         # 三层记忆树
│   │   ├── mcp/                # MCP 协议适配
│   │   ├── skills/              # 技能系统
│   │   ├── souls/               # 灵魂系统
│   │   └── providers/chinese/   # 国产模型适配
│   └── vllm/                   # vLLM 部署配置
├── frontend/                     # React 前端
│   ├── src/
│   │   ├── pages/               # 9 个功能模块
│   │   │   ├── Dashboard/       # 总览页（ECharts 图表）
│   │   │   ├── Agents/          # Agent 管理
│   │   │   ├── Workflows/       # 工作流编排
│   │   │   ├── Security/        # 安全治理
│   │   │   ├── Models/          # 模型管理
│   │   │   ├── Domains/         # 业务域配置
│   │   │   ├── Conversations/   # 对话审计
│   │   │   ├── Cesium/          # 3D 地图场景
│   │   │   └── Settings/        # 系统设置
│   │   ├── components/          # 公共组件
│   │   ├── layouts/             # 主布局（Ant Design Pro）
│   │   ├── store/               # Zustand 状态管理
│   │   ├── services/            # API 调用封装
│   │   ├── hooks/               # 自定义 Hooks
│   │   ├── locales/             # i18n 双语（zh-CN/en-US）
│   │   └── theme/               # Ant Design 主题配置
│   ├── public/                  # 静态资源
│   └── vite.config.ts           # Vite 配置（Cesium 插件）
├── docs/                        # 设计文档
│   ├── class-diagram.mermaid    # 类图
│   └── sequence-diagram.mermaid # 时序图
├── VI/                          # 品牌视觉识别系统
│   ├── EcoMind_OS_VI_Brand_Manual.md  # VI 手册
│   └── overview.md              # VI 总览
├── deliverables/                 # 交付物
│   └── software-company/        # 软件开发交付报告
├── agent-prompts-collection/     # Agent 提示词集合
├── .workbuddy/                  # WorkBuddy 协作记忆
└── README.md                    # 本文件
\\\

---

## 🚀 快速开始

### 前置条件

| 依赖 | 版本 | 说明 |
|------|------|------|
| **Node.js** | v22+ | 前端构建环境 |
| **pnpm** | v11+ | 前端包管理器 |
| **Python** | 3.11+ | 后端运行环境 |
| **Git** | 2.x+ | 版本控制 |

### 1. 克隆项目

\\\ash
git clone https://github.com/xiejianjun000/EcoMind-OS.git
cd EcoMind-OS
\\\

### 2. 启动前端（开发模式）

\\\ash
cd frontend
pnpm install   # 安装 678 个依赖包
pnpm dev       # 启动 Vite 开发服务器（默认 http://localhost:5173）
\\\

### 3. 启动后端（FastAPI）

\\\ash
cd backend/taiji-agent
pip install -e ".[dev]"   # 安装 TAIJI-AGENT 2.0（112 个模块）
pytest tests/                # 运行集成测试（38/38 PASS）
\\\

### 4. 启动推理引擎（可选）

\\\ash
# vLLM 部署（需要 GPU）
cd backend/vllm
docker-compose up -d

# 或 SGLang 部署
cd backend/inference
bash start_sglang.sh
\\\

---

## 🛠️ 开发指南

### 前端技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 18.3.1 | UI 框架 |
| TypeScript | 5.7.3 | 类型安全 |
| Vite | 6.1.0 | 构建工具 |
| Ant Design | 5.24.0 | UI 组件库 |
| Ant Design Pro | 7.21.3 | 企业级布局 |
| Cesium | 1.127.0 | 3D 地图 |
| ECharts | 5.6.0 | 数据可视化 |
| Zustand | 5.0.3 | 状态管理 |
| Tailwind CSS | 4.1.7 | 原子化样式 |
| i18next | 24.2.3 | 国际化 |
| Socket.IO Client | 4.8.1 | WebSocket 通信 |

### 后端技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| FastAPI | 最新 | Web 框架 |
| TAIJI-AGENT | 2.0 | Agent 核心框架（112 模块） |
| LangGraph | 最新 | 工作流编排 |
| CrewAI | 最新 | 团队协作编排 |
| LiteLLM | 最新 | 模型路由代理 |
| Hermes | 最新 | 记忆系统 |
| Mem0 | 最新 | 用户偏好记忆 |
| Graphiti | 最新 | 时序知识图谱 |
| GraphRAG | 最新 | 长期知识库检索 |

### 可用脚本

#### 前端

\\\ash
cd frontend
pnpm dev        # 启动开发服务器（热更新）
pnpm build      # 构建生产版本（输出到 dist/）
pnpm preview    # 预览生产版本
pnpm lint       # ESLint 代码检查
pnpm format     # Prettier 格式化
\\\

#### 后端

\\\ash
cd backend/taiji-agent
pytest tests/                          # 运行集成测试
python -m taiji_agent.agent.engine     # 启动 Agent 引擎
python backend/inference/adapter.py     # 启动推理适配器
\\\

---

## 📊 项目状态

### Phase 1A（✅ 已完成）

| 模块 | 状态 | 说明 |
|------|------|------|
| 后端集成测试 | ✅ 38/38 PASS | TAIJI-AGENT + GOVMCP + VERIFY 全通过 |
| 前端构建 | ✅ 通过 | Vite build 1m20s, pnpm 678 包 |
| Dashboard 原型 | ✅ 完成 | 4 统计卡片 + Agent 表 + 3 ECharts 图 + 安全表 + 审批队列 |
| 9 模块路由 | ✅ 完成 | Dashboard/Agents/Workflows/Security/Models/Domains/Conversations/Cesium/Settings |
| i18n 双语 | ✅ 完成 | zh-CN + en-US |
| 亮色/暗色主题 | ✅ 完成 | Ant Design ConfigProvider + Tailwind CSS |

### Phase 1B（🔶 进行中）

| 模块 | 状态 | 说明 |
|------|------|------|
| Cesium 3D 场景 | 🔶 占位 | 湖南省地形 + 监测站点叠加 |
| 后端 API 服务 | 🔶 进行中 | FastAPI 启动脚本 + 数据库连接 |
| 前后端 WebSocket 联调 | 🔶 进行中 | Socket.IO 实时通信 |
| 国产模型本地推理 | 🔶 进行中 | vLLM / SGLang 部署 |
| LiteLLM 适配配置 | 🔶 进行中 | 模型路由规则配置 |

---

## 🎨 品牌视觉识别（VI）

EcoMind OS 拥有完整的 **VI 品牌视觉识别系统**，核心理念为 **"会思考的生态大脑"**：

- 🍃 **Logo**：融合叶脉轮廓与 AI 神经网络拓扑结构
- 🎨 **色彩系统**：生态绿 #00C9A7 → 智慧青 #0E7490（呼吸式循环渐变）
- 📐 **辅助图形**：生态数据网格 + 参数化生长单元 + 意识流光线
- 🔤 **字体系统**：思源黑体（中文）/ Inter（英文）/ DM Sans（数据）
- 🌐 **品牌口号**：
  - 英文：*Intelligence that Nurtures the Planet.*
  - 中文：*以智慧，哺育星球。*

> 📖 **完整 VI 手册**：[VI/EcoMind_OS_VI_Brand_Manual.md](./VI/EcoMind_OS_VI_Brand_Manual.md)

---

## 🤝 贡献指南

我们欢迎任何形式的贡献！

### 贡献流程

1. **Fork 本仓库**
2. **创建特性分支**：git checkout -b feature/YourFeature
3. **提交更改**：git commit -m "feat: 描述你的更改"
4. **推送到全局**：git push origin feature/YourFeature
5. **创建 Pull Request**

### 代码规范

- **Python**：遵循 PEP 8，使用 uff 格式化
- **TypeScript**：遵循 ESLint 规则，使用 Prettier 格式化
- **提交信息**：遵循 [Conventional Commits](https://www.conventionalcommits.org/)

###  issue 报告

请使用 [GitHub Issues](https://github.com/xiejianjun000/EcoMind-OS/issues) 报告 Bug 或提出新功能建议。

---

## 📄 许可证

本项目采用 **Apache License 2.0** 开源许可证。

See [LICENSE](./LICENSE) for details.

---

## 📞 联系方式

- **GitHub**：[@xiejianjun000](https://github.com/xiejianjun000)
- **项目地址**：[EcoMind-OS](https://github.com/xiejianjun000/EcoMind-OS)
- **Issues**：[Report a bug](https://github.com/xiejianjun000/EcoMind-OS/issues)

---

## 🙏 致谢

- **TAIJI-AGENT**：国产 AI Agent 框架
- **FastAPI**：高性能 Python Web 框架
- **React**：Facebook 开源 UI 框架
- **Cesium**：3D 地理空间可视化平台
- **Ant Design**：企业级 UI 设计语言

---

<p align="center">
  <em>🌱 EcoMind OS — 生态，自此思考。</em><br/>
  <em>🌍 Intelligence that Nurtures the Planet.</em>
</p>