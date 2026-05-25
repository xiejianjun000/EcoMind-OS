# EcoMind OS Phase 1B 交付报告

**日期**: 2026-05-25
**版本**: Phase 1B — 3D 地形 + FastAPI 后端 + 模型路由
**状态**: ✅ 全部完成

---

## TL;DR

Phase 1B Cesium 湖南省 3D 地形场景完整实现（8 个监测站 + 天地图底图 + 行政边界 + 图层控制 + 坐标面板 + 比例尺 + 站点弹窗），FastAPI 后端 25 个路由 + WebSocket 实时推送已启动验证，LiteLLM 17 个国产模型路由配置完成，pnpm TypeScript strict 模式修复通过。

---

## 交付概览

| 维度 | 状态 | 说明 |
|------|------|------|
| Cesium 3D 场景 | ✅ 完成 | 湖南省 8 站点 + 天地图 + 边界 + 5 图层切换 |
| FastAPI 后端 | ✅ 运行中 | 25 路由，`localhost:8000/health` 返回 ok |
| 模型路由 | ✅ 配置完成 | 17 模型（10 家国产）+ opus/sonnet/haiku 三级路由 |
| pnpm 类型修复 | ✅ 修复 | shamefully-hoist + strict: true + tsc 通过 |
| 前端构建 | ✅ 通过 | pnpm build 24s，含 Cesium 静态资源 |
| 前后端联调 | ✅ 基础联通 | 前端 /api → localhost:8000 代理已配 |

---

## 文件清单

### Cesium 3D 场景（`frontend/src/pages/Cesium/`）

| 路径 | 说明 |
|------|------|
| `index.tsx` | CesiumPage 主页 — 全屏渲染 HunanTerrainScene |
| `types.ts` | 类型定义（StationStatus/StationType/MonitoringStationData/LayerVisibility/SceneViewParams/CoordinateInfo） |
| `constants.ts` | 常量（Token/边界URL/场景参数/8个监测站/颜色映射） |
| `components/HunanTerrainScene.tsx` | 核心场景 — Cesium Viewer + 天地图底图+注记 + World Terrain + 湖南边界GeoJSON + 鼠标追踪 + 站点点击弹窗 |
| `components/MonitoringStation.tsx` | 监测站标注 — Billboard+Label Entity，按状态着色，Canvas 动态图标 |
| `components/LayerPanel.tsx` | 图层面板（左上）— 5 个图层开关 |
| `components/CoordinateInfo.tsx` | 坐标面板（右上）— 经度/纬度/视角高度实时显示 |
| `components/StationPopup.tsx` | 站点弹窗 — 点击站点显示详情 |
| `components/ScaleBar.tsx` | 比例尺（底部）— FOV+高度估算地面距离 |

### FastAPI 后端（`backend/api/`）

| 路径 | 说明 |
|------|------|
| `main.py` | FastAPI 入口 — CORS + lifespan + 路由注册 + 健康检查 |
| `routers/agents.py` | /api/agents — CRUD + 状态管理 + 消息发送 |
| `routers/workflows.py` | /api/workflows — CRUD + 执行/取消 |
| `routers/security.py` | /api/security — 安全事件 + GOVMCP 审批 + 审计日志 |
| `routers/models.py` | /api/models — 模型列表 + 健康检查 + 路由 + 配置 |
| `schemas/agent.py` | Agent Pydantic 模型 |
| `schemas/workflow.py` | Workflow Pydantic 模型 |
| `schemas/security.py` | Security Pydantic 模型 |
| `schemas/model.py` | Model Pydantic 模型 |
| `services/agent_service.py` | Agent 业务逻辑（集成 taiji_agent） |
| `services/workflow_service.py` | Workflow 业务逻辑 |
| `services/security_service.py` | Security 业务逻辑（集成 govmcp） |
| `services/model_service.py` | Model 业务逻辑 |
| `websocket/manager.py` | WebSocket 连接管理器 + 后台广播 |

### 推理配置（`backend/inference/`）

| 路径 | 说明 |
|------|------|
| `config.yaml` | LiteLLM 统一配置 — 17 模型 + usage-based routing |
| `adapter.py` | EcomodelAdapter — 非OpenAI-compatible模型适配 |
| `router.py` | 模型路由选择逻辑（tier → 最优模型） |
| `health.py` | 模型健康检查 |
| `model_mapping.py` | 三级路由映射（opus/sonnet/haiku → 17 模型） |
| `start_vllm.sh` | vLLM 启动脚本模板 |
| `start_sglang.sh` | SGLang 启动脚本模板 |

---

## Cesium 3D 场景功能详情

### 监测站数据（8 站点）
| ID | 名称 | 类型 | 状态 | 坐标 |
|----|------|------|------|------|
| station-cs-001 | 长沙市空气监测站 | 空气 | 正常 | 112.94°E, 28.23°N |
| station-cs-002 | 湘江水质监测站 | 水质 | 预警 | 112.97°E, 28.19°N |
| station-zz-001 | 株洲市噪声监测站 | 噪声 | 正常 | 113.13°E, 27.83°N |
| station-xt-001 | 湘潭市空气监测站 | 空气 | 报警 | 112.94°E, 27.83°N |
| station-hy-001 | 衡阳湘江水质站 | 水质 | 正常 | 112.57°E, 26.89°N |
| station-yb-001 | 岳阳洞庭湖水质站 | 水质 | 正常 | 113.13°E, 29.36°N |
| station-cd-001 | 常德市空气监测站 | 空气 | 预警 | 111.70°E, 29.03°N |
| station-ld-001 | 娄底市噪声监测站 | 噪声 | 报警 | 111.99°E, 27.70°N |

### 图层控制（5 层）
1. 天地图底图（vec_w 矢量底图）
2. 天地图注记（cia_w 中文地名）
3. 3D 地形（Cesium World Terrain）
4. 湖南省行政边界（GeoJSON 橙色描边）
5. 监测站点标注

### 技术决策
- 未使用 resium，直接用 Cesium 原生 API + useRef/useEffect
- vite-plugin-cesium 处理静态资源复制和 CESIUM_BASE_URL 注入
- cesium-vendor 从 manualChunks 移除（与插件 external 冲突）
- 天地图使用 UrlTemplateImageryProvider（vec_w + cia_w）
- 湖南边界从阿里 DataV 公开 GeoJSON 加载

---

## FastAPI 后端路由详情

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /health | 系统健康检查 |
| GET | /api/agents/ | 列出所有 Agent |
| POST | /api/agents/ | 创建 Agent |
| GET | /api/agents/{id} | 获取 Agent 详情 |
| PUT | /api/agents/{id}/status | 更新 Agent 状态 |
| POST | /api/agents/{id}/message | 发送消息给 Agent |
| GET | /api/workflows/ | 列出所有工作流 |
| POST | /api/workflows/ | 创建工作流 |
| GET | /api/workflows/{id} | 获取工作流详情 |
| POST | /api/workflows/{id}/execute | 执行工作流 |
| POST | /api/workflows/{id}/cancel | 取消工作流 |
| GET | /api/security/events | 获取安全事件 |
| GET | /api/security/approvals | 获取审批队列 |
| POST | /api/security/approvals/{id}/approve | 审批通过 |
| POST | /api/security/approvals/{id}/reject | 审批驳回 |
| GET | /api/security/audit-trail | 获取审计日志 |
| GET | /api/models/ | 列出可用模型 |
| GET | /api/models/status | 模型健康检查 |
| POST | /api/models/route | 模型路由选择 |
| GET | /api/models/config | 获取模型配置 |
| WS | /ws | 实时 WebSocket 推送 |

---

## 模型路由映射

| 层级 | 首选模型 | 备选模型 | 说明 |
|------|----------|----------|------|
| opus | DeepSeek-671B (本地 vLLM) | Qwen3-72B (本地 SGLang) / Qwen-Max / GLM-4 / DeepSeek-Chat / Yi-Large | 高复杂度任务 |
| sonnet | Qwen-Plus | DeepSeek-Coder / GLM-4-Flash / Yi-Medium / Baichuan2-Turbo / InternLM2-20B / Aquila2-34B | 常规任务 |
| haiku | Qwen-Turbo | MiniCPM-4B / GLM-4-Flash / ChatGLM-Turbo / Skywork-13B | 轻量快速 |

---

## 已知问题 & 下一步

| # | 问题 | 优先级 | 阶段 |
|---|------|--------|------|
| 1 | 天地图/Cesium ion Token 为占位符，需替换为真实 Token | P0 | 部署前 |
| 2 | AntD + Chart chunks > 500KB（需动态 import 优化） | P1 | Phase 2 |
| 3 | FastAPI 服务使用内存存储（需接入数据库） | P1 | Phase 2 |
| 4 | 前后端 WebSocket 实时数据推送未联调 | P1 | Phase 1C |
| 5 | Deck.gl 大数据可视化层未接入 | P1 | Phase 2 |
| 6 | 湖南省 SRTM 30m DEM 本地地形未部署（当前用 World Terrain） | P2 | Phase 2 |

---

## 启动命令

```bash
# 前端开发服务器
cd frontend && pnpm dev

# 前端构建
cd frontend && pnpm build

# 后端 API 服务
cd backend && python -m uvicorn api.main:app --host 0.0.0.0 --port 8000 --reload

# 后端健康检查
curl http://localhost:8000/health

# 查看可用模型
curl http://localhost:8000/api/models/

# 创建 Agent
curl -X POST http://localhost:8000/api/agents/ -H "Content-Type: application/json" -d '{"name":"执法监察Agent","provider":"qwen","model":"qwen-max","level":"L5"}'
```

---

## 环境变量

```bash
# 前端 (.env.local)
VITE_CESIUM_TOKEN=your_cesium_ion_token
VITE_TIANDITU_TOKEN=your_tianditu_api_token

# 后端 (.env)
DASHSCOPE_API_KEY=sk-xxx
GLM_API_KEY=sk-xxx
DEEPSEEK_API_KEY=sk-xxx
YI_API_KEY=sk-xxx
BAICHUAN_API_KEY=sk-xxx
LITELLM_MASTER_KEY=sk-ecomind-litellm-local
```
