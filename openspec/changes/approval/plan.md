# 环评审批模块 — 执行计划

1. 创建 schemas/approval.py（ApprovalType/Level/Status 枚举 + Pydantic）
2. 创建 services/approval_service.py（三级审批状态机 + CRUD）
3. 创建 routers/approval.py（4 端点 + Depends 注入）
4. 在 main.py 注册 approval 路由
5. 前端 types.ts 追加类型定义
6. 前端 api.ts 追加 approvalApi 封装

---

> ⚠️ 此文件由 AI 生成，人工审核后生效。