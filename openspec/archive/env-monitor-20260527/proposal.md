# Proposal: 环境数据监测面板

> 状态：进行中 | 日期：2026-05-27

## 是什么

新增 Environmental Monitor 页面，利用已有的 envDataService 展示湖南省 14 市州实时环境数据（AQI、水质、监测站），提供数据可视化面板。

## 为什么

1. 环境监测是生态环境厅核心业务，前缺少独立数据面板
2. envDataService 已集成 WAQI + Open-Meteo 真实数据，只需 UI 层
3. 与 Chat 页面 envDataCard 形成互补：对话中快速查看 → 独立面板深度分析
4. 填补 Dashboard（偏 Agent 运维）与环境业务数据之间的空白

## 范围

- 14 城市 AQI 概览卡片（等级颜色、首要污染物）
- 城市详情展开（6 项污染物 + 气象数据）
- 监测站列表（含坐标）
- 数据刷新按钮（手动 + 自动轮询 5min）
- AQI 等级分布饼图

## 不做

- 不修改 envDataService 数据源
- 不添加后端 API
- 不涉及地图嵌入（ChatMapEmbed 已覆盖）
