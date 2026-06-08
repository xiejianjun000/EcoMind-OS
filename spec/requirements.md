# EcoMind OS — 需求规格书

> 版本：1.0 | 仓库：xiejianjun000/EcoMind-OS | 最后更新：2026-05-27
> 对标：湖南省生态环境厅 AI Agent 平台

---

## 一、项目愿景

**EcoMind OS** ——「以智慧，哺育星球」。面向湖南省生态环境厅及其下辖 14 个市州、122 个区县的垂直领域 AI Agent 管理平台。核心理念是"会思考的生态大脑"，将环境监测、执法办案、环评审批、政务合规四大业务线统一到一个 AI 驱动的指挥体系中。

**规模目标**：~2,320 个 Agent 身份实例（省厅 400 + 14市州 700 + 122区县 1,220），覆盖约 400 台个人工作站。

---

## 二、目标用户

| 角色 | 场景 | 核心诉求 |
|:---|:---|:---|
| **🏛️ 厅领导** | 指挥驾驶舱 | 全省生态环境态势一屏纵览，宏观决策支撑 |
| **👔 处长** | 处长工作台 | 本部门数据、环境指标、审批任务、执法案件 |
| **🏙️ 市州** | 市州工作台 | 本市数据、属地管理、环境监测、执法执行 |
| **🛡️ 管理员** | 系统管理 | 三员分立、安全审计、用户管理、模型路由 |

---

## 三、核心功能需求

### P0 — 已实现

#### F1：前端脚手架 + 路由
- React 18 + Ant Design Pro + Vite 构建
- 22 条路由 + AuthGuard 路由守卫
- 中英双语国际化 + 亮暗双主题
- 4 角色（厅领导/处长/市州/管理员）17 个开发账号

#### F2：Dashboard 原型
- KPI 卡片 + ECharts 数据图表
- 安全态势表格 + 审批任务表格
- 角色切换器（开发调试用）

#### F3：Cesium 湖南 3D 场景
- 3D 地形渲染 + 天地图底图
- 8 个环境监测站标记
- 5 个可视化图层（空气/水质/噪声/碳排放/生态）
- 行政边界叠加

#### F4：FastAPI 后端骨架
- 6 个路由模块（agents/workflows/security/models/departments/environment）
- WebSocket 管理器
- LiteLLM 17 模型路由（opus/sonnet/haiku 三级）

#### F5：GOVMCP 国密协议（⭐️ 最完善模块）
- SM2 密钥交换 + SM3 哈希签名 + SM4 加密载荷
- 20 个 MCP 工具（数据脱敏/审批流转/审计哈希链/安全通道/工作日计算）
- 8 状态审批流引擎
- 跨平台联邦安全通道

#### F6：EcoAgentEngine 自建引擎
- Agent 对话循环 + 流式 SSE
- EcoToolRegistry 工具注册（OpenAI/MCP Schema 导出）
- EcoVerifier 输出验证（空响应/不确定性/敏感词）
- EcoMemory SQLite 三层记忆（会话/长期/工作）

#### F7：ECC 技能系统
- 9 个 Agent 定义 + 4 个工作空间
- 湖南省厅 19 部门 P0-P3 四级映射
- Instincts 引擎骨架

---

### P1 — 占位/进行中

#### F8：执法办案模块
- 环境违法案件全生命周期管理
- 线索发现 → 立案 → 调查 → 处罚决定的流转
- 当前：前端页面框架，后端 API 骨架

#### F9：环评审批中心
- 环境影响评价报告审查
- 排污许可审批三级流转
- 当前：前端页面框架

#### F10：合规检查
- 环保法规标准查询
- 合规自动化检查 + 报告生成
- 当前：前端页面框架

#### F11：报告生成
- 环境监测报告、执法报告、审批报告
- 当前：前端页面框架

#### F12：WebSocket 实时推送
- 后端 manager 已就绪
- 前端 Socket.IO 客户端未对接
- 环境数据实时推送 + Agent 状态更新

---

### P2 — 规划中（TECH_PLAN v6.5）

#### F13：NATS 消息总线
- Agent 间 P2P 通信
- 跨市州数据同步

#### F14：Ollama 本地推理
- 72B→14B→7B→3B 联邦蒸馏
- 400 台工作站分布式推理

#### F15：知识图谱
- GraphRAG 增强检索
- 环保法规/案例/监测数据关联

#### F16：技能市场
- Agent 技能订阅与分发
- 省厅统一管理 + 市州区县按需安装

#### F17：安全技能层
- 6 层 SafetyChain
- 754 条安全规则引擎

---

## 四、非功能需求

### 安全（国密级）

| 要求 | 说明 |
|:---|:---|
| 传输加密 | SM4 加密载荷 + SM2 密钥交换 |
| 数据签名 | SM3 哈希签名 + 审计哈希链 |
| 数据脱敏 | 身份证/手机号/银行卡/姓名/地址 MCP 工具 |
| 认证 | RBAC 四角色 + 三员分立 |
| 审计 | 全操作审计日志 + 不可篡改哈希链 |

### 性能

| 指标 | 要求 |
|:---|:---|
| Cesium 3D 首帧 | < 3s |
| Dashboard 加载 | < 1.5s |
| Agent SSE 流式 | < 200ms 首 token |
| WebSocket 并发 | ≥ 500 连接 |
| SQLite 读写 | < 10ms |

### 可扩展性

| 要求 | 说明 |
|:---|:---|
| Agent 扩展 | 新增 Agent 只需添加映射文件 + 工作空间 |
| 模型扩展 | LiteLLM 路由，新增模型只需加配置 |
| 市州扩展 | 14 市州模板化，新增只需配置 |
| MCP 工具 | GOVMCP 插件机制，新增工具注册即可 |

---

## 五、术语表

| 术语 | 定义 |
|:---|:---|
| EcoMind OS | 项目代号，「会思考的生态大脑」 |
| GOVMCP | 政务联邦协议层，国密级安全 MCP 通道 |
| SM2/SM3/SM4 | 国密算法：非对称加密/哈希签名/对称加密 |
| MCP | Model Context Protocol，Agent 工具调用协议 |
| ECC | EcoMind Capability Core，技能核心系统 |
| EcoAgentEngine | 自建 Agent 对话循环引擎 |
| EcoVerifier | 自建 LLM 输出验证器 |
| EcoMemory | 自建 SQLite 三层记忆系统 |
| Gaia | TECH_PLAN v6.5 规划的路由系统代号 |
| LiteLLM | 多模型统一路由代理（17 家国产模型） |
| opus/sonnet/haiku | 模型三级路由：高复杂度/常规/轻量快速 |

---

## 六、附录：API 端点清单

| 端点 | 方法 | 用途 |
|:---|:---|:---|
| `/api/agents` | GET/POST | Agent 列表 + 创建 |
| `/api/agents/{id}` | GET/PUT/DELETE | Agent 详情 + 修改 |
| `/api/agents/{id}/messages` | POST | 向 Agent 发送消息 |
| `/api/workflows` | GET/POST | 工作流列表 + 创建 |
| `/api/workflows/{id}` | GET/PUT/DELETE | 工作流详情 |
| `/api/workflows/{id}/execute` | POST | 执行工作流 |
| `/api/security/events` | GET | 安全事件列表 |
| `/api/security/approvals` | GET/PUT | 审批队列 + 处理 |
| `/api/security/audit` | GET | 审计日志 |
| `/api/models` | GET | 模型列表 |
| `/api/models/route` | POST | 模型路由配置 |
| `/api/models/health` | GET | 模型健康检查 |
| `/api/departments` | GET | 部门列表 |
| `/api/environment/monitoring` | GET | 环境监测数据 |

---

⚠️ 此文件为人工维护。AI 不得擅自修改。