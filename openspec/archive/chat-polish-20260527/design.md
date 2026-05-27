# Chat 页面 v6.5 打磨 — 设计文档

### 架构不变

本次变更不改变现有架构。数据流、组件树、API 调用方式保持不变。

### 改动点

1. **类型强化**
   - Message 接口添加 `envData?: EnvDataCard` 类型导出
   - handleSend 添加 AbortController 类型标注
   - MessageBubble props 严格类型

2. **错误处理**
   - chatStream onError 已处理 API 错误
   - 新增：网络断开时在 UI 层显示重试按钮
   - 新增：空响应兜底文案

3. **代码清理**
   - 移除 ChatInput.tsx 中未使用的旧版组件代码
   - 清理未使用的 lucide-react icon imports

4. **Git 提交策略**
   - commit 1: Chat 页面核心（Chat/index.tsx + ChatLayout + 依赖组件）
   - commit 2: 环境数据服务（envDataService + ChatMapEmbed）
   - commit 3: 模型配置（modelConfig）
   - commit 4: 数据库适配器（database/）
   - commit 5: 部署配置（deploy/）
   - commit 6: 配置文件更新（vite.config / package.json / tsconfig）
