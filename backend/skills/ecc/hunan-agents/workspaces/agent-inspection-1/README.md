# 🔍 督察一智能体

**部门:** 省生态环境保护督察办公室
**Agent Key:** `inspection-1-agent`
**源文件:** `agent-inspection-1.md`

## 📁 工作区文件结构

```
agent-inspection-1/
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
cp -r /Users/mac/EcoMind-OS/backend/skills/ecc/hunan-agents/workspaces/agent-inspection-1 ~/.ecomind/workspace/agents/agent-inspection-1/
# 或
ecomind workspace add agent-inspection-1 --path /Users/mac/EcoMind-OS/backend/skills/ecc/hunan-agents/workspaces/agent-inspection-1
```

## 🎯 ECC 集成

- ECC Skill Key: `inspection-1-agent`
- Skill Category: `inspection`
- 由 ECCSkillLoader 自动注册
