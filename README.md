<p align="center">
  <img src="docs/assets/screenshot-chat.png" alt="EcoMind OS" width="100%">
</p>

# 🌿 EcoMind OS

<p align="center">
  <strong>生态环境垂直领域 AI Agent 操作系统。</strong><br>
  调度 11 个领域专家协同工作——从实时监测到执法办案，从法规检索到碳核算报告。<br>
  部署在您自己的服务器上，数据不出内网，每一个决策都有法可依、有据可查。
</p>

<p align="center">
  <a href="https://github.com/xiejianjun000/EcoMind-OS/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-Apache--2.0-blue?style=flat-square" alt="License"></a>
  <a href="./backend"><img src="https://img.shields.io/badge/Backend-FastAPI-009688?style=flat-square" alt="FastAPI"></a>
  <a href="./frontend"><img src="https://img.shields.io/badge/Frontend-React_18-61DAFB?style=flat-square" alt="React"></a>
  <a href="README.zh-CN.md"><img src="https://img.shields.io/badge/中文-README-red?style=flat-square" alt="中文"></a>
</p>

---

## 30 秒跑起来

```bash
git clone git@github.com:xiejianjun000/EcoMind-OS.git && cd EcoMind-OS
cd backend && pip install -r requirements.txt                  # 后端依赖
export DEEPSEEK_API_KEY="sk-your-key"
python -m uvicorn api.main:app --reload --port 8000            # http://localhost:8000/docs

# 新终端
cd ../frontend && pnpm install && pnpm dev                     # http://localhost:5173
```

打开浏览器，开始对话。不需要数据库，不需要 Docker，不需要注册任何服务。

<table>
<tr><td width="30%"><b>🧠 11 个领域专家</b></td><td>助手统一调度，10 个领域专家各司其职——环境监测、执法监察、环评审批、排污许可、碳排放、应急管理、生物多样性、生态修复、生态督察、公众服务。每个专家有独立的 SOUL 人格和工具权限矩阵，对话中一键切换。</td></tr>
<tr><td><b>🛡️ 六层安全链</b></td><td>L0 全局异常脱敏 → L1 Prompt 注入检测 → L2 策略护栏 → L3 输出验证 → L4 幻觉检测 → L5 审计追踪 → L6 国密审批。15 种注入攻击全拦截，SM2/SM3/SM4 国密算法内置。</td></tr>
<tr><td><b>📡 四平台消息网关</b></td><td>飞书、微信、企业微信、钉钉——扫码即连。执法人员在现场用手机发消息，EcoMind 在服务器上调度专家、检索法规、生成文书，结果实时推回手机。一个网关进程，四个平台同时在线。</td></tr>
<tr><td><b>🔍 法规语义搜索</b></td><td>不靠关键词匹配。"废气排放"搜到"大气污染物排放标准"，"黑烟"关联到"林格曼黑度"。SQLite + numpy 向量检索引擎，零外部数据库依赖。法规数据不出内网。</td></tr>
<tr><td><b>🧬 越用越聪明</b></td><td>记忆蒸馏、遗忘曲线、夜间反思——EcoMind 会记住你的偏好、纠正过的错误、常用的法规。每办一个案件就长一分经验。三层知识图谱自动构建法规引用网络。</td></tr>
<tr><td><b>📊 实时环境数据</b></td><td>对接湖南省生态环境厅监测网络，14 市州 AQI/PM2.5/PM10/O₃/SO₂/NO₂/CO 七项指标实时更新。城市排名、预报趋势、历史对比，Cesium 3D 地形叠加监测站数据。</td></tr>
</table>

---

## 常用命令

```bash
# 启动对话
python -m uvicorn api.main:app --port 8000    # 后端
pnpm dev                                       # 前端 → http://localhost:5173

# 向量化法规（首次使用）
curl -X POST http://localhost:8000/api/rag/ingest -d '{"source":"hunan_policy"}'

# 启动消息网关
curl -X POST http://localhost:8000/api/gateway/start -d '{"platforms":["feishu"]}'

# 扫码连接飞书
curl -X POST http://localhost:8000/api/gateway/qr/register -d '{"platform":"feishu"}'

# 运行测试
bash scripts/smoke.sh                          # 6条/10秒烟雾测试
cd backend && python -m pytest tests/unit/     # 57条单元测试

# 夜间反思（每日凌晨 CI 自动执行，也可手动触发）
PYTHONPATH=backend python -c "from engine.learning_loop import LearningLoop; LearningLoop().nightly_discovery()"
```

| 操作 | 网页端 | 消息平台 |
|------|--------|---------|
| 开始对话 | 打开 `http://localhost:5173` | 给 Bot 发消息 |
| 切换专家 | 右侧面板选择 | 发送 `/expert 执法监察` |
| 搜索法规 | 右侧面板→法规 Tab | 直接问"废气排放标准" |
| 查看任务 | 对话区下方 TaskList | 发送 `/tasks` |
| 新建会话 | 左侧栏 "+ 新建会话" | 发送 `/new` |

---

## 文档

所有核心文档在仓库内，不需要外站。

| 你想做什么 | 文档 |
|-----------|------|
| 了解设计理念和核心人格 | [SOUL-EcoMind.md](./spec/SOUL-EcoMind.md) |
| 查看架构决策和模块划分 | [design.md](./spec/design.md) |
| 理解 Agent 引擎实现 | [loop.py](./backend/engine/loop.py) |
| 查看 11 专家配置 | [ecc/hunan-agents/](./backend/skills/ecc/hunan-agents/) |
| 了解记忆进化系统 | [memory_evolution.py](./backend/engine/memory_evolution.py) |
| 了解闭环学习引擎 | [learning_loop.py](./backend/engine/learning_loop.py) |
| 配置消息网关 | [gateway_config.json](./backend/gateway/gateway_config.json) |
| 部署到生产环境 | [deploy/](./deploy/) |
| 查看安全加固规则 | [safety_chain.py](./backend/api/routers/safety_chain.py) |
| 贡献代码 | [CONTRIBUTING.md](./CONTRIBUTING.md) |

---

## 项目结构

```
EcoMind-OS/
├── backend/                         # FastAPI 后端
│   ├── api/                         # 路由 + 服务层
│   ├── engine/                      # EcoAgentEngine 自建引擎 (17 模块)
│   ├── gateway/platforms/           # 消息网关 (飞书/微信/企微/钉钉)
│   ├── rag/                         # RAG 向量检索引擎
│   ├── graph/                       # 三层知识图谱
│   ├── marketplace/                 # 技能插件市场
│   └── tests/                       # 单元/集成/契约/安全/混沌测试
├── frontend/                        # React 18 三面板布局
├── spec/                            # 项目规格 (灵魂铁律/架构/审计)
├── deploy/                          # Docker + Nginx + systemd
├── scripts/                         # 烟雾测试 / 文档自动同步 / Git运维
└── .github/workflows/               # CI/CD (烟雾→单元→集成→夜间反思)
```

---

## 社区

- 🐛 [提交 Issue](https://github.com/xiejianjun000/EcoMind-OS/issues)
- 📖 [贡献指南](./CONTRIBUTING.md)
- 🌐 关注 `@xiejianjun000` 获取更新

---

## 致谢

EcoMind OS 受以下项目和理念启发：Hermes Agent (Nous Research) 的自我进化架构、Claude Code 的 Skill 插件化体系、Trae Solo 的 UI 设计规范、Understand-Anything 的知识图谱理念、Anthropic 的网络安全技能。

---

## 许可证

Apache License 2.0 — 详见 [LICENSE](./LICENSE)。

<p align="center">
  <em>🌱 数据不到不开口，法规不引不下笔。</em>
</p>
