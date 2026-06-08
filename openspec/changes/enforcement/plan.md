# 执法办案模块 — 执行计划

> 基于 proposal.md + design.md 拆解的 10 步执行计划

---

## 步骤 1：后端 Schemas（Pydantic 模型）
- 创建 `backend/api/schemas/enforcement.py`
- 定义 `CaseStage`/`CaseSource`/`CaseSeverity` 枚举
- 定义 `CaseCreateRequest`/`CaseTransitionRequest`/`CaseResponse` 模型
- 定义 `TimelineEntry`/`AttachmentInfo` 模型

## 步骤 2：后端 Service（业务逻辑层）
- 创建 `backend/api/services/enforcement_service.py`
- 实现状态机白名单 `VALID_TRANSITIONS`
- 实现 `create_case` / `get_case` / `list_cases` / `update_case`
- 实现 `transition` 核心方法（校验→审批→审计→更新）
- 实现 `delete_case`（仅限"线索"阶段）
- 集成 GOVMCP 脱敏工具（mask_id_number/mask_phone）

## 步骤 3：后端 Router（API 端点）
- 创建 `backend/api/routers/enforcement.py`
- 实现 6 个 REST 端点（GET list / POST create / GET detail / PUT update / POST transition / DELETE）
- 在 `backend/api/main.py` 注册路由

## 步骤 4：前端 Types（TypeScript 类型）
- 在 `frontend/src/services/types.ts` 新增案件相关类型
- `CaseStage`/`CaseSource`/`CaseSeverity` 枚举
- `EnforcementCase`/`EnforcementCaseCreateRequest`/`EnforcementCaseTransitionRequest` 接口
- `EnforcementCaseListParams`/`EnforcementCaseListResponse` 接口

## 步骤 5：前端 API 层
- 在 `frontend/src/services/api.ts` 新增 `enforcementApi`
- 封装所有 HTTP 调用（list/create/detail/update/transition/delete）

## 步骤 6：EnforcementList 组件
- 创建 `frontend/src/pages/Enforcement/EnforcementList.tsx`
- 筛选栏：阶段 Select + 区域 Select + 严重程度 Select + 关键词搜索 + 日期 RangePicker
- 案件表格：AntTable + 排序 + 分页 + 点击跳转详情

## 步骤 7：EnforcementDetail 组件
- 创建 `frontend/src/pages/Enforcement/EnforcementDetail.tsx`
- 基本信息 Descriptions + 办理时间线 TimelineView + 文书列表

## 步骤 8：EnforcementCreate 组件
- 创建 `frontend/src/pages/Enforcement/EnforcementCreate.tsx`
- 步骤条表单：基本信息 → 违法事实 → 证据材料 → 提交立案
- 信用代码实时校验（调用 GOVMCP validate_credit_code）

## 步骤 9：EnforcementTransition 组件
- 创建 `frontend/src/pages/Enforcement/EnforcementTransition.tsx`
- 状态流转操作弹窗：当前阶段 + 目标阶段 + 审批意见 + 提交

## 步骤 10：集成测试
- 状态机白名单验证（合法/非法转换全部测试）
- 数据脱敏验证（密文存储 + 脱敏读取）
- 审批流端到端验证（create → submit → approve → stage 更新）

---

> ⚠️ 此文件由 AI 生成，人工审核后生效。