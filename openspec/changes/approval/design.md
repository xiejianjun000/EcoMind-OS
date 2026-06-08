# 环评审批模块 — 设计文档

## 1. 三种审批类型
- 环评报告：环境影响评价报告书审查
- 排污许可：排污许可证申请审批
- 竣工验收：环保设施竣工验收

## 2. 三级审批状态机
```
L1-科员(pending) → approve → L2-处长(pending) → approve → L3-厅领导(pending) → approve → approved
    ↓ reject               ↓ reject                   ↓ reject
  rejected               rejected                   rejected
    ↓ return               ↓ return                   ↓ return
  returned               returned                   returned
```

## 3. 后端 API
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/approval/items | 列表（按类型/状态/级别/部门筛选） |
| POST | /api/approval/items | 创建审批（初始 L1/pending） |
| GET | /api/approval/items/{id} | 审批详情 |
| POST | /api/approval/items/{id}/transition | 流转（approve/reject/return） |

## 4. 与 enforcement 的区别
- enforcement: 8 阶段白名单字典，固定流转路径
- approval: 3 级别升序列表，approve 逐级升级，reject/return 可跳级

## 5. 文件清单
新增：schemas/approval.py, services/approval_service.py, routers/approval.py
修改：main.py(+import + include_router), types.ts, api.ts

---

> ⚠️ 此文件由 AI 生成，人工审核后生效。