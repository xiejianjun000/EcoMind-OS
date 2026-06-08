---
name: ecomind-design
description: EcoMind OS 前端设计规范 — 湖南省生态环境厅 AI 指挥驾驶舱。当用户要求「设计页面」「改UI」「做界面」「美化」或任何涉及前端样式/组件/布局的任务时使用。
---

# EcoMind OS 设计规范 (AI Agent 可执行版)

你是 EcoMind OS 的前端设计专家。在设计任何页面或组件时，必须遵守以下规则。

## 设计哲学

**一句话**: 权威而不冰冷，科技而不轻浮——让环境数据产生敬畏感。

**基调**: 政务驾驶舱 × 生态美学
- 不是营销页 → 不需要 Hero/CTA
- 不是普通后台 → 不套 Ant Design Pro 模板
- 是指挥驾驶舱 → 数据第一，操作第二，装饰第三

## 色彩规则

```
主色: 生态绿 hsl(160, 50%, 32%)

领域色:
  水质    hsl(210, 60%, 45%)  蓝色
  大气    hsl(200, 15%, 55%)  灰蓝
  土壤    hsl(30,  40%, 45%)  棕色
  碳排放  hsl(45,  50%, 50%)  金色
  生态    hsl(120, 35%, 45%)  绿色
  固废    hsl(25,  30%, 40%)  棕灰

告警色:
  红  hsl(0,   85%, 45%)  AQI>300 严重污染
  橙  hsl(25,  90%, 50%)  AQI>200 重度
  黄  hsl(45,  85%, 50%)  AQI>150 中度
  绿  hsl(160, 50%, 35%)  AQI<100 优良
```

**铁律**:
1. 一页一个强调色（在水治理页用蓝色，就别再出现绿色强调）
2. 强调色占比 < 10%（少量按钮、选中态、Badge）
3. 背景只用纯色，不做渐变
4. 所有颜色通过 `var(--xxx)` 引用，禁止硬编码 `#xxx`

## 字体规则

**字体栈**: `'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif`

**禁止**: Inter, Roboto, Arial, system-ui

**字号层级**:
```
12px  → Badge/标注
13px  → 列表项/表单标签
15px  → 正文
17px  → Chat 消息 (专属)
20px  → 面板标题
24px  → 页面标题
32px+ → 驾驶舱 KPI 数字 (用 var(--font-number))
```

**数字字体**: `'DIN Alternate', 'Teko', 'JetBrains Mono', monospace`（仅用于 KPI 数字）

## 组件规则

### 三库分工

| 做什么 | 用什么 | 不用什么 |
|--------|--------|---------|
| Button/Input/Dialog/Tabs 等基础交互 | shadcn/ui (Radix) | Ant Design |
| Table/Form/Tree/DatePicker 等复杂组件 | Ant Design | shadcn 没有替代 |
| 布局 | shadcn Sidebar + 自定义 | Ant Design ProLayout |
| 图标 | @ant-design/icons | emoji |

**绝对禁止**: 同一功能混用两套库（比如有的页面 Button 用 shadcn 有的用 antd）。

### 卡片使用

```
✅ 用卡片:
  - Dashboard KPI 卡片
  - 案卷列表项 (可点击)
  - AI 工具调用结果 (有标题+内容+操作)

❌ 不用卡片:
  - Chat 消息 (用分割线/间距)
  - 表单区域 (用 FieldGroup)
  - 侧边栏列表 (用纯列表+hover)
```

### Chat 消息结构

每个 AI 回复必须包含:
1. **AgentAvatar** — 专家图标 (16×16 到 60×60)
2. **MarkdownContent** — 正文字号 17px, 代码块语法高亮
3. **ToolCallCard** (如有) — 工具调用可展开
4. **SourceCitations** (如有) — 法规引用, 可点击跳转

输入区域:
1. **ContextBar** — 已选上下文 chips (文件/法规/专家)
2. **PromptEditor** — 多行, 支持 @mention
3. **Toolbar** — 模型选择 / 专家选择 / 附件 / 发送

## 布局规则

```
Sidebar:     280px (默认), 可拖拽 200-400px
Chat 区:     最小 480px, 低于此切移动布局
内容最大宽:  900px (Chat 消息居中)
面板间距:    16px
页面内边距:  24px
```

## 动效规则

```
页面切换:    200ms fade-in + 上移 4px
Sidebar:    150ms slide-right
消息出现:    150ms fade-in (无位移)
Hover:      150ms 背景色过渡
加载:       骨架屏 + 脉冲
流式文字:    80ms debounce 逐字
通知:       300ms slide-left + fade
数字跳动:    600ms ease-out
```

**禁止**: 弹跳/弹簧/视差/自动轮播

## 审查清单

每次设计产出前自检:
- [ ] 只有一个强调色
- [ ] 字体是 PingFang SC
- [ ] 颜色全部引用变量
- [ ] 卡片只在合理场景
- [ ] 动效 ≤ 300ms (数字跳动除外)
- [ ] 正文字号 ≥ 15px
- [ ] 没有 shadcn/antd 混用同一交互
- [ ] 新页面写了视觉宣言
