# 变更提案：执法办案模块

### 是什么

湖南省生态环境厅环境违法案件全生命周期管理功能。覆盖从线索发现到案件归档的完整 8 阶段办案流程，集成 GOVMCP 审批流引擎、国密数据脱敏、AI 辅助裁量建议，替换当前前端占位框架中的 mock 数据实现。

### 为什么

1. **当前状态**：前端 Enforcement 页面所有数据均为硬编码 MOCK_CASES，后端无 `/api/enforcement/` 路由，案件管理完全不可用。
2. **业务需求**：生态环境执法局是 P0 优先级部门，执法办案是其核心业务场景。
3. **系统完整性**：GOVMCP 模块已具备审批工作流、审计日志、数据脱敏等能力，但无上游业务模块将其串联为可用的案件管理系统。

### 范围

| 层次 | 交付物 | 说明 |
|------|--------|------|
| 前端 | `EnforcementList` 组件 | 案件列表页，含多维筛选、关键词搜索、分页 |
| 前端 | `EnforcementDetail` 组件 | 案件详情页，含基本信息、办理时间线、AI 辅助分析 |
| 前端 | `EnforcementCreate` 组件 | 新建案件表单，含企业信息录入、证据材料上传 |
| 后端 | `backend/api/routers/enforcement.py` | FastAPI Router，CRUD + 状态流转端点 |
| 后端 | `backend/api/services/enforcement_service.py` | 案件业务逻辑层，含状态机校验、脱敏调用、审批流桥接 |
| 后端 | `backend/api/schemas/enforcement.py` | Pydantic 模型定义 |
| 集成 | GOVMCP 8 状态审批流桥接 | 案件状态流转走 GOVMCP ApprovalWorkflow |
| 集成 | 数据脱敏 | 身份证号、手机号、信用代码通过 GOVMCP 脱敏 |

### 影响

- **前端**：Enforcement 页面从单文件 mock 拆分为子页面组件，api.ts/types.ts 新增约 80 行代码
- **后端**：新增 1 个 router、1 个 service、1 个 schemas 模块，main.py 新增 1 行 include_router
- **GOVMCP**：零改动，复用现有工具

### 风险

| 风险 | 等级 | 缓解措施 |
|------|------|----------|
| 案件数据含敏感信息 | 高 | SM4 加密存储 + mask_* 脱敏返回 |
| 状态流转非法跳跃 | 中 | 状态机白名单校验 |
| GOVMCP 内存存储重启丢失 | 中 | 短期依赖审计日志重建 |

---

> ⚠️ 此文件由 AI 生成，人工审核后生效。