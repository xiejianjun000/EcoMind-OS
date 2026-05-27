# 📋 环评审批智能体

**部门:** 环境影响评价与排放管理处（行政审批办公室）
**Agent Key:** `eia-approval-agent`
**源文件:** `agent-eia-approval.md`

## 📁 工作区文件结构

```
agent-eia-approval/
├── README.md       ← 本文件
├── SOUL.md         ← 人格定义、沟通风格、核心规则
├── AGENTS.md       ← 核心任务、工作流程、输出格式
├── IDENTITY.md     ← 身份卡片
├── MEMORY.md       ← 工作记忆、直觉规则
├── TOOLS.md        ← 可用工具列表与配置
└── HEARTBEAT.md    ← 心跳配置
```

## 🚀 安装到 EcoMind

```bash
cp -r /Users/mac/EcoMind-OS/backend/skills/ecc/hunan-agents/workspaces/agent-eia-approval ~/.ecomind/workspace/agents/agent-eia-approval/
# 或
ecomind workspace add agent-eia-approval --path /Users/mac/EcoMind-OS/backend/skills/ecc/hunan-agents/workspaces/agent-eia-approval
```

## 🎯 ECC 集成

- ECC Skill Key: `eia-approval-agent`
- Skill Category: `approval`
- 由 ECCSkillLoader 自动注册
