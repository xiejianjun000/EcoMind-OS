# Chat 页面 v6.5 打磨 — 执行计划

### Step 1: 类型加固
- 1.1 导出 EnvDataCard 接口
- 1.2 添加 handleSend 函数返回类型
- 1.3 MessageBubble 组件 props 严格类型化
- 1.4 修复 lint 警告

### Step 2: 错误处理增强
- 2.1 网络断开检测（navigator.onLine）
- 2.2 空响应兜底提示
- 2.3 重试机制（失败后自动启用重试按钮）

### Step 3: 代码清理
- 3.1 清理 ChatInput.tsx 冗余代码
- 3.2 清理未使用的 imports
- 3.3 确保 CLAUDE.md 包含项目规则

### Step 4: Git 提交
- 4.1 commit: Chat 核心（Chat/index.tsx, ChatLayout, ChatInput, sidebar 组件）
- 4.2 commit: 环境数据（envDataService, ChatMapEmbed）
- 4.3 commit: 模型配置（modelConfig, Settings/ModelConfigTab）
- 4.4 commit: 数据库适配器（database/*）
- 4.5 commit: 部署配置（deploy/*）
- 4.6 commit: 工程配置（vite.config, package.json, tsconfig, CLAUDE.md, spec/*, openspec/*）

### Step 5: 归档
- 5.1 更新 spec/tasks.md 标记 task-007 完成
- 5.2 更新 spec/devlog.md
- 5.3 git merge feature/chat-polish → main
- 5.4 移动 openspec/changes/chat-polish → archive/
