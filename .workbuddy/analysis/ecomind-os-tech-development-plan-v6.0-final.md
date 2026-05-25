# EcoMind OS 技术开发方案 v6.0 — 最终可开发版

> **版本**: v6.0（基于 v5.0 + 四项关键调整）
> **日期**: 2026-05-25
> **状态**: ✅ **可开发** — 方案锁定，团队可立即启动
> **编制**: 齐活林（Qi）· 交付总监
> **变更**: v5.0 → v6.0 四项关键调整

---

## 目录

1. [v5.0 → v6.0 变更摘要](#1-v50--v60-变更摘要)
2. [Hermes 功能对标详细差距分析](#2-hermes-功能对标详细差距分析)
3. [D20 新增：湖南省 3D 地形图首期加载](#3-d20-新增湖南省-3d-地形图首期加载)
4. [地图四库组合技术架构](#4-地图四库组合技术架构)
5. [前端 9 模块 + 3D 空间可视化优化](#5-前端-9-模块--3d-空间可视化优化)
6. [后端 Hermes 对齐实施路径](#6-后端-hermes-对齐实施路径)
7. [Phase 1 实施计划（14 周）](#7-phase-1-实施计划14-周)
8. [团队分工与并行策略](#8-团队分工与并行策略)
9. [风险评估与缓解](#9-风险评估与缓解)
10. [v6.0 完整决策矩阵（D1-D20）](#10-v60-完整决策矩阵d1-d20)

---

## 1. v5.0 → v6.0 变更摘要

| # | 变更项 | v5.0 方案 | v6.0 方案 | 影响级别 |
|---|--------|----------|----------|---------|
| 1 | 部署模式 | 本地+云端双模式（D15） | **本地部署优先，D15 暂停开发** | 🟡 降级简化 |
| 2 | 地图引擎 | Cesium.js 概念性提及 | **四库组合（Cesium+MapLibre+Deck.gl+Turf.js）+ 湖南省首期地形图** | 🔴 新增完整子系统 |
| 3 | 开发目标 | 生产级前端UI | **对标 Hermes-Agent 同等功能可部署水平** | 🟡 方向聚焦 |
| 4 | 开发状态 | 方案设计阶段 | **团队正式开发** | 🟢 进入执行 |

**v6.0 核心原则**：
- **只做本地部署** — 不做云端切换，D15 暂停，后续按需升级
- **Hermes 是功能基线** — 凡 Hermes 有的核心功能，EcoMind 必须对齐
- **湖南省是首期地图** — 先跑通一个省的 3D 数字孪生，再扩展全国
- **团队正式开发** — 4 人团队并行，14 周交付

---

## 2. Hermes 功能对标详细差距分析

### 2.1 Hermes 可部署功能全景（11 项核心功能）

| # | 功能 | Hermes 实现方式 | 代码量 | 成熟度 |
|---|------|---------------|--------|--------|
| H1 | Agent 对话循环 | `conversation_loop.py` (3900+行) | 极成熟 | ✅ 生产级 |
| H2 | 三层记忆 | MemoryProvider (12钩子) | 成熟 | ✅ 生产级 |
| H3 | LLM 多模型适配 | 7个 Provider Adapter | 成熟 | ✅ 生产级 |
| H4 | 工具执行+MCP | tool_executor + guardrails | 成熟 | ✅ 生产级 |
| H5 | 技能自动创建 | Curator + Background Review | 中等 | 🔶 v0.14 |
| H6 | 多Agent编排 | auxiliary_client | 基础 | 🔶 单Agent派发 |
| H7 | Cron 定时自动化 | 内置 cron 模块 | 成熟 | ✅ 生产级 |
| H8 | Gateway 多平台 | Telegram/Discord/Slack/WhatsApp | 成熟 | ✅ 生产级 |
| H9 | Web UI / Dashboard | TUI only（无Web UI） | 缺失 | ❌ 无 |
| H10 | Docker 一键部署 | Docker + docker-compose | 成熟 | ✅ 生产级 |
| H11 | 轨迹追踪/审计 | trajectory + batch_runner | 成熟 | ✅ 生产级 |

### 2.2 EcoMind 差距分级

| 优先级 | 功能 | 差距描述 | 弥补方式 | 对应 Phase |
|--------|------|---------|---------|-----------|
| **P0** | H1 对话循环 | TAIJI-AGENT 已有 Agent Loop | 直接使用 | 1A |
| **P0** | H2 三层记忆 | Hermes MemoryProvider 需集成 | 提取集成 | 1C |
| **P0** | H3 LLM 多模型 | LiteLLM + EcomodelAdapter | vLLM+LiteLLM | 1A/1D |
| **P0** | H4 工具+MCP | GOVMCP 已有 MCP 桥接 | 直接使用 | 1C |
| **P1** | H5 技能自创建 | 完全未开始 | 参考 Curator | 2 |
| **P1** | H6 多Agent编排 | LangGraph+CrewAI 已设计 | 实现编排 | 1D |
| **P1** | H7 Cron 定时 | 完全未开始 | 新开发 | 1D |
| **P1** | H8 Gateway 路由 | OpenClaw Gateway 可复用 | 集成适配 | 1D |
| **P1** | H9 Web UI | v5.0 已设计 9 模块 | 前端开发 | 1A-1E |
| **P1** | H10 Docker 部署 | 完全未开始 | 新开发 | 1E |
| **P1** | H11 轨迹审计 | TAIJI-VERIFY 部分覆盖 | 扩展 | 1D |

### 2.3 EcoMind 独有优势（Hermes 不具备）

| # | 独有功能 | 竞争价值 | 实现难度 |
|---|---------|---------|---------|
| E1 | 国密 SM2/SM3/SM4 + 8状态审批流 | 🔴 政务硬门槛，无可替代 | ✅ GOVMCP 已有 |
| E2 | 12 业务域知识预加载 + RAG | 🔴 领域深度，通用框架无 | 🟡 需开发 |
| E3 | 3D 空间可视化（Cesium + Deck.gl） | 🟡 差异化展示能力 | 🟡 需开发 |

---

## 3. D20 新增：湖南省 3D 地形图首期加载

### 3.1 选型理由

- **湖南省地形丰富**：洞庭湖平原、雪峰山、武陵山、南岭山脉，地形起伏大，适合 3D 展示
- **省域范围适中**：21.18 万 km²，DEM 数据量可控
- **生态场景典型**：湘江流域水环境、洞庭湖湿地、张家界森林、株洲工业区

### 3.2 地形数据来源

| 数据 | 来源 | 分辨率 | 格式 | 获取方式 |
|------|------|--------|------|---------|
| DEM 高程数据 | 中国科学院 casearth.cn (SRTM V3) | 30m | GeoTIFF | 免费下载，分省裁剪 |
| 矢量底图 | 天地图 API | — | 瓦片服务 | 免费 300 万次/天 |
| 行政边界 | 自然资源部标准 | — | GeoJSON | 公开数据 |
| 监测站点 | 湖南省生态环境厅 | — | CSV/JSON | 后续对接 |

### 3.3 地形数据处理流程

```
湖南省 DEM (GeoTIFF, 30m SRTM)
  ↓
CesiumLab 桌面工具（免费）
  ├── DEM → Terrain 切片（.terrain / quantized-mesh）
  ├── 矢量瓦片 → MapLibre 格式（.pbf）
  └── 3D Tiles 模型导出（.clt / .json）
  ↓
cesium-offline-server（离线发布服务）
  ├── sqlite/terrain/  → Terrain 服务
  ├── sqlite/map/      → 瓦片服务
  └── sqlite/tileset/  → 3D Tiles 服务
  ↓
Cesium.js 加载
  ├── CesiumTerrainProvider（地形高程）
  ├── 天地图瓦片（影像+注记底图）
  └── Deck.gl 叠加层（监测数据热力图/弧线图）
```

### 3.4 湖南省地形技术规格

| 参数 | 值 |
|------|-----|
| 省域面积 | 21.18 万 km² |
| DEM 分辨率 | 30m (SRTM V3) |
| 地形切片大小 | 预估 500MB-1GB |
| 加载方式 | CesiumTerrainProvider（按需流式） |
| 底图服务 | 天地图（卫星影像+矢量注记） |
| 坐标系 | WGS84 (EPSG:4326) |
| 3D 场景中心 | [27.6°N, 111.7°E]（湖南省几何中心） |
| 初始相机高度 | 800km（省域全览） |

### 3.5 Cesium 初始化代码示例

```typescript
// Cesium 湖南省场景初始化
import { Viewer, CesiumTerrainProvider, UrlTemplateImageryProvider } from 'cesium';

const viewer = new Viewer('cesium-container', {
  terrainProvider: new CesiumTerrainProvider({
    url: 'http://localhost:8080/terrain/hunan',
    requestVertexNormals: true,
  }),
  imageryProvider: new UrlTemplateImageryProvider({
    url: 'https://t{0-7}.tianditu.gov.cn/img_w/wmts?' +
      'SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&' +
      'LAYER=img&STYLE=default&TILEMATRIXSET=w&' +
      'FORMAT=tiles&TILECOL={x}&TILEROW={y}&TILEMATRIX={z}&' +
      'tk=YOUR_TOKEN',
  }),
  baseLayerPicker: false,
  geocoder: false,
});

// 飞到湖南省
viewer.camera.flyTo({
  destination: Cesium.Cartesian3.fromDegrees(111.7, 27.6, 800000),
  orientation: { heading: 0, pitch: -60, roll: 0 },
});
```

---

## 4. 地图四库组合技术架构

### 4.1 四库职责划分

| 库 | 版本 | License | 职责 | 集成方式 |
|---|------|---------|------|---------|
| **Cesium.js** | 1.127+ | Apache 2.0 | 3D 数字孪生核心：地形、3D Tiles、时间动态 | React 组件 `<CesiumScene>` |
| **MapLibre GL JS** | 5.x | BSD-3 | 2D 矢量底图：快速缩放、矢量瓦片 | 集成到 Cesium 或独立面板 |
| **Deck.gl** | 9.x | MIT | 大数据可视化：热力图、弧线图、网格图 | `@deck.gl/cesium` 桥接 |
| **Turf.js** | 7.x | MIT | 空间分析：缓冲区、距离、交集 | 纯 JS 计算，不依赖渲染 |

### 4.2 层叠架构

```
┌─────────────────────────────────────────┐
│         前端 React + AntD Pro           │
├─────────────────────────────────────────┤
│    业务图层 (Deck.gl)                    │
│    ├── 监测数据热力图                     │
│    ├── 污染源弧线图                       │
│    ├── 生态保护区分区图                   │
│    └── 预警区域闪烁动画                   │
├─────────────────────────────────────────┤
│    3D 地形层 (Cesium.js)                 │
│    ├── 湖南省 DEM 高程渲染               │
│    ├── 天地图卫星影像底图                  │
│    ├── 3D Tiles 建筑物模型               │
│    └── 相机控制(旋转/缩放/飞行)           │
├─────────────────────────────────────────┤
│    空间分析引擎 (Turf.js)                │
│    ├── 缓冲区分析(污染扩散)               │
│    ├── 距离计算(最近监测站)               │
│    ├── 交集判定(保护区重叠)               │
│    └── 面积统计(污染覆盖)                 │
├─────────────────────────────────────────┤
│    2D 备用底图 (MapLibre GL JS)          │
│    ├── 矢量底图(轻量2D模式)              │
│    └── 低带宽降级方案                     │
├─────────────────────────────────────────┤
│    数据服务                              │
│    ├── cesium-offline-server (离线地形)  │
│    ├── 天地图 API (影像瓦片)             │
│    └── 后端 API (监测数据)               │
└─────────────────────────────────────────┘
```

### 4.3 Deck.gl + Cesium 集成方案

```typescript
// 使用 @deck.gl/cesium 桥接
import { Deck } from '@deck.gl/core';
import { CesiumView } from '@deck.gl/cesium';

// 在 Cesium Viewer 上叠加 Deck.gl 层
const deck = new Deck({
  parent: document.getElementById('deck-container'),
  views: new CesiumView(),
  layers: [
    new HeatmapLayer({
      id: 'pm25-heatmap',
      data: monitoringData,
      getPosition: d => [d.lng, d.lat, d.alt],
      getWeight: d => d.pm25,
      radiusPixels: 60,
      intensity: 1,
      threshold: 0.05,
    }),
    new ArcLayer({
      id: 'pollution-flow',
      data: pollutionSources,
      getSourcePosition: d => [d.sourceLng, d.sourceLat],
      getTargetPosition: d => [d.targetLng, d.targetLat],
      getSourceColor: [255, 0, 0],
      getTargetColor: [255, 165, 0],
      getWidth: 2,
    }),
  ],
});
```

---

## 5. 前端 9 模块 + 3D 空间可视化优化

### 5.1 9 模块与 3D 可视化的关系

| 模块 | 页面路由 | 3D 关联 | 核心交互 |
|------|---------|---------|---------|
| Dashboard | `/dashboard` | 3D 小窗口预览 | Agent状态+模型负载+安全告警 |
| Agent 管理 | `/agents` | 无 | Agent配置/启停/技能/知识 |
| 工作流编排 | `/workflows` | 无 | LangGraph状态图+调试 |
| 安全治理 | `/security` | 无 | VERIFY+审批流+国密 |
| 模型管理 | `/models` | 无 | 本地模型+路由+微调 |
| 业务域配置 | `/domains` | **湖南省3D区域选择** | 12业务域热力图 |
| 对话审计 | `/conversations` | 地图标注对话关联位置 | 对话流+工具调用 |
| **数据与物联** | **`/cesium`** | **湖南省3D数字孪生主场景** | **地形+热力图+设备+飞行** |
| 系统设置 | `/settings` | 无 | RBAC+等保+部署 |

### 5.2 湖南省数字孪生主场景设计

**页面 `/cesium` 是 3D 空间可视化的核心页面**：

```
┌────────────────────────────────────────────────────┐
│  左侧面板 (300px)      │    Cesium 3D 场景 (flex)     │
│  ┌──────────────────┐  │  ┌──────────────────────┐  │
│  │ 图层控制          │  │  │                      │  │
│  │ ☑ 地形高程        │  │  │   湖南省 3D 地形      │  │
│  │ ☑ 卫星影像        │  │  │   (洞庭湖/雪峰山/     │  │
│  │ ☑ 行政边界        │  │  │    武陵山/南岭)       │  │
│  │ ☑ 监测站点        │  │  │                      │  │
│  │ ☑ PM2.5 热力图    │  │  │   ● 长沙(监测站)     │  │
│  │ ☑ 水质监测点      │  │  │   ● 株洲(工业源)     │  │
│  │ ☑ 污染源标记      │  │  │   ● 湘潭(排污口)     │  │
│  │ ☐ 预警区域        │  │  │                      │  │
│  ├──────────────────┤  │  │  ─── 湘江流域 ────    │  │
│  │ 监测数据面板       │  │  │                      │  │
│  │ PM2.5: 68 μg/m³  │  │  │   洞庭湖湿地区域     │  │
│  │ AQI: 102 (轻度)   │  │  │   (3D 高程渲染)      │  │
│  │ 水质: III类       │  │  │                      │  │
│  ├──────────────────┤  │  └──────────────────────┘  │
│  │ Turf.js 分析      │  │  ┌──────────────────────┐  │
│  │ 缓冲区: 5km       │  │  │  底部时间轴             │  │
│  │ 距最近站: 2.3km   │  │  │  ◄ 2026-01 2026-06 ►  │  │
│  └──────────────────┘  │  └──────────────────────┘  │
└────────────────────────────────────────────────────┘
```

### 5.3 前端技术栈确认

| 类别 | 选型 | 版本 | 理由 |
|------|------|------|------|
| 框架 | React + TypeScript | 18.x | 生态成熟 |
| 构建 | Vite | 6.x | 极速HMR |
| UI组件 | Ant Design Pro | 6.x | 企业级后台标准 |
| 3D | Cesium.js | 1.127+ | 3D数字孪生标准 |
| 大数据图层 | Deck.gl | 9.x | GPU渲染百万点 |
| 2D底图 | MapLibre GL JS | 5.x | 开源矢量底图 |
| 空间分析 | Turf.js | 7.x | 纯JS地理计算 |
| 图表 | ECharts | 5.x | 国产生态丰富 |
| 状态管理 | Zustand | 5.x | 轻量类型安全 |
| 样式 | Tailwind CSS | 4.x | 工具类 |
| 实时通信 | Socket.IO | 4.x | Agent状态推送 |
| i18n | react-i18next | 15.x | 中英双语 |
| 离线地图服务 | cesium-offline-server | 1.1.7 | DEM地形离线发布 |

---

## 6. 后端 Hermes 对齐实施路径

### 6.1 P0 功能对齐（Phase 1A-1C）

| 功能 | Hermes 实现 | EcoMind 对齐方案 | 工作量 |
|------|-----------|----------------|--------|
| H1 对话循环 | conversation_loop.py | TAIJI-AGENT AgentLoop + EventBus | ✅ 已有，验证即用 |
| H2 三层记忆 | MemoryProvider (12钩子) | Hermes MemoryProvider 集成为 Plugin | 提取 memory_provider.py → Plugin |
| H3 LLM 多模型 | 7 Provider Adapter | LiteLLM + EcomodelAdapter | vLLM→LiteLLM + ChatGLM适配器 |
| H4 工具+MCP | tool_executor + guardrails | GOVMCP MCP桥接 + TAIJI-VERIFY guardrails | ✅ 已有，验证即用 |

### 6.2 P1 功能对齐（Phase 1D-1E）

| 功能 | Hermes 实现 | EcoMind 对齐方案 | 工作量 |
|------|-----------|----------------|--------|
| H5 技能自创建 | Curator | Phase 2 | — |
| H6 多Agent编排 | auxiliary_client | LangGraph + CrewAI 实现 | 2 周 |
| H7 Cron 定时 | 内置 cron 模块 | APScheduler + GOVMCP 审批 | 1 周 |
| H8 Gateway | Telegram/Discord/Slack | OpenClaw Gateway + CLI | 2 周 |
| H9 Web UI | 无（TUI only） | AntD Pro 9 模块 | 6 周 |
| H10 Docker 部署 | docker-compose | docker-compose + install.sh | 1 周 |
| H11 轨迹审计 | trajectory | TAIJI-VERIFY + Langfuse | 1 周 |

### 6.3 Hermes Docker 部署对标

Hermes 的部署体验是目标基线——**用户应该能像 Hermes 一样一键启动**：

```bash
# Hermes 一键部署（目标体验）
docker run -it --rm \
  -v ~/.ecomind:/opt/data \
  ecomind/os setup

docker run -d \
  --name ecomind \
  --restart unless-stopped \
  -v ~/.ecomind:/opt/data \
  -p 3000:3000 -p 8080:8080 \
  ecomind/os gateway run
```

对应的 EcoMind docker-compose.yml：

```yaml
version: "3.8"
services:
  ecomind-backend:
    image: ecomind/os-backend:latest
    container_name: ecomind-backend
    restart: unless-stopped
    command: gateway run
    volumes:
      - ~/.ecomind:/opt/data
    ports:
      - "8080:8080"
    deploy:
      resources:
        limits:
          memory: 8G
          cpus: "4.0"

  ecomind-frontend:
    image: ecomind/os-frontend:latest
    container_name: ecomind-frontend
    restart: unless-stopped
    ports:
      - "3000:80"
    depends_on:
      - ecomind-backend

  ecomind-terrain:
    image: ecomind/os-terrain:latest
    container_name: ecomind-terrain
    restart: unless-stopped
    volumes:
      - ~/.ecomind/terrain:/data
    ports:
      - "8081:80"

  postgres:
    image: timescale/timescaledb:latest-pg16
    container_name: ecomind-db
    restart: unless-stopped
    environment:
      POSTGRES_DB: ecomind
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - ~/.ecomind/pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    container_name: ecomind-redis
    restart: unless-stopped
    volumes:
      - ~/.ecomind/redis:/data

  # 可选：本地 GPU 推理
  # vllm:
  #   image: vllm/vllm-openai:latest
  #   deploy:
  #     resources:
  #       reservations:
  #         devices:
  #           - driver: nvidia
  #             count: 1
  #             capabilities: [gpu]
  #   command: --model Qwen/Qwen3-14B --max-model-len 8192
  #   ports:
  #     - "8000:8000"
```

---

## 7. Phase 1 实施计划（14 周）

### Phase 1A：基础验证 + 前端脚手架（3 周）

| # | 任务 | 负责人 | 内容 | 验收标准 |
|---|------|--------|------|---------|
| T1 | TAIJI-AGENT 启动 | 工程师 | 克隆自有仓库，本地启动 Agent Loop | 单 Agent 能接收请求→推理→返回 |
| T2 | GOVMCP 验证 | 工程师 | 确认内嵌 GOVMCP 三层集成可用 | SM2 签名/验签 + 审批流跑通 |
| T3 | vLLM/SGLang 部署 | 工程师 | 部署 Qwen3-14B 到本地 GPU | OpenAI-compatible API 可用 |
| T4 | LiteLLM 适配 | 工程师 | 配置 LiteLLM 接 vLLM | Agent 能通过 LiteLLM 调用本地模型 |
| T5 | 前端脚手架 | 工程师 | Vite + React + AntD Pro + 路由 | `pnpm dev` 启动，9 模块路由可导航 |
| T6 | Dashboard 原型 | 工程师 | 总览页 + Agent 状态卡片 | 页面可渲染，状态卡片可交互 |

### Phase 1B：地图 + 3D 可视化（3 周）

| # | 任务 | 负责人 | 内容 | 验收标准 |
|---|------|--------|------|---------|
| T7 | 湖南省DEM获取 | 工程师 | 从 casearth.cn 下载 SRTM 30m 湖南省 DEM | GeoTIFF 文件到手 |
| T8 | 地形切片处理 | 工程师 | CesiumLab → Terrain 切片 + cesium-offline-server | 浏览器能加载湖南省 3D 地形 |
| T9 | 天地图底图接入 | 工程师 | 天地图卫星影像 + 矢量注记底图 | 底图正确叠加在地形上 |
| T10 | Cesium 场景组件 | 工程师 | `<CesiumScene>` React 组件 | 前端页面能展示湖南省 3D 地形 |
| T11 | Deck.gl 图层集成 | 工程师 | 热力图 + 弧线图 + `@deck.gl/cesium` | 模拟监测数据热力图可渲染 |
| T12 | Turf.js 分析 | 工程师 | 缓冲区/距离/交集计算 API | 空间分析 API 可调用 |

### Phase 1C：Agent + 知识 + 记忆（3 周）

| # | 任务 | 负责人 | 内容 | 验收标准 |
|---|------|--------|------|---------|
| T13 | 环境监测 Agent | 工程师 | 第一个可运行的 Agent | 用户问"PM2.5为什么飙升"→ Agent 返回根因 |
| T14 | MCP 工具接入 | 工程师 | 最少 3 个工具（法规查询/数据查询/报告生成） | Agent 能调用 MCP 工具 |
| T15 | 文件知识预加载 | 工程师 | LlamaIndex 扫描桌面文件 → 向量化 | 全部 1445 文件完成索引 |
| T16 | 三层加载实现 | 工程师 | Layer 1/2/3 分级加载逻辑 | Agent 启动时自动加载对应层级知识 |
| T17 | Hermes 记忆集成 | 工程师 | MemoryProvider → TAIJI Plugin | 三层记忆（短期/长期/工作）可用 |
| T18 | Agent 管理页 | 工程师 | Agent 配置/启停/技能/知识状态 | 前端可管理 Agent 全生命周期 |

### Phase 1D：Hermes P1 功能对齐（3 周）

| # | 任务 | 负责人 | 内容 | 验收标准 |
|---|------|--------|------|---------|
| T19 | OpenClaw Gateway | 工程师 | 接入 Gateway 路由分发 | 用户消息→Gateway→Agent→响应 |
| T20 | LangGraph 编排 | 工程师 | 实现 Supervisor 模式状态图 | 多 Agent 协作执行一个环评审批流 |
| T21 | Cron 定时 | 工程师 | APScheduler + GOVMCP 审批 | 定时触发数据采集+审批 |
| T22 | 轨迹审计 | 工程师 | TAIJI-VERIFY + Langfuse | 全链路追踪可查看 |
| T23 | EcomodelAdapter | 工程师 | ChatGLM + 非 OpenAI-compatible 适配 | ChatGLM 能通过适配器接入 |
| T24 | 工作流编排页 | 工程师 | LangGraph 状态图可视化 | 工作流执行过程可可视化追踪 |

### Phase 1E：生产化部署（2 周）

| # | 任务 | 负责人 | 内容 | 验收标准 |
|---|------|--------|------|---------|
| T25 | Docker Compose | 工程师 | 全栈本地部署编排 | `docker-compose up` 一键启动 |
| T26 | install.sh | 工程师 | 一键安装脚本（类似 Hermes） | `curl|bash` 或 `setup` 一键初始化 |
| T27 | i18n + 主题 | 工程师 | 中英双语 + 暗色/亮色切换 | 切换语言/主题无闪烁 |
| T28 | 安全治理页 | 工程师 | VERIFY 面板 + 审批流 + 国密证书 | 告警可查看/审批可操作 |
| T29 | 端到端 Demo | 全员 | 完整闭环演示 | 从用户请求→Agent推理→3D展示→审批→输出 |

**Phase 1 总工期：14 周（含 2 周缓冲）**

---

## 8. 团队分工与并行策略

### 8.1 团队角色与并行分配

| 成员 | Phase 1A | Phase 1B | Phase 1C | Phase 1D | Phase 1E |
|------|---------|---------|---------|---------|---------|
| **工程师·寇豆码** | T1-T4 后端 | T7-T8 地形 | T13-T17 Agent+知识 | T19-T23 后端对齐 | T25-T26 部署 |
| **工程师·前端** | T5-T6 脚手架 | T9-T12 Cesium+Deck | T18 Agent管理页 | T24 工作流页 | T27-T28 i18n+安全 |
| **QA·严过关** | — | T7-T8 验证 | T13-T17 测试 | T19-T23 测试 | T29 端到端 |
| **架构师·高见远** | 技术指导 | 地图架构审查 | Agent架构审查 | Hermes对齐审查 | 生产化审查 |

### 8.2 关键依赖关系

```
T1(TAIJI启动) → T13(环境监测Agent) → T19(Gateway)
T2(GOVMCP) → T14(MCP工具) → T22(轨迹审计)
T3(vLLM) → T4(LiteLLM) → T23(EcomodelAdapter)
T5(前端脚手架) → T10(Cesium组件) → T18(Agent管理页) → T24(工作流页)
T7(DEM数据) → T8(地形切片) → T10(Cesium组件) → T11(Deck.gl图层)
T15(文件索引) → T16(三层加载) → T13(Agent知识)
T17(Hermes记忆) → T13(Agent推理) → T20(LangGraph编排)
```

---

## 9. 风险评估与缓解

| # | 风险 | 概率 | 影响 | 缓解措施 |
|---|------|------|------|---------|
| R1 | 湖南省DEM数据获取/处理失败 | 中 | 高 | 备选：Cesium 官方 WorldTerrain 在线服务（降级方案） |
| R2 | Cesium.js + Deck.gl 集成兼容性 | 中 | 中 | 使用 `@deck.gl/cesium` 官方桥接；版本锁定 |
| R3 | cesium-offline-server 无 License | 低 | 中 | 不用于生产分发；生产用 Nginx + 自建 Terrain 服务 |
| R4 | Hermes MemoryProvider 集成困难 | 中 | 中 | 保留 TAIJI 内置记忆为 fallback；MemoryProvider 作为 Plugin 增量集成 |
| R5 | 前端 9 模块开发量巨大 | 高 | 中 | AntD Pro 开箱即用；Phase 1 只做 6 个核心页面 |
| R6 | 本地 GPU 不够 | 中 | 高 | CPU 量化方案(Qwen3-7B-Q4)；集群推理 |
| R7 | 天地图 Token 限制 | 低 | 低 | 免费 300 万次/天；内网缓存瓦片 |

---

## 10. v6.0 完整决策矩阵（D1-D20）

| 决策 | 版本 | 选择 | 状态 |
|------|------|------|------|
| D1 后端核心 | v1.0 | TAIJI-AGENT (自有仓库) | 不变 |
| D2 验证引擎 | v1.0 | TAIJI-VERIFY (pip) | 不变 |
| D3 记忆系统 | v1.0 | Hermes MemoryProvider | 不变 |
| D4 路由编排 | v1.0 | OpenClaw Gateway + ACP | 不变 |
| D5 OpenHuman | v1.0 | 仅参考设计 | 不变 |
| D6 记忆升级 | v2.0 | Mem0+Graphiti+GraphRAG | 不变 |
| D7 L5八层防御 | v2.0 | 象信+NeMo+LettuceDetect+Langfuse | 不变 |
| D8 数据三合一 | v2.0 | TimescaleDB+PostGIS | 不变 |
| D9 协议矩阵 | v2.0 | MCP+ACP+A2A | 不变 |
| D10 本地推理 | v2.0 | SGLang+vLLM | 不变 |
| D11 Agent团队 | v2.0 | LangGraph+CrewAI | 不变 |
| D12 提示词工程 | v3.0 | wshobson三层+CreatorEdition双模式 | 不变 |
| D13 仓库策略 | v4.0 | 自有 Git 仓库 | 不变 |
| D14 模型兼容 | v4.0 | 全量国产模型+本地微调 | 不变 |
| **D15 部署架构** | **v6.0** | **本地部署优先，D15 双模式暂停** | **降级** |
| D16 文件预加载 | v4.0 | 三层渐进加载+RAG+watchdog | 不变 |
| D17 前端UI | v5.0 | 生产级9模块前端（AntD Pro+Cesium） | 不变 |
| D18 地图引擎 | v5.0 | Cesium+MapLibre+Deck.gl+Turf.js | 不变 |
| D19 Hermes对标 | v5.0 | 达到Hermes同等可部署功能水平 | 不变 |
| **D20 首期地图** | **v6.0** | **湖南省地形图（SRTM 30m DEM + 天地图底图）** | **新增** |

---

## 附录 A：湖南省 3D 地形开发 Checklist

- [ ] 从 casearth.cn 下载湖南省 SRTM 30m DEM (GeoTIFF)
- [ ] 安装 CesiumLab（免费版），导入 DEM 生成 Terrain 切片
- [ ] 部署 cesium-offline-server，加载地形切片
- [ ] 申请天地图开发者 Token（免费）
- [ ] 前端 Cesium 组件初始化，加载湖南省地形 + 天地图底图
- [ ] Deck.gl 热力图层集成，使用模拟监测数据
- [ ] Turf.js 空间分析 API 实现（缓冲区/距离/交集）
- [ ] 地图场景飞行到湖南省（27.6°N, 111.7°E, 800km）
- [ ] 左侧面板：图层控制 + 监测数据 + Turf 分析

## 附录 B：v6.0 与 Hermes 部署体验对标

| 维度 | Hermes | EcoMind v6.0 目标 |
|------|--------|------------------|
| 一键启动 | `docker run ecomind/os setup` | ✅ 对标 |
| 数据持久化 | `-v ~/.hermes:/opt/data` | ✅ 对标（`-v ~/.ecomind:/opt/data`） |
| 网关模式 | `gateway run` | ✅ 对标 |
| 配置文件 | `.env` + `config.yaml` + `SOUL.md` | ✅ 对标 |
| 资源限制 | 1-4GB RAM | 🔶 对标但更高（8GB+GPU 推荐） |
| 升级方式 | `docker compose pull && up -d` | ✅ 对标 |
| Web UI | TUI only | ✅ **超越** — AntD Pro 9 模块 + 3D |
| 地图/GIS | 无 | ✅ **超越** — 湖南省 3D 数字孪生 |
| 国密合规 | 无 | ✅ **超越** — SM2/SM3/SM4 全量 |
