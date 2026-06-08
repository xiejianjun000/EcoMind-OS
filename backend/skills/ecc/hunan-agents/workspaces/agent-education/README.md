# 📣 宣传合作智能体

**部门:** 宣传教育与对外合作处
**Agent Key:** `education-agent`
**源文件:** `agent-education.md`

## 📁 工作区文件结构

```
agent-education/
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
cp -r /Users/mac/EcoMind-OS/backend/skills/ecc/hunan-agents/workspaces/agent-education ~/.ecomind/workspace/agents/agent-education/
# 或
ecomind workspace add agent-education --path /Users/mac/EcoMind-OS/backend/skills/ecc/hunan-agents/workspaces/agent-education
```

## 🎯 ECC 集成

- ECC Skill Key: `education-agent`
- Skill Category: `public`
- 由 ECCSkillLoader 自动注册
