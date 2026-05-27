# Design: 环境数据监测面板

## 架构

- 数据：envDataService (WAQI + Open-Meteo)
- UI：AntD (Card, Table, Tag, Statistic, Spin) + ECharts (饼图)
- 布局：顶部概览 → 城市列表 → 详情面板
- 刷新：手动按钮 + 5min 自动轮询

## 组件

```
Monitor/
├── index.tsx            # 主容器：数据加载 + 布局
├── CityAQICard.tsx      # 单城市 AQI 卡片
├── CityDetail.tsx       # 城市详情展开面板
├── AQIChart.tsx         # AQI 等级饼图
└── StationTable.tsx     # 监测站列表
```
