# EcoMind OS 设计规范

> 湖南省生态环境厅 AI 指挥驾驶舱 · 前端设计体系

## 一、设计宣言 (Visual Thesis)

**一句话**: 权威而不冰冷，科技而不轻浮——让环境数据产生敬畏感。

**基调**: 政务驾驶舱 × 生态美学
- 不是营销 Landing Page → 不需要 Hero、不需要 CTA
- 不是管理后台 → 不要 Ant Design Pro 的千篇一律
- 是指挥驾驶舱 → 数据第一，操作第二，装饰第三

**情绪地图**:
| 页面 | 情绪 | 配色侧重 | 密度 |
|------|------|---------|------|
| AI 对话 (Chat) | 专注、信赖 | 白底 + 微绿 | 低密度，留白多 |
| 数据驾驶舱 (Dashboard) | 掌控、实时 | 深色底 + 数据色 | 高密度，信息量最大 |
| 执法案卷 | 严肃、精准 | 白底 + 红蓝强调 | 中密度，表单为主 |
| Cesium 3D 地图 | 沉浸、科技 | 深底 + 荧光绿 | 全屏，无 chrome |
| 系统管理 | 平和、高效 | 浅灰底 + 蓝色 | 标准密度 |

**禁止事项**:
- ❌ 毛玻璃效果 (glassmorphism) — 政务系统不搞花哨
- ❌ 霓虹渐变 — 不是 SaaS 产品
- ❌ Emoji 作为视觉元素 — 仅文本中可用
- ❌ 超过 2 种强调色同时出现
- ❌ 纯黑 `#000` 大面积使用 — 用 `#0a0f0a` (深绿黑)

---

## 二、色彩系统

### 2.1 语义色 (继承 shadcn, 但重新调色)

```css
/* 主色: 生态绿 — 不刺眼的深绿 */
--primary: 160 50% 32%;        /* #2d7a5f */
--primary-foreground: 0 0% 100%;

/* 语义色保持 shadcn 默认, 仅调整色相匹配 */
--secondary: 158 30% 94%;      /* 微绿灰, 不偏蓝 */
--muted: 158 20% 96%;
--accent: 160 40% 90%;
--destructive: 0 72% 51%;      /* 执法红 */
--ring: 160 50% 32%;
```

### 2.2 领域色 (EcoMind 独有的业务语义色)

```css
/* 六大环境领域 */
--domain-water:    210 60% 45%;  /* 水质蓝 */
--domain-air:      200 15% 55%;  /* 大气灰蓝 */
--domain-soil:     30 40% 45%;   /* 土壤棕 */
--domain-carbon:   45 50% 50%;   /* 碳排放金 */
--domain-ecology:  120 35% 45%;  /* 生态绿 */
--domain-waste:    25 30% 40%;   /* 固废棕灰 */

/* 告警等级 */
--alert-critical:  0 85% 45%;    /* 红色: AQI>300, 重污染 */
--alert-severe:    25 90% 50%;   /* 橙色: AQI>200 */
--alert-moderate:  45 85% 50%;   /* 黄色: AQI>150 */
--alert-normal:    160 50% 35%;  /* 绿色: AQI<100 */
```

### 2.3 颜色使用规则

> Trae 铁律: "多于一种强调色即失败"

| 规则 | 说明 |
|------|------|
| 一页一强调色 | 对话页用绿, 执法页用红, 水治理页用蓝 |
| 强调色占比 < 10% | 按钮、选中态、链接、Badge |
| 背景色不做渐变 | 政务系统用纯色底, 分割靠边框和阴影 |
| 数据可视化色板 | Chart 1-5 换成领域色, 不用 shadcn 默认的橙/黄/蓝 |

---

## 三、字体系统

### 3.1 字体选择

> Trae 铁律: "禁止 Inter/Roboto/Arial"

EcoMind 的政务场景不追求个性字体, 但也不该是默认系统字体。

```
Display (标题): "PingFang SC" (macOS 原生, 政府办公标配)
Body (正文):   "PingFang SC"
Mono (代码/数据): "SF Mono", "Cascadia Code", monospace
数字 (仪表盘):  "DIN Alternate", "Teko", "JetBrains Mono", sans-serif
```

```css
--font-sans: 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
--font-mono: 'SF Mono', 'Cascadia Code', 'JetBrains Mono', monospace;
--font-number: 'DIN Alternate', 'Teko', 'JetBrains Mono', monospace;
```

### 3.2 字号层级

```css
/* 7 级字号体系 (参考 Trae chat 字号) */
--text-xs:   0.75rem;   /* 12px — Badge, 辅助标注 */
--text-sm:   0.8125rem; /* 13px — 列表项, 表单标签 */
--text-base: 0.9375rem; /* 15px — 正文 (比浏览器默认稍大) */
--text-md:   1.0625rem; /* 17px — Chat 消息正文 */
--text-lg:   1.25rem;   /* 20px — 面板标题 */
--text-xl:   1.5rem;    /* 24px — 页面标题 */
--text-2xl:  2rem;      /* 32px — 驾驶舱 KPI 数字 */

/* 字重 */
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;       /* 驾驶舱数字专用 */
```

### 3.3 字号规则

| 规则 | 说明 |
|------|------|
| 正文 15px | 比默认 16px 略小, 政务系统信息密度高 |
| Chat 消息 17px | 比正文大, 提升阅读体验 (参考 Trae chat) |
| KPI 数字 32px+ | 驾驶舱页面的核心数字要大到有冲击力 |
| 最小字号 12px | 再不比 12px 小, 保证可读性 |

---

## 四、间距和布局

### 4.1 间距量表 (4px 基准)

```css
--space-1:  4px;
--space-2:  8px;
--space-3:  12px;
--space-4:  16px;
--space-5:  20px;
--space-6:  24px;
--space-8:  32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;
```

### 4.2 布局规则

| 规则 | 说明 |
|------|------|
| Sidebar 默认 280px | 可拖拽范围 200-400px |
| Chat 区最小 480px | 低于此宽度切换到移动布局 |
| 内容最大宽度 900px | Chat 消息居中, 不撑满全屏 (参考 Trae interactive-session) |
| 面板间距 16px | 卡片/面板之间统一 16px |
| 页面内边距 24px | 非全屏页面统一内边距 |

### 4.3 卡片使用规范

> Trae 铁律: "默认不用卡片。卡片只在交互本身就是'卡片'时使用"

EcoMind 适用场景:
- ✅ Dashboard KPI 卡片 — 天生是该用卡片
- ✅ 案卷列表项 — 每项是可点击的, 用卡片
- ✅ AI 工具调用结果 — 卡片包裹, 有标题/内容/操作
- ❌ Chat 消息 — 不用卡片, 用分割线或间距区分
- ❌ 表单区域 — 不用卡片包裹, 用 FieldGroup
- ❌ 侧边栏列表 — 不用卡片, 用纯列表 + hover 态

---

## 五、组件使用规范

### 5.1 组件库分工

EcoMind 混用三套库, 必须定规则:

| 用途 | 用什么 | 不用什么 |
|------|--------|---------|
| 基础 UI (Button/Input/Dialog/Tabs) | shadcn/ui | — |
| 复杂交互 (Table/Form/Tree/DatePicker) | Ant Design | shadcn 没有替代 |
| 图标 | `@ant-design/icons` | 不用 emoji 代替 |
| 布局 | shadcn Sidebar + 自定义 | Ant Design ProLayout |
| 消息/Chat UI | **自定义** | 不存在现成方案 |

**禁止**: 同一交互用两套库混搭。比如 Button 要么全用 shadcn `Button`, 要么全用 Ant `Button`, 不能有的页面用 shadcn 有的用 Ant Design。

### 5.2 消息组件 (自研规范)

```tsx
// Chat 消息结构 — 参考 Trae ChatView
<MessageList>
  <UserMessage>
    <Content />           {/* Markdown, 右对齐 */}
  </UserMessage>
  <AssistantMessage>
    <AgentAvatar />       {/* 专家头像, 16×16 → 60×60 */}
    <ThinkingBlock />     {/* 思考过程, 可折叠 */}
    <ToolCallCard />      {/* 工具调用, 可展开 */}
    <MarkdownContent />   {/* 正文, 支持代码语法高亮 */}
    <SourceCitations />   {/* 法规引用, 可点击 */}
  </AssistantMessage>
</MessageList>
<ChatInput>
  <ContextBar />          {/* 已选上下文 chips */}
  <PromptEditor />        {/* 多行输入 + @mention */}
  <Toolbar>               {/* 模型/专家/附件/发送 */}
    <ModelPicker />
    <ExpertPicker />
    <FileAttach />
    <SubmitButton />
  </Toolbar>
</ChatInput>
```

### 5.3 数据可视化配色

```css
/* 替换 shadcn 默认的 chart-1~5 */
--chart-water:   210 60% 50%;   /* 水质 */
--chart-air:     200 15% 55%;   /* 大气 */
--chart-soil:    30 40% 45%;    /* 土壤 */
--chart-carbon:  45 50% 50%;    /* 碳排放 */
--chart-alert:   0 85% 45%;     /* 告警 */
```

---

## 六、动效规范

> 参考 Trae: "录屏3秒内可察觉, 手机上流畅, 快而克制"

| 场景 | 动效 | 时长 |
|------|------|------|
| 页面切换 | fade-in + 微上移 4px | 200ms ease-out |
| Sidebar 展开 | slide-right | 150ms ease-out |
| 消息出现 | fade-in (无位移) | 150ms |
| Hover 反馈 | 背景色变 (CSS transition) | 150ms |
| 加载态 | 骨架屏 + 脉冲动画 | 持续 |
| 流式文字 | 逐字出现 (typewriter) | 80ms debounce |
| 通知 Toast | slide-left + fade | 300ms ease-out |
| 数字跳动 | CSS `@property` 过渡 | 600ms ease-out |

**禁止**:
- ❌ 弹跳/弹簧/橡皮筋效果
- ❌ 视差滚动 (政务系统不做炫技)
- ❌ 自动轮播 (让用户自己控制)

---

## 七、响应式策略

| 断点 | 宽度 | 布局 |
|------|------|------|
| 大屏 | ≥ 1440px | 三栏: Sidebar + Chat + Context Panel |
| 标准 | 1024-1439px | 两栏: Sidebar + Chat |
| 平板 | 768-1023px | 单栏 + 可滑出 Sidebar |
| 手机 | < 768px | 单栏全屏, 简化操作 |

---

## 八、设计审查清单

每次 PR 涉及 UI 改动, 必须通过:

- [ ] 一页只有一个强调色
- [ ] 字体用了 PingFang SC (不是 Inter/Roboto/系统默认)
- [ ] 卡片只在合适场景用 (参考 4.3)
- [ ] 动效不超过 300ms
- [ ] 正文字号 ≥ 15px
- [ ] 颜色通过 WCAG AA 对比度 (4.5:1)
- [ ] 没有硬编码颜色值 (全部引用 CSS 变量)
- [ ] 三库混用? Button/Input 只用 shadcn, Table/Form 只用 Ant Design
- [ ] 新的页面写了视觉宣言 (一行)
