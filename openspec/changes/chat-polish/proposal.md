# 变更提案：Chat 页面 v6.5 打磨与正式提交

### 是什么

对 Chat 页面 v6.5 重构进行最终打磨：代码清理、类型安全加固、边界处理、正式 Git 提交。这是 v6.5 Chat 模块从"功能可用"到"生产就绪"的最后一步。

### 为什么

1. **代码债务**：54 个文件处于未提交状态，包括新创建的 Chat 页面、envDataService、ChatMapEmbed、modelConfig、database adapters、deploy 配置等
2. **类型安全**：Chat/index.tsx 中存在隐式 any 类型，MessageBubble 组件缺少严格类型
3. **边界缺陷**：空消息处理、网络断开、API 超时等场景未充分覆盖
4. **工程规范**：零 commit、零分支 = 零可追溯性，违反 SpecCoding 工程层标准

### 范围

| 层 | 交付物 | 说明 |
|:---|:---|:---|
| 代码 | Chat/index.tsx 类型加固 | 消除隐式 any，补充接口导出 |
| 代码 | 错误处理完善 | 网络断开提示、超时重试、空响应兜底 |
| 代码 | 清理 dead code | 移除未使用的 import/变量 |
| 工程 | Git commit | 按模块拆分为多个语义化 commit |
| 工程 | package.json 同步 | 确保新增依赖已声明 |

### 影响

- **Chat 页面**：小幅修改，不影响现有功能
- **新增模块**：envDataService / ChatMapEmbed / modelConfig / database / deploy 首次纳入版本控制
- **无破坏性变更**

### 风险

| 风险 | 等级 | 缓解 |
|:---|:---|:---|
| 合并冲突 | 低 | 当前仅 main 分支有 1 个 commit |
| 类型错误 | 低 | 本次修改聚焦类型安全 |
