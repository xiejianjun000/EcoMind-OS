# 合规检查模块 — 设计文档

## API
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/compliance/checks | 列表（按category/status筛选） |
| POST | /api/compliance/checks | 创建检查 |
| GET | /api/compliance/checks/{id} | 详情 |
| POST | /api/compliance/checks/{id}/run | 执行检查（pass/fail） |

## 数据模型
- title: 检查标题
- category: 废水/废气/固废/噪声
- regulation: 适用法规
- target: 检查对象
- result: pass/fail
- issues: 不合规项列表

---

> ⚠️ 此文件由 AI 生成，人工审核后生效。