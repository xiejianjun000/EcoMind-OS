# EcoMind OS 技术开发方案 v5.0 — 双模式部署 + 生产级前端UI

> **版本**: v5.0（基于 v4.0 + 两项重大升级）
> **日期**: 2026-05-25
> **状态**: 评估分析完成 · 待开发
> **编制**: 齐活林（Qi）· 交付总监
> **变更**: v4.0 → v5.0 两项重大升级

---

## 目录

1. [v4.0 → v5.0 变更摘要](#1-v40--v50-变更摘要)
2. [D15 修订：本地+云端双模式部署](#2-d15-修订本地云端双模式部署)
3. [D17 新增：生产级前端UI可视化](#3-d17-新增生产级前端ui可视化)
4. [双模式部署网络拓扑](#4-双模式部署网络拓扑)
5. [前端产品架构 — 9大模块](#5-前端产品架构--9大模块)
6. [模型智能路由策略](#6-模型智能路由策略)
7. [安全分层策略](#7-安全分层策略)
8. [前端技术架构](#8-前端技术架构)
9. [更新后 Phase 1 实施计划](#9-更新后-phase-1-实施计划)
10. [风险评估与缓解](#10-风险评估与缓解)
11. [v5.0 完整决策矩阵](#11-v50-完整决策矩阵)

---

## 1. v4.0 → v5.0 变更摘要

| # | 变更项 | v4.0 方案 | v5.0 方案 | 影响级别 |
|---|--------|----------|----------|---------|
| 1 | 部署模式 | 纯本地部署（政务内网/私有化） | **本地+云端双模式部署（可热切换）** | 🔴 架构级变更 |
| 2 | 前端UI | React + Cesium.js（概念性提及） | **生产级9模块前端产品** | 🔴 新增完整子系统 |

**v5.0 不改变的内容**：
- v4.0 的 D1-D14、D16 决策
- TAIJI-AGENT 后端框架
- 文件知识预加载三层架构
- 国产模型兼容策略
- 安全验证六层架构

**v5.0 新增/修改的内容**：
- D15 修订：从"纯本地"改为"本地+云端双模式"
- D17 新增：生产级前端UI可视化

---

## 2. D15 修订：本地+云端双模式部署

### 2.1 核心设计理念

**"本地优先、云端可切换"** — 不是非此即彼，而是根据业务安全等级和负载情况智能路由。

### 2.2 三种部署模式

| 模式 | 描述 | 适用场景 | 安全等级 |
|------|------|---------|---------|
| **Local** | 纯本地推理，无外网依赖 | 政务内网/等保三级 | 最高 — 全量国密 |
| **Cloud** | 全部走云端API | 开发测试/非敏感场景 | 中等 — HTTPS+脱敏 |
| **Hybrid**（默认） | 敏感走本地，非敏感走云端 | 生产环境推荐 | 智能分层 |

### 2.3 降级回退策略

```
请求进入 → 安全分类器判断
  ├── L3（执法/审批/公文）→ 强制本地 → 本地不可用 → 拒绝+告警（不可降级到云端）
  ├── L2（监测数据查询/报告生成）→ 优先本地 → 本地过载 → 数据脱敏后路由到云端
  └── L1（公众服务/简单查询）→ 负载均衡 → 本地优先/云端优先均可
```

### 2.4 配置热切换

通过前端 Dashboard 顶部的部署模式切换器（Local / Cloud / Hybrid），一键切换全局路由策略。切换时：
- 正在执行的 L3 任务**不会中断**
- 新请求按新策略路由
- 切换操作记录审计日志
- 需要 L2 确认（点击确认按钮）

---

## 3. D17 新增：生产级前端UI可视化

### 3.1 产品定位

EcoMind OS 的前端不是简单的管理后台，而是**生态环境智能操作系统的控制中枢**——需要覆盖从 Agent 配置到安全治理到数字孪生的全部操作。

### 3.2 竞品参考

| 竞品 | 优势 | 借鉴点 |
|------|------|--------|
| **openclaw-dashboard** | React+AntD+Vite，6大管理模块成熟 | Agent管理+对话追踪+工具库+数据分析的交互范式 |
| **Agentspanel UI** | MCP服务器配置+多租户 | MCP工具注册/配置的管理界面 |
| **LangGraph Studio** | 图可视化+时间旅行调试+聊天模式 | Agent工作流IDE的标准交互 |
| **CrewAI Enterprise AMP** | 可视化角色编辑器+任务分配 | 团队编排的可视化交互 |

**EcoMind OS 的差异化**：融合4家优势 + 领域特色（12业务域+国密+审批流+数字孪生）

### 3.3 生产级要求

- **i18n**：中英双语（政务场景中文优先，国际合作英文）
- **主题**：暗色/亮色切换（监控中心暗色，办公环境亮色）
- **响应式**：支持大屏（4K数字孪生）/桌面/平板
- **等保合规**：登录双因子+操作审计+敏感操作二次确认
- **性能**：首屏 < 2s，数据刷新 < 500ms

---

## 4. 双模式部署网络拓扑

```
┌──────────────────────────────────────────────────────────────────────┐
│                         用户 / 运维 / 开发者                         │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ HTTPS / WSS
┌──────────────────────────────▼───────────────────────────────────────┐
│                    Nginx 反向代理 + SSL 终端                          │
│                    (域名路由 + 负载均衡 + 静态资源)                    │
└───────────┬──────────────────────────────────────────┬───────────────┘
            │                                          │
   ┌────────▼────────┐                       ┌────────▼────────┐
   │  政务内网区域    │                       │  互联网区域      │
   │  (等保二级/三级) │                       │  (HTTPS + 脱敏)  │
   │                  │                       │                  │
   │ ┌──────────────┐ │                       │ ┌──────────────┐ │
   │ │ 前端静态资源  │ │                       │ │ 前端静态资源  │ │
   │ │ React SPA    │ │                       │ │ React SPA    │ │
   │ └──────────────┘ │                       │ └──────────────┘ │
   │ ┌──────────────┐ │                       │ ┌──────────────┐ │
   │ │ OpenClaw GW  │ │                       │ │ OpenClaw GW  │ │
   │ └───────┬──────┘ │                       │ └───────┬──────┘ │
   │         │        │                       │         │        │
   │ ┌───────▼──────┐ │                       │ ┌───────▼──────┐ │
   │ │ Agent 编排    │ │                       │ │ Agent 编排    │ │
   │ │ LangGraph    │ │                       │ │ LangGraph    │ │
   │ │ + CrewAI     │ │                       │ │ + CrewAI     │ │
   │ └───────┬──────┘ │                       │ └───────┬──────┘ │
   │         │        │                       │         │        │
   │ ┌───────▼──────┐ │                       │ ┌───────▼──────┐ │
   │ │ LLM 推理     │ │                       │ │ LLM 云端 API │ │
   │ │ vLLM/SGLang  │ │                       │ │ LiteLLM      │ │
   │ │ (GPU 本地)   │ │                       │ │ (Qwen/GLM/   │ │
   │ │              │ │                       │ │  DeepSeek)   │ │
   │ └──────────────┘ │                       │ └──────────────┘ │
   │ ┌──────────────┐ │                       │                  │
   │ │ GOVMCP 国密  │ │                       │  (无国密服务)    │
   │ │ SM2/3/4+审批 │ │                       │                  │
   │ └──────────────┘ │                       │                  │
   │ ┌──────────────┐ │                       │                  │
   │ │ VERIFY 六层  │ │                       │                  │
   │ └──────────────┘ │                       │                  │
   │ ┌──────────────┐ │                       │                  │
   │ │ 数据层        │ │                       │                  │
   │ │ PG+pgvector  │ │                       │                  │
   │ │ Neo4j+Redis  │ │                       │                  │
   │ └──────────────┘ │                       │                  │
   └──────────────────┘                       └──────────────────┘
            │                                          │
            └────────── 智能路由器（EcoRouter）─────────┘
                        安全分类 + 负载感知 + 降级回退
```

---

## 5. 前端产品架构 — 9大模块

### 5.1 模块总览

| # | 模块 | 核心页面 | 关键交互 |
|---|------|---------|---------|
| 1 | Dashboard 总览 | `/dashboard` | 部署模式切换+KPI卡片+Agent状态+安全告警 |
| 2 | Agent 管理中心 | `/agents`, `/agents/:id` | Agent配置/启停/技能编辑/知识预加载状态 |
| 3 | 工作流编排 | `/workflows`, `/workflows/:id` | LangGraph状态图+CrewAI团队配置+时间旅行 |
| 4 | 安全治理中心 | `/security`, `/security/approval/:id` | VERIFY面板+GOVMCP审批流+国密证书管理 |
| 5 | 模型管理 | `/models`, `/models/fine-tune` | 本地/云端路由配置+LoRA微调+成本分析 |
| 6 | 业务域配置 | `/domains`, `/domains/:id` | 12业务域热力图+法规库+RAG检索面板 |
| 7 | 对话与审计 | `/conversations`, `/audit` | 对话流追踪+工具调用记录+审批历史 |
| 8 | 数据与物联 | `/data`, `/iot`, `/cesium` | Cesium.js 3D+EMQX设备+监测图表 |
| 9 | 系统设置 | `/settings/users`, `/settings/compliance` | RBAC+等保合规+部署配置+日志 |

### 5.2 Dashboard 总览页设计

**布局**：
- 顶部：部署模式切换器（Local / Cloud / Hybrid）
- KPI卡片行：Active Agents / Model Load / Security Alerts / Pending Approvals
- 左侧：Agent Status（4类Agent实时状态）
- 右侧：Model Routing（本地/云端模型负载）
- 底部：Security Events + Pending Approvals (GOVMCP)

### 5.3 模型管理页设计

**布局**：
- 左侧：Local Models (GPU) — GPU占用率可视化
- 右侧：Cloud APIs — RPM调用频率
- 中间：Routing Rules（Agent → Model 映射，标注 Local only / Cloud preferred）
- 底部：LoRA微调训练状态 + 成本分析（本地GPU电费 vs 云端API费用）

---

## 6. 模型智能路由策略

### 6.1 路由决策树

```
请求到达 EcoRouter
  │
  ├── 判断安全等级（基于Agent类型 + 请求内容分类）
  │   │
  │   ├── L3（执法/审批/公文签发）
  │   │   → 强制本地模型
  │   │   → 本地不可用 → 拒绝请求 + 告警（不可降级到云端）
  │   │
  │   ├── L2（监测数据/报告生成/环境分析）
  │   │   → 优先本地模型
  │   │   → 本地GPU负载 > 85% → 数据脱敏 → 路由到云端API
  │   │   → 云端也不可用 → 排队等待本地资源
  │   │
  │   └── L1（公众查询/简单问答/数据展示）
  │       → 负载均衡（本地+云端）
  │       → 本地优先（成本更低）
  │       → 本地过载 → 切换到云端
  │
  └── 记录路由决策到审计日志
```

### 6.2 模型路由映射表

| Agent | 默认模型 | 部署位置 | 降级策略 | 安全等级 |
|-------|---------|---------|---------|---------|
| 执法监察 | Qwen3-72B | Local only | 不可降级 | L3 |
| 政务审批 | DeepSeek-R1-671B | Local (Cloud fallback) | 脱敏后可降级 | L3→L2 |
| 环境监测 | GLM-4-9B | Cloud preferred | 本地备选 | L2 |
| 公众服务 | MiniCPM-4B | 负载均衡 | 双向切换 | L1 |

### 6.3 数据脱敏规则（云端降级时）

| 数据类型 | 脱敏方式 | 示例 |
|---------|---------|------|
| 个人信息 | 哈希替换 | 张三→USER_001 |
| 地理坐标 | 偏移扰动 | 39.9042°→39.90xx° |
| 企业名称 | 代号替换 | XX化工→ENTERPRISE_012 |
| 审批编号 | 前缀+序号 | EIA-2026-0042→APPROVAL_042 |

---

## 7. 安全分层策略

### 7.1 本地模式安全策略

| 安全层 | 实现 | 状态 |
|--------|------|------|
| 身份认证 | GOVMCP SM2 数字证书 | ✅ 已有 |
| 传输加密 | SM4 对称加密 | ✅ 已有 |
| 数据存储 | SM4 加密 + 全量本地 | ✅ 已有 |
| 审批流程 | GOVMCP 8状态审批流 | ✅ 已有 |
| 验证引擎 | TAIJI-VERIFY 六层验证 | ✅ 已有 |
| 等保合规 | 等保二级（起步）/三级（目标） | 🔶 部分覆盖 |

### 7.2 云端模式安全策略

| 安全层 | 实现 | 状态 |
|--------|------|------|
| 身份认证 | JWT + RBAC | 🆕 需新增 |
| 传输加密 | HTTPS (TLS 1.3) | 🆕 需新增 |
| 数据存储 | 数据脱敏 + 不存储原始数据 | 🆕 需新增 |
| 审批流程 | 简化审批（L1自动/L2确认） | 🆕 需新增 |
| 验证引擎 | 轻量验证（L1-L3层） | 🆕 需新增 |
| 审计日志 | 全量API调用记录 | 🆕 需新增 |

### 7.3 安全分层对比

| 维度 | 本地模式 | 云端模式 | Hybrid模式 |
|------|---------|---------|-----------|
| 数据主权 | 完全本地 | 脱敏后上云 | 按安全等级分流 |
| 国密支持 | SM2/SM3/SM4全量 | 不适用 | 敏感操作走本地国密 |
| 审批流 | 8状态全量审批 | 简化2状态 | 按等级匹配 |
| 验证深度 | 六层全量 | 三层轻量 | 按等级匹配 |
| 等保等级 | 二级/三级 | 不适用（非内网） | 内网部分二级/三级 |

---

## 8. 前端技术架构

### 8.1 技术栈

| 类别 | 选型 | 理由 |
|------|------|------|
| 框架 | React 18 + TypeScript | 生态成熟，Ant Design Pro 生态完善 |
| 构建 | Vite 6 | 极速HMR，生产级打包 |
| UI组件 | Ant Design Pro 6 | 企业级后台标准，开箱即用ProLayout/ProTable/ProForm |
| 3D可视化 | Cesium.js | 数字孪生/地图/GIS生态标准 |
| 图表 | ECharts 5 | 国产开源，生态丰富，政府场景常用 |
| 状态管理 | Zustand | 轻量、类型安全、比Redux简洁 |
| 样式 | Tailwind CSS + CSS Modules | 工具类+局部样式双模式 |
| 实时通信 | Socket.IO | Agent状态/对话流/审批通知实时推送 |
| 路由 | React Router 6 | 标准SPA路由 |
| 国际化 | react-i18next | 成熟i18n方案 |
| 主题 | Ant Design Token + CSS变量 | 暗色/亮色主题 |

### 8.2 项目目录结构

```
ecomind-os-ui/
├── public/
├── src/
│   ├── layouts/           # ProLayout 布局
│   │   ├── BasicLayout.tsx
│   │   └── BlankLayout.tsx
│   ├── pages/             # 9大模块页面
│   │   ├── dashboard/     # Dashboard 总览
│   │   ├── agents/        # Agent 管理中心
│   │   ├── workflows/     # 工作流编排
│   │   ├── security/      # 安全治理中心
│   │   ├── models/        # 模型管理
│   │   ├── domains/       # 业务域配置
│   │   ├── conversations/ # 对话与审计
│   │   ├── data/          # 数据与物联
│   │   └── settings/      # 系统设置
│   ├── components/         # 通用组件
│   │   ├── DeployModeToggle/  # 部署模式切换器
│   │   ├── AgentStatusCard/   # Agent状态卡片
│   │   ├── ModelRoutePanel/   # 模型路由面板
│   │   ├── LangGraphViewer/   # LangGraph状态图组件
│   │   ├── CesiumScene/       # Cesium 3D场景
│   │   └── ApprovalTimeline/  # 审批时间线
│   ├── services/           # API服务层
│   │   ├── agentService.ts
│   │   ├── modelService.ts
│   │   ├── securityService.ts
│   │   └── workflowService.ts
│   ├── stores/             # Zustand状态
│   │   ├── useDeployMode.ts
│   │   ├── useAgentStore.ts
│   │   └── useModelStore.ts
│   ├── hooks/              # 自定义Hooks
│   ├── utils/              # 工具函数
│   ├── locales/            # i18n资源
│   │   ├── zh-CN/
│   │   └── en-US/
│   └── types/              # TypeScript类型定义
├── docker/
│   ├── Dockerfile
│   └── nginx.conf
├── .env.local
├── .env.production
└── package.json
```

### 8.3 API设计（核心端点）

| 模块 | 端点 | 方法 | 描述 |
|------|------|------|------|
| Dashboard | `/api/v1/system/status` | GET | 系统状态总览 |
| Dashboard | `/api/v1/deploy/mode` | GET/PUT | 部署模式切换 |
| Agent | `/api/v1/agents` | GET | Agent列表 |
| Agent | `/api/v1/agents/:id` | GET/PUT | Agent详情/配置 |
| Agent | `/api/v1/agents/:id/start` | POST | 启动Agent |
| Agent | `/api/v1/agents/:id/stop` | POST | 停止Agent |
| Workflow | `/api/v1/workflows` | GET | 工作流列表 |
| Workflow | `/api/v1/workflows/:id/state` | GET | LangGraph状态图 |
| Workflow | `/api/v1/workflows/:id/debug` | POST | 时间旅行调试 |
| Security | `/api/v1/security/alerts` | GET | 安全告警 |
| Security | `/api/v1/approval/pending` | GET | 待审批列表 |
| Security | `/api/v1/approval/:id/action` | POST | 审批操作 |
| Model | `/api/v1/models` | GET | 模型列表（含本地/云端） |
| Model | `/api/v1/models/routing` | GET/PUT | 路由规则配置 |
| Model | `/api/v1/models/fine-tune` | POST | 启动微调训练 |
| Domain | `/api/v1/domains` | GET | 业务域列表+覆盖状态 |
| Conversation | `/api/v1/conversations` | GET | 对话历史 |
| Conversation | `/api/v1/audit/logs` | GET | 审计日志 |
| Data | `/api/v1/data/monitoring` | GET | 监测数据 |
| IoT | `/api/v1/iot/devices` | GET | IoT设备列表 |

### 8.4 WebSocket事件

| 事件 | 方向 | 描述 |
|------|------|------|
| `agent.status` | Server→Client | Agent状态变更 |
| `model.load` | Server→Client | 模型负载更新 |
| `security.alert` | Server→Client | 安全告警推送 |
| `approval.update` | Server→Client | 审批状态变更 |
| `conversation.message` | Server→Client | 对话消息流 |
| `workflow.step` | Server→Client | 工作流步骤执行 |
| `deploy.mode` | Client→Server | 部署模式切换请求 |

### 8.5 生产级部署方案

```nginx
# nginx.conf
server {
    listen 443 ssl http2;
    server_name ecomind.example.gov.cn;

    ssl_certificate     /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;

    # 前端静态资源
    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API代理
    location /api/ {
        proxy_pass http://backend:8080/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket代理
    location /ws/ {
        proxy_pass http://backend:8080/ws/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

---

## 9. 更新后 Phase 1 实施计划

### Phase 1A：基础验证 + 前端脚手架（3 周）

| # | 任务 | 内容 | 验收标准 |
|---|------|------|---------|
| T1 | TAIJI-AGENT 本地启动 | 克隆自有仓库，本地启动 Agent Loop | 单 Agent 能接收请求→推理→返回 |
| T2 | GOVMCP 验证 | 确认内嵌 GOVMCP 三层集成可用 | SM2 签名/验签 + 审批流跑通 |
| T3 | vLLM/SGLang 部署 | 部署 Qwen3-14B 到本地 GPU | OpenAI-compatible API 可用 |
| T4 | LiteLLM 适配 | 配置 LiteLLM 接 vLLM + 云端API | Agent 能通过 LiteLLM 调用本地/云端模型 |
| T5 | 前端脚手架 | Vite + React + AntD Pro + Cesium + i18n | `pnpm dev` 启动，9大模块路由可导航 |
| T6 | Dashboard 原型 | 总览页 + 部署模式切换器 | 页面可渲染，模式切换按钮可交互 |

### Phase 1B：文件预加载 + 模型管理页（3 周）

| # | 任务 | 内容 | 验收标准 |
|---|------|------|---------|
| T7 | 文件索引引擎 | LlamaIndex 扫描桌面文件 → 向量化 | 全部 1445 文件完成索引 |
| T8 | 三层加载实现 | Layer 1/2/3 分级加载逻辑 | Agent 启动时自动加载对应层级知识 |
| T9 | RAG 检索集成 | pgvector + 语义检索 | Agent 能检索到相关文件内容 |
| T10 | 模型管理页 | 本地/云端模型列表 + 路由规则 + 成本分析 | 前端可查看/修改路由规则 |
| T11 | EcoRouter 原型 | 模型智能路由（安全分类+负载感知） | L3强制本地/L1负载均衡逻辑跑通 |

### Phase 1C：Agent + 工作流 + 安全页（3 周）

| # | 任务 | 内容 | 验收标准 |
|---|------|------|---------|
| T12 | 环境监测 Agent | 第一个可运行的 Agent | 用户问"PM2.5为什么飙升"→ Agent 返回根因 |
| T13 | MCP 工具接入 | 最少3个工具（法规查询/数据查询/报告生成） | Agent 能调用 MCP 工具 |
| T14 | Agent 管理页 | Agent配置/启停/技能/知识状态 | 前端可管理Agent全生命周期 |
| T15 | 工作流编排页 | LangGraph状态图可视化 | 工作流执行过程可可视化追踪 |
| T16 | 安全治理页 | VERIFY面板+审批流+国密证书 | 告警可查看/审批可操作 |

### Phase 1D：国产模型适配 + 数据物联页（3 周）

| # | 任务 | 内容 | 验收标准 |
|---|------|------|---------|
| T17 | EcomodelAdapter | 非 OpenAI-compatible 模型适配 | ChatGLM 能通过适配器接入 |
| T18 | 降级策略实现 | 本地过载→云端降级+数据脱敏 | 本地GPU>85%时自动路由到云端 |
| T19 | LoRA 微调 POC | Qwen3-14B + 环保领域指令 | 微调后执法问答准确率提升 10%+ |
| T20 | 数据物联页 | Cesium 3D + ECharts + EMQX设备 | 地图可渲染/设备状态可查看 |

### Phase 1E：集成验证 + 生产化（2 周）

| # | 任务 | 内容 | 验收标准 |
|---|------|------|---------|
| T21 | Docker Compose 编排 | 全栈本地部署 + 云端模式配置 | `docker-compose up` 一键启动 |
| T22 | i18n + 主题系统 | 中英双语 + 暗色/亮色切换 | 切换语言/主题无闪烁 |
| T23 | 等保二级自评估 | 安全合规检查 | 通过等保二级差距分析 |
| T24 | 端到端 Demo | 完整闭环演示（3种模式） | 从用户请求到Agent响应全链路跑通 |

**Phase 1 总工期：14 周（含 3 周缓冲）**

---

## 10. 风险评估与缓解

| # | 风险 | 概率 | 影响 | 缓解措施 |
|---|------|------|------|---------|
| R1 | 云端API密钥泄露 | 中 | 高 | 密钥存储在GOVMCP加密模块；API密钥不落盘；审计全量记录 |
| R2 | 双模式切换导致状态不一致 | 中 | 高 | 切换时冻结L3任务；新请求按新策略路由；WebSocket推送状态变更 |
| R3 | 数据脱敏不完整 | 高 | 高 | 脱敏规则库+正则匹配+AI辅助识别+人工抽检 |
| R4 | 前端9大模块开发量巨大 | 高 | 中 | AntD Pro开箱即用+ProTable/ProForm减少80%代码；分3期交付 |
| R5 | Cesium.js 大屏性能 | 中 | 中 | 3D Tiles + LOD + WebWorker；4K大屏单独优化 |
| R6 | 云端API响应不稳定 | 中 | 中 | 重试3次+超时5s+降级到本地+备用API |
| R7 | 等保合规与云端模式冲突 | 低 | 高 | 云端模式不声明等保；等保范围限定在内网区域 |

---

## 11. v5.0 完整决策矩阵

| 决策 | 版本 | 选择 | 状态 |
|------|------|------|------|
| D1 后端核心 | v1.0 | TAIJI-AGENT (自有仓库) | 不变 |
| D2 验证引擎 | v1.0 | TAIJI-VERIFY (pip) | 不变 |
| D3 记忆系统 | v1.0 | Hermes MemoryProvider | 不变 |
| D4 路由编排 | v1.0 | OpenClaw Gateway + ACP | 不变 |
| D5 OpenHuman | v1.0 | 仅参考设计 | 不变 |
| D6 记忆升级 | v2.0 | Mem0+Graphiti+GraphRAG | 不变 |
| D7 L5八层防御 | v2.0 | 象信+NeMo+LettuceDetect+Langfuse | 不变 |
| D8 数据三合一 | v2.0 | TimescaleDB+PostGIS | 不变 |
| D9 协议矩阵 | v2.0 | MCP+ACP+A2A | 不变 |
| D10 本地推理 | v2.0 | SGLang+vLLM | 不变（强化云端备选） |
| D11 Agent团队 | v2.0 | LangGraph+CrewAI | 不变 |
| D12 提示词工程 | v3.0 | wshobson三层+CreatorEdition双模式 | 不变 |
| D13 仓库策略 | v4.0 | 自有 Git 仓库 | 不变 |
| D14 模型兼容 | v4.0 | 全量国产模型+本地微调 | 不变（新增云端API） |
| **D15 部署架构** | **v5.0** | **本地+云端双模式部署（可热切换）** | **修订** |
| D16 文件预加载 | v4.0 | 三层渐进加载+RAG+watchdog | 不变 |
| **D17 前端UI** | **v5.0** | **生产级9模块前端（AntD Pro+Cesium）** | **新增** |

---

## 附录：D15 修订历史

| 版本 | 内容 | 日期 |
|------|------|------|
| v4.0 | D15 纯本地部署（政务内网/私有化） | 2026-05-25 |
| v5.0 | D15 修订为本地+云端双模式部署 | 2026-05-25 |

## 附录：D17 新增详情

| 属性 | 值 |
|------|-----|
| 决策编号 | D17 |
| 决策名称 | 生产级前端UI可视化 |
| 技术栈 | React 18 + TypeScript + Vite + Ant Design Pro + Cesium.js + ECharts + Zustand + Tailwind CSS + Socket.IO |
| 模块数 | 9大模块 |
| 页面数 | 15+页面 |
| 竞品参考 | openclaw-dashboard + Agentspanel UI + LangGraph Studio + CrewAI AMP |
| 生产要求 | i18n中英双语 + 暗色/亮色主题 + 响应式 + 等保合规UI + 首屏<2s |
