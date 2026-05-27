# 消息搜索 — 设计

### 搜索流程
```
点击 Search 图标 → 展开搜索栏 → 输入关键词
    │
    ├── 实时过滤 → 仅显示匹配消息
    ├── 高亮匹配文本 → <mark> 标签
    └── 匹配计数 → "3/15 条匹配"
```

### 实现
- 搜索状态：searchQuery + isSearchOpen
- 过滤：messages.filter(m => m.content.includes(query))
- 高亮：split + <mark className="bg-yellow-200">
- 快捷键：Ctrl+K 打开搜索，Escape 关闭
