# 🔎 督察二智能体

**部门:** 生态环境保护督察二处
**Agent Key:** `inspection-2-agent`
**源文件:** `agent-inspection-2.md`

## 📁 工作区文件结构

```
agent-inspection-2/
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
cp -r /Users/mac/EcoMind-OS/backend/skills/ecc/hunan-agents/workspaces/agent-inspection-2 ~/.ecomind/workspace/agents/agent-inspection-2/
# 或
ecomind workspace add agent-inspection-2 --path /Users/mac/EcoMind-OS/backend/skills/ecc/hunan-agents/workspaces/agent-inspection-2
```

## 🎯 ECC 集成

- ECC Skill Key: `inspection-2-agent`
- Skill Category: `inspection`
- 由 ECCSkillLoader 自动注册
