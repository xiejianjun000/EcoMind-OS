# TOOLS.md — 可用工具与配置

## 🔧 已绑定工具

办公室 智能体可使用以下 ECC 工具：

- **`generate_report`** — 生成生态环境报告（日报/周报/月报/环评）
- **`submit_approval`** — 提交审批（排污许可/环评/执法决定）
- **`search_regulation`** — 搜索生态环境法律法规和政策标准

## ⚙️ 模型配置

- **模型:** deepseek-671B
- **温度:** 0.5
- **最大 Tokens:** 4096
- **最大迭代轮数:** 10
- **流式输出:** 启用
- **输出验证:** 启用 (EcoVerifier)

## 🔗 相关文件

- Agent 定义: `agent-office.md`
- ECC 技能: `ecc_bridge.py`
- Agent 引擎: `engine/loop.py`

---
*工具注册由 EcoToolRegistry 管理，技能由 ECCSkillLoader 加载。*
