# 对话导出与分享 — 设计文档

### 导出流程

```
用户点击导出按钮
    │
    ├── 导出 Markdown (.md)
    │   └── 格式化 messages[] → Markdown 字符串 → Blob → download
    │
    ├── 复制全文
    │   └── messages[] → 纯文本 → navigator.clipboard.writeText()
    │
    └── 分享
        └── 打开 ShareDialog → 生成临时链接 / 二维码
```

### Markdown 导出格式

```markdown
# EcoMind OS 对话记录
> 导出时间: 2026-05-27 18:30
> 专家: GAIA 生态主控

---

**用户** (18:25):
娄底的空气质量怎么样？

**GAIA 生态主控** (18:26):
根据实时监测数据，娄底市当前 AQI 为 85，等级为良...

| 指标 | 数值 |
|------|------|
| PM2.5 | 45 μg/m³ |
| PM10 | 72 μg/m³ |
...
```

### 组件树

```
ChatPage
├── Header
│   └── Share2 icon → ExportMenu (DropdownMenu)
│       ├── 导出 Markdown
│       ├── 复制全文
│       └── 生成分享链接 → ShareDialog
└── Messages (不变)
```

### 关键决策

1. **纯前端导出**：不依赖后端 API，用 Blob + URL.createObjectURL 下载
2. **无需额外依赖**：Markdown 手写格式化，PDF 复用浏览器 window.print()
3. **分享用临时链接**：Base64 编码压缩后的对话 JSON 放入 URL hash，无需服务端存储
