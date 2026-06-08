# 执法办案模块 — 设计文档

## 1. 前端组件树

```
Enforcement/                          # 路由: /enforcement
├── index.tsx                         # 容器组件，管理 Tab/路由切换
├── EnforcementList.tsx               # 案件列表 + 筛选栏 + 分页
│   ├── FilterBar                     # 阶段/区域/严重程度/日期/关键词
│   └── AntTable<EnforcementCase>     # 可排序表格，点击行跳转详情
├── EnforcementDetail.tsx             # 案件详情页
│   ├── Descriptions (基本信息)
│   ├── TimelineView (办理时间线)
│   ├── AIAnalysisPanel (AI 辅助)
│   └── DocumentList (文书列表)
├── EnforcementCreate.tsx             # 新建案件表单
│   ├── Steps (步骤条)                 # ①基本信息→②违法事实→③证据材料→④提交立案
│   ├── Form (企业信息+案件信息)
│   └── Upload (证据材料)
└── EnforcementTransition.tsx         # 状态流转操作组件
```

### 路由设计

| 路径 | 组件 | 说明 |
|------|------|------|
| `/enforcement` | `EnforcementList` | 案件列表（默认视图） |
| `/enforcement/:caseId` | `EnforcementDetail` | 案件详情 |
| `/enforcement/new` | `EnforcementCreate` | 新建案件 |

## 2. 后端 API

| 方法 | 路径 | 说明 |
|------|------|------|
| `GET` | `/api/enforcement/cases` | 案件列表（筛选/搜索/分页） |
| `POST` | `/api/enforcement/cases` | 创建案件 |
| `GET` | `/api/enforcement/cases/{case_id}` | 案件详情 |
| `PUT` | `/api/enforcement/cases/{case_id}` | 更新案件基本信息 |
| `POST` | `/api/enforcement/cases/{case_id}/transition` | 状态流转（对接 GOVMCP） |
| `GET` | `/api/enforcement/cases/{case_id}/timeline` | 获取流转时间线 |
| `DELETE` | `/api/enforcement/cases/{case_id}` | 删除案件（仅限"线索"阶段） |

## 3. 状态机

```
线索 → 受理 → 立案 → 调查 → 告知 → 决定 → 执行 → 归档
  │              │                       │
  ▼              ▼                       ▼
归档(终态)   不予立案(终态)          不予处罚(终态)
```

## 4. GOVMCP 集成

状态流转时序：
1. 校验状态转换合法性
2. 调用 GOVMCP `approval_create` 创建审批
3. 调用 GOVMCP `approval_submit` 提交审批
4. 调用 GOVMCP `audit_log` 记录审计
5. 更新 case.stage
6. 追加 case.timeline

复用 GOVMCP 工具：`approval_create` / `approval_submit` / `approval_status` / `audit_log` / `mask_id_number` / `mask_phone` / `validate_credit_code` / `calculate_workday`

## 5. 文件变更清单

**新增：**
- `frontend/src/pages/Enforcement/EnforcementList.tsx`
- `frontend/src/pages/Enforcement/EnforcementDetail.tsx`
- `frontend/src/pages/Enforcement/EnforcementCreate.tsx`
- `frontend/src/pages/Enforcement/EnforcementTransition.tsx`
- `backend/api/routers/enforcement.py`
- `backend/api/services/enforcement_service.py`
- `backend/api/schemas/enforcement.py`

**修改：**
- `frontend/src/pages/Enforcement/index.tsx`（容器重构）
- `frontend/src/services/api.ts`（+ enforcementApi）
- `frontend/src/services/types.ts`（+ 案件类型定义）
- `backend/api/main.py`（+ enforcement router 注册）

**不改：**
- `backend/govmcp/`（零改动，纯复用）
- `frontend/src/router/index.tsx`（路由路径不变）

---

> ⚠️ 此文件由 AI 生成，人工审核后生效。