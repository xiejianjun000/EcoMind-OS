# EcoMind OS — 目录结构

> 顶层目录变动时 AI 自动更新。

```
EcoMind-OS/
│
├── frontend/                       # React 18 前端（Vite + AntD Pro）
│   └── src/
│       ├── router/index.tsx        # 22 条路由 + AuthGuard
│       ├── layouts/MainLayout.tsx  # AntD ProLayout 侧边栏
│       ├── store/                  # 6 个 Zustand Store
│       │   ├── authStore.ts        # RBAC 4 角色 17 账号
│       │   ├── appStore.ts         # 主题/语言/WS 状态
│       │   └── deptStore.ts        # 部门状态
│       ├── pages/                  # 20+ 页面模块
│       │   ├── Dashboard/          # 总览大屏（KPI+图表）
│       │   ├── Cesium/             # 湖南 3D 地形
│       │   ├── CommandCockpit/     # 厅领导驾驶舱
│       │   ├── ChiefDashboard/     # 处长工作台
│       │   ├── CityDashboard/      # 市州工作台
│       │   ├── Login/              # 角色快捷登录
│       │   ├── Enforcement/        # 执法办案（占位）
│       │   ├── Approval/           # 审批中心（占位）
│       │   ├── Security/           # 安全态势+审批+审计
│       │   ├── Agents/             # Agent 管理
│       │   ├── Workflows/          # 工作流编排
│       │   ├── Models/             # 模型路由管理
│       │   ├── Skills/             # 技能管理（占位）
│       │   ├── MemoryKnowledge/    # 记忆+知识图谱（占位）
│       │   ├── Reports/            # 报告生成（占位）
│       │   ├── Compliance/         # 合规检查（占位）
│       │   ├── AuditLog/           # 审计日志
│       │   ├── Users/              # 三员分立用户管理
│       │   └── Departments/        # 部门配置
│       ├── components/             # 通用组件
│       │   ├── AuthGuard.tsx       # 路由守卫
│       │   ├── RoleSwitcher.tsx    # 开发角色切换
│       │   ├── HunanMapChart.tsx   # 湖南 ECharts 地图
│       │   ├── StatusBadge.tsx     # 状态徽章
│       │   └── TimelineView.tsx    # 时间线
│       ├── services/               # API 层
│       └── locales/                # 中英双语文件
│
├── backend/                        # FastAPI 后端
│   ├── api/
│   │   ├── main.py                 # 应用入口（85行）
│   │   ├── routers/                # 6 个路由模块
│   │   │   ├── agents.py           # Agent CRUD + 消息
│   │   │   ├── workflows.py        # 工作流管理
│   │   │   ├── security.py         # 安全事件+审批+审计
│   │   │   ├── models.py           # 模型列表+路由+健康
│   │   │   ├── departments.py      # 部门管理
│   │   │   └── environment.py      # 环境数据对接
│   │   ├── services/               # 业务服务
│   │   ├── schemas/                # Pydantic 模型
│   │   └── websocket/              # WebSocket 管理
│   ├── engine/                     # ⭐ 自建 Agent 引擎
│   │   ├── loop.py                 # 对话循环+SSE流式（507行）
│   │   ├── tool_registry.py        # 工具注册+Schema导出（200行）
│   │   ├── verify.py               # 输出验证（172行）
│   │   └── memory.py               # SQLite三层记忆（290行）
│   ├── govmcp/                     # ⭐ 国密协议层（2,962行）
│   │   ├── crypto.py               # SM2/SM3/SM4（449行）
│   │   ├── server.py               # 20 MCP工具+安全通道（711行）
│   │   ├── workflow.py             # 8状态审批流（411行）
│   │   ├── tools.py                # 数据脱敏/验证（408行）
│   │   └── plugins.py              # Taiji Plugin适配（251行）
│   ├── skills/                     # ECC 技能系统
│   │   ├── ecc_bridge.py           # 技能加载器+Instincts
│   │   └── ecc/hunan-agents/       # 湖南省厅Agent映射
│   │       ├── AGENT-MAPPING.md    # P0-P3四级映射表
│   │       ├── agent-*.md          # 9个Agent定义
│   │       └── workspaces/         # 4个工作空间
│   ├── memory/                     # Claude-Mem桥接
│   ├── safety/                     # 安全技能层（骨架）
│   ├── graph/                      # 知识图谱适配（骨架）
│   ├── inference/                  # 推理引擎配置
│   └── litellm-proxy/              # LiteLLM代理
│
├── data/                           # 数据存储
│   └── ecomind_memory.db           # SQLite记忆数据库
│
├── docs/                           # 设计文档
│   ├── TECHNICAL_PLAN_V6.5.md      # 30天实施路线图（1090行）
│   ├── class-diagram.mermaid       # 完整类图（337行）
│   └── sequence-diagram.mermaid    # 核心时序图（74行）
│
├── VI/                             # 品牌视觉识别手册
├── deliverables/                   # Phase 1A + 1B交付报告
├── .github-clone/                  # 19篇分析文档+历史版本
├── vendor/                         # 外部依赖本地化
│   └── taiji-agent-govmcp/         # ⚠️ 与backend/govmcp重复
├── agent-prompts-collection/       # Agent Prompt集合（空，规划中）
│
├── spec/                           # 项目规格文档（SpecCoding）
│   ├── requirements.md             # 需求规格书
│   ├── design.md                   # 架构设计书
│   ├── tasks.md                    # 里程碑任务清单（33项）
│   ├── devlog.md                   # 开发日志
│   └── structure.md                # 目录结构（本文件）
│
├── README.md                       # 项目说明
└── 四大框架核心优势解析.docx        # 架构对比文档
```

---

> AI 维护。顶层目录变动时更新。