# Proposal: 业务模块同步上线

> 状态：完成 | 日期：2026-05-27

## 是什么

从父项目 EcoMind-OS 移植 4 个核心业务模块到 .github-clone 现代前端，一次性批量上线。

## 模块清单

| 模块 | 路径 | 核心功能 |
|:---|:---|:---|
| Enforcement | /admin/enforcement | 8 阶段案件生命周期 + 详情 Timeline |
| Approval | /admin/approval | 三级审批 + AI 预审 |
| Compliance | /admin/compliance | SafetyChain 六层 + 法规数据库 |
| Reports | /admin/reports | 5 类报告 + AI 模板库 |

## 为什么

1. 父项目这些模块使用 AntD 但路由不一致，.github-clone 作为新前端需独立实现
2. 政务系统核心业务闭环必须完整：监测→执法→审批→合规→报告
3. 与 Chat v6.5 / Monitor / Conversations 形成完整产品矩阵

## 参数

所有模块使用 Mock 数据，后端 API 就绪后可无缝切换。
