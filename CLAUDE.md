# CLAUDE.md — EcoMind OS 项目规则

## SpecCoding 开发铁律

本项目严格遵循 SpecCoding 方法论。在任何开发工作开始前：
1. 先读 `spec/requirements.md` 和 `spec/design.md` 了解全局约束
2. 确认当前任务的 `openspec/changes/<name>/` 目录和 `proposal.md`
3. 按七阶段工作流执行：branch → scaffold → brainstorm → plan → execute → archive → merge
4. **禁止**在没有 spec 的情况下直接写代码
5. **禁止**修改 `spec/requirements.md` 和 `spec/design.md`（除非人工明确要求）

## 项目结构

```
spec/               ← 项目级规格（全局、长期）
openspec/changes/   ← 需求级规格（单次变更、短期）
src/                ← 前端源码
deploy/             ← 部署配置
```

## 技术栈

- 前端：React 18 + TypeScript + Vite + shadcn/ui + Tailwind
- 状态管理：Zustand
- AI：DeepSeek API（OpenAI 兼容）
- 地图：OpenStreetMap（嵌入）/ Cesium（全屏3D）
- 数据库适配：达梦 DM8 / 人大金仓 KingbaseES / openGauss
