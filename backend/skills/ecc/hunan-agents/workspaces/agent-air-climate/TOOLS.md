# TOOLS.md — 可用工具与配置

## 🔧 已绑定工具

大气环境与应对气候变化处 智能体可使用以下 ECC 工具：

- **`env_query`** — 查询城市实时环境监测数据（AQI/水质/气象）
- **`query_emission_data`** — 查询碳排放数据（企业排放量/配额/减排进度）
- **`search_regulation`** — 搜索生态环境法律法规和政策标准
- **`report_generate`** — 生成环境监测报告/执法文书/环评意见书
- **`data_analyze`** — 环境监测数据统计分析（趋势/异常/对比/汇总）
- **`knowledge_query`** — 查询知识库（法规/案例/物种/排放因子）
- **`skill_execute`** — 执行已注册的技能模块（如碳排放核算引擎）

## ⚙️ 模型配置

- **模型:** deepseek-671B
- **温度:** 0.3
- **最大 Tokens:** 4096
- **最大迭代轮数:** 10
- **流式输出:** 启用
- **输出验证:** 启用 (EcoVerifier)

## 🔗 相关文件

- Agent 定义: `agent-air-climate.md`
- ECC 技能: `ecc_bridge.py`
- Agent 引擎: `engine/loop.py`

---
*工具注册由 EcoToolRegistry 管理，技能由 ECCSkillLoader 加载。*
