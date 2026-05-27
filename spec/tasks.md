# EcoMind OS — 里程碑任务清单

> 版本：1.0 | 最后更新：2026-05-27
> 每个 task 对应一个后续 OpenSpec 提案

---

## 状态说明
- `[ ]` 待开始 | `[~]` 进行中 | `[x]` 已完成

---

## 一、基础设施

- [x] task-001-frontend-scaffold — 前端脚手架（React 18 + Vite + AntD Pro + 22 路由）
- [x] task-002-backend-scaffold — 后端骨架（FastAPI + 6 路由模块 + WebSocket + CORS）
- [x] task-003-rbac-auth — RBAC 认证（4 角色 17 账号 + AuthGuard + 角色切换器）
- [x] task-004-i18n-theme — 国际化 + 主题（中英双语 + 亮暗双主题）

## 二、可视化与交互

- [x] task-005-dashboard — Dashboard 原型（KPI 卡片 + ECharts 图表）
- [x] task-006-cesium-3d — Cesium 湖南 3D 场景（8 监测站 + 5 图层 + 行政边界）
- [x] task-007-role-dashboards — 角色驾驶舱（指挥驾驶舱/处长工作台/市州工作台）

## 三、AI 核心引擎

- [x] task-008-agent-engine — EcoAgentEngine 自建引擎（对话循环 + SSE 流式）
- [x] task-009-tool-registry — EcoToolRegistry 工具注册（OpenAI/MCP Schema 导出）
- [x] task-010-verifier — EcoVerifier 输出验证（空响应/不确定性/敏感词）
- [x] task-011-memory — EcoMemory SQLite 三层记忆（会话/长期/工作）

## 四、国密安全体系（⭐️ 核心模块）

- [x] task-012-govmcp-crypto — SM2/SM3/SM4 国密算法实现
- [x] task-013-govmcp-tools — 20 个 MCP 工具（数据脱敏/哈希链/安全通道/工作日）
- [x] task-014-govmcp-workflow — 8 状态审批流引擎
- [x] task-015-model-routing — LiteLLM 17 模型路由（opus/sonnet/haiku 三级）

## 五、业务模块（P1 待实现）

- [x] task-016-enforcement — 执法办案模块（案件生命周期：线索→立案→调查→处罚）
- [x] task-017-approval — 环评审批中心（环评报告审查 + 排污许可三级审批）
- [x] task-018-compliance — 合规检查（法规查询 + 自动化检查 + 报告生成）
- [x] task-019-reports — 报告生成（监测报告/执法报告/审批报告）
- [x] task-020-websocket — WebSocket 实时推送（环境数据 + Agent 状态）

## 六、ECC 技能系统

- [x] task-021-ecc-bridge — ECC 技能加载器 + Instincts 引擎
- [x] task-022-agent-mapping — 湖南省厅 19 部门 P0-P3 四级 Agent 映射
- [x] task-023-workspace-setup — 4 个 Agent 协作工作空间（协调/教育/党务/水务）
- [x] task-024-agent-prompts — Agent Prompt 集合填充

## 七、高级特性（P2 规划）

- [ ] task-025-nats-bus — NATS 消息总线（Agent P2P + 跨市州同步）
- [ ] task-026-ollama-local — Ollama 本地推理（联邦蒸馏 72B→14B→7B→3B）
- [x] task-027-knowledge-graph — 知识图谱（GraphRAG + 法规/案例/监测关联）
- [x] task-028-skill-market — 技能市场（Agent 技能订阅与分发）
- [ ] task-029-safety-chain — 6 层 SafetyChain 安全技能层
- [ ] task-030-taiji-migration — Taiji Agent 2.0 架构迁移（v2.0→v6.5）

## 八、联调与部署

- [x] task-031-frontend-backend — 前后端全面联调（替换 mock 数据为真实 API）
- [x] task-032-testing — 自动化测试覆盖
- [x] task-033-deploy — 生产部署配置（含国密证书部署）

---

## 进度统计

| 状态 | 数量 |
|:---|---:|
| 已完成 | 26 |
| 进行中 | 0 |
| 待开始 | 6 |
| 总计 | 33 |

---

> 内容人工维护。完成状态 PR 合并后 AI 归档自动勾选。