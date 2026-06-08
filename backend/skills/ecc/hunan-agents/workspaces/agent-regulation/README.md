# 📜 法规标准智能体

**部门:** 法规与标准处
**Agent Key:** `regulation-agent`
**源文件:** `agent-regulation.md`

## 📁 工作区文件结构

```
agent-regulation/
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
cp -r /Users/mac/EcoMind-OS/backend/skills/ecc/hunan-agents/workspaces/agent-regulation ~/.ecomind/workspace/agents/agent-regulation/
# 或
ecomind workspace add agent-regulation --path /Users/mac/EcoMind-OS/backend/skills/ecc/hunan-agents/workspaces/agent-regulation
```

## 🎯 ECC 集成

- ECC Skill Key: `regulation-agent`
- Skill Category: `legal`
- 由 ECCSkillLoader 自动注册
