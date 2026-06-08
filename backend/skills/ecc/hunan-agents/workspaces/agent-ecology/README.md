# 🌿 生态保护智能体

**部门:** 自然生态保护处
**Agent Key:** `ecology-agent`
**源文件:** `agent-ecology.md`

## 📁 工作区文件结构

```
agent-ecology/
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
cp -r /Users/mac/EcoMind-OS/backend/skills/ecc/hunan-agents/workspaces/agent-ecology ~/.ecomind/workspace/agents/agent-ecology/
# 或
ecomind workspace add agent-ecology --path /Users/mac/EcoMind-OS/backend/skills/ecc/hunan-agents/workspaces/agent-ecology
```

## 🎯 ECC 集成

- ECC Skill Key: `ecology-agent`
- Skill Category: `ecology`
- 由 ECCSkillLoader 自动注册
