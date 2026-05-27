# 💰 科技财务智能体

**部门:** 科技与财务处
**Agent Key:** `tech-finance-agent`
**源文件:** `agent-tech-finance.md`

## 📁 工作区文件结构

```
agent-tech-finance/
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
cp -r /Users/mac/EcoMind-OS/backend/skills/ecc/hunan-agents/workspaces/agent-tech-finance ~/.ecomind/workspace/agents/agent-tech-finance/
# 或
ecomind workspace add agent-tech-finance --path /Users/mac/EcoMind-OS/backend/skills/ecc/hunan-agents/workspaces/agent-tech-finance
```

## 🎯 ECC 集成

- ECC Skill Key: `tech-finance-agent`
- Skill Category: `finance`
- 由 ECCSkillLoader 自动注册
