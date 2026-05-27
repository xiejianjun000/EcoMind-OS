# 执法办案模块 — 实现任务清单

> 对应 plan.md 的 10 个步骤

- [ ] 1.1 创建 `backend/api/schemas/enforcement.py`（CaseStage/CaseSource/CaseSeverity 枚举 + Pydantic 模型）
- [ ] 1.2 定义 TimelineEntry / AttachmentInfo 模型
- [ ] 2.1 创建 `backend/api/services/enforcement_service.py`（状态机白名单 VALID_TRANSITIONS）
- [ ] 2.2 实现 create_case（含 SM4 加密 + 审计日志）
- [ ] 2.3 实现 transition（校验→GOVMCP审批→更新stage→追加timeline）
- [ ] 2.4 实现 get_case（含脱敏处理 mask_*）
- [ ] 2.5 实现 list_cases / update_case / delete_case
- [ ] 3.1 创建 `backend/api/routers/enforcement.py`（6 个端点）
- [ ] 3.2 在 `backend/api/main.py` 注册 enforcement 路由
- [ ] 4.1 在 `frontend/src/services/types.ts` 新增案件 TypeScript 类型定义
- [ ] 5.1 在 `frontend/src/services/api.ts` 新增 enforcementApi 封装
- [ ] 6.1 创建 `EnforcementList.tsx`（筛选栏 + AntTable + 分页）
- [ ] 7.1 创建 `EnforcementDetail.tsx`（Descriptions + TimelineView + 文书列表）
- [ ] 8.1 创建 `EnforcementCreate.tsx`（步骤条表单 + 信用代码校验）
- [ ] 9.1 创建 `EnforcementTransition.tsx`（状态流转弹窗）
- [ ] 9.2 重构 `Enforcement/index.tsx` 为容器组件（Tab/路由切换）
- [ ] 10.1 状态机白名单单元测试
- [ ] 10.2 数据脱敏集成测试
- [ ] 10.3 审批流端到端测试

---

> ⚠️ 此文件由 AI 生成，人工审核后生效。