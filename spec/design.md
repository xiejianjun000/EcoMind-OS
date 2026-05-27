# EcoMind OS Chat — 架构设计

> 版本：v6.5 | 最后更新：2026-05-27

---

## 一、技术栈

| 层 | 选型 |
|:---|:---|
| 框架 | React 18 + TypeScript |
| 构建 | Vite 6 |
| UI | shadcn/ui + Tailwind |
| 状态 | React useState（页面级） |
| AI | DeepSeek API（OpenAI 兼容） |
| 流式 | fetch + ReadableStream + flushSync |
| 地图 | OpenStreetMap iframe / Cesium |
| 数据 | envDataService（WAQI + Open-Meteo） |

## 二、数据流

```
用户输入 → detectCities() → chatStream()
                │                │
                │           SSE onChunk → flushSync → 逐字渲染
                │                │
                │           onDone → fetchRealData()
                │                │
                ▼                ▼
           EnvDataCard ←── getCityAQI/Stations/Water
                │
                ▼
          ChatMapEmbed（OSM iframe + 监测站标注）
```

## 三、关键决策

1. **flushSync 而非 useEffect**：React 18 自动批处理会延迟流式渲染，必须用 flushSync 强制同步
2. **Vite 代理 DeepSeek**：绕过 CORS，路径 `/deepseek` → `api.deepseek.com`
3. **两层 Key 管理**：localStorage 优先，.env 降级注入，用户可热切换
