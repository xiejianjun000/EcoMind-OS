# TOOLS.md — 可用工具与配置

## 🔧 已绑定工具

省生态环境保护督察办公室 智能体可使用以下 ECC 工具：

- **`query_environment_data`** — 查询生态环境数据（空气质量/水质/噪声/土壤）
- **`query_emission_data`** — 查询碳排放数据（企业排放量/配额/减排进度）
- **`search_regulation`** — 搜索生态环境法律法规和政策标准
- **`generate_report`** — 生成生态环境报告（日报/周报/月报/环评）

## ⚙️ 模型配置

- **模型:** deepseek-671B
- **温度:** 0.3
- **最大 Tokens:** 4096
- **最大迭代轮数:** 10
- **流式输出:** 启用
- **输出验证:** 启用 (EcoVerifier)

## 🔗 相关文件

- Agent 定义: `agent-inspection-1.md`
- ECC 技能: `ecc_bridge.py`
- Agent 引擎: `engine/loop.py`

---
*工具注册由 EcoToolRegistry 管理，技能由 ECCSkillLoader 加载。*
