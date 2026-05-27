# 🌬️ 大气治理智能体

**部门:** 大气环境与应对气候变化处
**Agent Key:** `air-climate-agent`
**源文件:** `agent-air-climate.md`

## 📁 工作区文件结构

```
agent-air-climate/
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
cp -r /Users/mac/EcoMind-OS/backend/skills/ecc/hunan-agents/workspaces/agent-air-climate ~/.ecomind/workspace/agents/agent-air-climate/
# 或
ecomind workspace add agent-air-climate --path /Users/mac/EcoMind-OS/backend/skills/ecc/hunan-agents/workspaces/agent-air-climate
```

## 🎯 ECC 集成

- ECC Skill Key: `air-climate-agent`
- Skill Category: `environment`
- 由 ECCSkillLoader 自动注册
