# Design: 对话审计页面

## 架构

- 数据：useChatStore (Zustand + localStorage persist)
- UI：shadcn/ui (Card, Input, Button, Badge, ScrollArea)
- 布局：左侧会话列表 + 右侧详情面板
- 搜索：客户端 filter，实时响应

## 组件树

```
ConversationsPage
├── SessionList (搜索框 + 会话卡片列表)
├── SessionDetail (元数据 + 消息预览)
└── DeleteDialog (确认删除弹窗)
```
