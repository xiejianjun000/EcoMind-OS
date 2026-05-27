# 对话导出与分享 — 执行计划

### Step 1: 创建 ExportMenu 组件
- 1.1 DropdownMenu 下拉菜单（3 个选项）
- 1.2 导出 Markdown 逻辑（formatMessagesToMarkdown 工具函数）
- 1.3 复制全文逻辑（formatMessagesToText + clipboard API）
- 1.4 Toast 提示反馈

### Step 2: 创建 ShareDialog 组件
- 2.1 Dialog 弹窗
- 2.2 生成分享链接（compress + Base64 URL hash）
- 2.3 复制链接按钮
- 2.4 二维码生成（qrcode 轻量库或 SVG 手绘）

### Step 3: 集成到 Chat 页面
- 3.1 替换 Header 中 Share2 占位按钮
- 3.2 空对话时禁用
- 3.3 消息内容变更时更新导出数据

### Step 4: 测试验证
- 4.1 有消息 → 导出 .md 文件格式正确
- 4.2 有环境数据 → 表格正确渲染
- 4.3 空对话 → 按钮禁用
- 4.4 复制 → 剪贴板内容正确
