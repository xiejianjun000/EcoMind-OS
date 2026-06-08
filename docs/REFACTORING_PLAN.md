# EcoMind OS UI 重构执行计划

**版本**: v1.0  
**日期**: 2026-05-26  
**目标**: 对标 WorkBuddy (shadcn/ui + Tailwind CSS) 重构 EcoMind OS 前端

---

## 一、重构范围

### 1.1 技术栈迁移

| 从 | 到 | 原因 |
|---|---|---|
| Ant Design 5.24.0 | shadcn/ui + Radix UI | 更灵活、可定制 |
| @ant-design/icons | lucide-react | 更现代、轻量 |
| 内联样式 | Tailwind CSS | 一致性强 |
| ConfigProvider 主题 | CSS Variables | 更好的暗色模式 |
| antd ProComponents | 自定义组件 | 减少依赖 |

### 1.2 组件迁移清单

| 组件 | 优先级 | 说明 |
|------|--------|------|
| Button | P0 | 核心按钮组件 |
| Input | P0 | 输入框组件 |
| Card | P0 | 卡片组件 |
| Badge | P0 | 徽章组件 |
| Avatar | P0 | 头像组件 |
| Tabs | P0 | 标签页组件 |
| Select | P1 | 选择器组件 |
| Dialog | P1 | 对话框组件 |
| Tooltip | P1 | 工具提示组件 |
| Dropdown | P1 | 下拉菜单组件 |
| ScrollArea | P1 | 滚动区域组件 |
| Separator | P1 | 分隔线组件 |
| Sheet | P1 | 侧边面板组件 |
| Skeleton | P2 | 骨架屏组件 |
| Progress | P2 | 进度条组件 |
| Popover | P2 | 弹出框组件 |
| Command | P2 | 命令面板组件 |
| Toast/Sonner | P2 | 吐司通知组件 |
| Chart | P2 | 图表组件 |
| Table | P2 | 表格组件 |

### 1.3 页面重构清单

| 页面 | 优先级 | 说明 |
|------|--------|------|
| ChatLayout | P0 | 三栏布局 |
| ChatPage | P0 | 聊天页面 |
| ChatInput | P0 | 输入区 |
| MessageBubble | P0 | 消息气泡 |
| Sidebar | P0 | 侧边栏 |
| ExpertList | P0 | 专家列表 |
| SessionList | P0 | 会话列表 |
| ArtifactPanel | P0 | 产物面板 |
| AdminLayout | P1 | 运维布局 |
| Admin Pages | P1 | 管理页面 |

---

## 二、执行步骤

### Phase 1: 基础设置 (第1天)

#### 步骤 1.1: 安装依赖

```bash
cd frontend

# 安装 Radix UI 组件
npm install @radix-ui/react-avatar @radix-ui/react-dropdown-menu @radix-ui/react-dialog @radix-ui/react-tabs @radix-ui/react-select @radix-ui/react-tooltip @radix-ui/react-popover @radix-ui/react-scroll-area @radix-ui/react-separator @radix-ui/react-slot @radix-ui/react-switch @radix-ui/react-checkbox @radix-ui/react-progress @radix-ui/react-accordion @radix-ui/react-collapsible

# 安装工具库
npm install class-variance-authority clsx tailwind-merge lucide-react

# 安装 Tailwind CSS
npm install -D tailwindcss@3 postcss autoprefixer
npx tailwindcss init -p

# 安装动画
npm install tailwindcss-animate
```

#### 步骤 1.2: 配置 Tailwind CSS

创建 `tailwind.config.js`:
```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
```

#### 步骤 1.3: 创建 CSS 变量系统

更新 `src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 240 10% 3.9%;
    --card: 0 0% 100%;
    --card-foreground: 240 10% 3.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 240 10% 3.9%;
    --primary: 160 84% 39%;
    --primary-foreground: 0 0% 98%;
    --secondary: 240 4.8% 95.9%;
    --secondary-foreground: 240 5.9% 10%;
    --muted: 240 4.8% 95.9%;
    --muted-foreground: 240 3.8% 46.1%;
    --accent: 160 84% 39%;
    --accent-foreground: 0 0% 98%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 0 0% 98%;
    --border: 240 5.9% 90%;
    --input: 240 5.9% 90%;
    --ring: 160 84% 39%;
    --radius: 0.625rem;
    --sidebar-background: 0 0% 98%;
    --sidebar-foreground: 240 5.3% 26.1%;
  }

  .dark {
    --background: 240 10% 3.9%;
    --foreground: 0 0% 98%;
    --card: 240 10% 3.9%;
    --card-foreground: 0 0% 98%;
    --primary: 160 84% 39%;
    --primary-foreground: 240 5.9% 10%;
    --secondary: 240 3.7% 15.9%;
    --secondary-foreground: 0 0% 98%;
    --muted: 240 3.7% 15.9%;
    --muted-foreground: 240 5% 64.9%;
    --accent: 160 84% 39%;
    --accent-foreground: 0 0% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 0 0% 98%;
    --border: 240 3.7% 15.9%;
    --input: 240 3.7% 15.9%;
    --ring: 160 84% 39%;
    --sidebar-background: 240 5.9% 10%;
    --sidebar-foreground: 240 4.8% 95.9%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

#### 步骤 1.4: 创建 cn() 工具函数

创建 `src/lib/utils.ts`:
```typescript
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

### Phase 2: 基础组件迁移 (第2天)

迁移以下组件到 `src/components/ui/`:
- Button (含变体)
- Input
- Card
- Badge
- Avatar
- Tabs
- Select

### Phase 3: 布局组件重构 (第3-4天)

1. 重构 ChatLayout 三栏布局
2. 重构 Sidebar 组件
3. 重构 ArtifactPanel 组件

### Phase 4: 聊天组件重构 (第5-6天)

1. 重构 ChatInput 输入区
2. 重构 MessageBubble 消息气泡
3. 重构 ChatHeader 工具栏
4. 重构 ExpertList 专家列表
5. 重构 SessionList 会话列表

### Phase 5: 管理页面重构 (第7天)

1. 重构 AdminLayout
2. 迁移各管理页面到新样式

### Phase 6: 内嵌组件 (第8天)

1. 创建 InlineChart 图表组件
2. 创建 InlineTable 表格组件
3. 创建 InlineMap 地图预览组件
4. 创建 ApprovalCard 审批卡片
5. 创建 AlertCard 告警卡片

### Phase 7: 测试与部署 (第9-10天)

1. 功能测试
2. 样式一致性检查
3. 性能优化
4. Git 提交

---

## 三、文件变更清单

### 新建文件

| 文件路径 | 说明 |
|----------|------|
| `src/lib/utils.ts` | cn() 工具函数 |
| `src/components/ui/button.tsx` | Button 组件 |
| `src/components/ui/input.tsx` | Input 组件 |
| `src/components/ui/card.tsx` | Card 组件 |
| `src/components/ui/badge.tsx` | Badge 组件 |
| `src/components/ui/avatar.tsx` | Avatar 组件 |
| `src/components/ui/tabs.tsx` | Tabs 组件 |
| `src/components/ui/select.tsx` | Select 组件 |
| `src/components/ui/dialog.tsx` | Dialog 组件 |
| `src/components/ui/tooltip.tsx` | Tooltip 组件 |
| `src/components/ui/scroll-area.tsx` | ScrollArea 组件 |
| `src/components/ui/separator.tsx` | Separator 组件 |
| `src/components/ui/sheet.tsx` | Sheet 组件 |
| `src/components/ui/skeleton.tsx` | Skeleton 组件 |
| `src/components/ui/progress.tsx` | Progress 组件 |
| `src/components/ui/popover.tsx` | Popover 组件 |
| `src/components/ui/dropdown-menu.tsx` | DropdownMenu 组件 |
| `src/components/ui/textarea.tsx` | Textarea 组件 |
| `src/components/ui/empty.tsx` | Empty 组件 |
| `src/components/chat/message-bubble.tsx` | 新消息气泡 |
| `src/components/chat/chat-input.tsx` | 新输入区 |
| `src/components/sidebar/sidebar.tsx` | 新侧边栏 |
| `src/components/sidebar/expert-list.tsx` | 新专家列表 |
| `src/components/sidebar/session-list.tsx` | 新会话列表 |
| `src/components/artifact-panel/artifact-panel.tsx` | 新产物面板 |

### 修改文件

| 文件路径 | 修改内容 |
|----------|----------|
| `tailwind.config.js` | 新建，Tailwind 配置 |
| `postcss.config.js` | 新建，PostCSS 配置 |
| `src/index.css` | 更新，CSS 变量系统 |
| `src/App.tsx` | 更新，移除 antd ConfigProvider |
| `src/main.tsx` | 更新，主题初始化 |
| `src/pages/Chat/index.tsx` | 重写，使用新组件 |
| `src/layouts/ChatLayout.tsx` | 重写，新三栏布局 |
| `src/providers/ThemeProvider.tsx` | 新建，主题提供者 |

### 删除文件

| 文件路径 | 原因 |
|----------|------|
| `src/theme/index.tsx` | 替换为 CSS 变量 |
| `src/pages/Chat/components/ChatInput.tsx` | 重写 |
| `src/pages/Chat/components/MessageBubble.tsx` | 重写 |
| `src/components/Sidebar/index.tsx` | 重写 |
| `src/components/Sidebar/ExpertList.tsx` | 重写 |
| `src/components/Sidebar/SessionList.tsx` | 重写 |
| `src/components/ArtifactPanel/index.tsx` | 重写 |

---

## 四、里程碑

| 里程碑 | 目标日期 | 完成标准 |
|---------|----------|----------|
| M1: 基础设置完成 | 第1天 | 依赖安装、配置完成 |
| M2: 基础组件迁移 | 第2天 | 10+ 组件迁移完成 |
| M3: 布局组件重构 | 第4天 | 三栏布局完成 |
| M4: 聊天组件重构 | 第6天 | 聊天界面完成 |
| M5: 管理页面重构 | 第7天 | 管理页面完成 |
| M6: 内嵌组件完成 | 第8天 | 图表/地图等组件完成 |
| M7: 测试通过 | 第9天 | 功能测试通过 |
| M8: Git 提交 | 第10天 | 代码提交完成 |

---

## 五、风险与应对

| 风险 | 影响 | 应对措施 |
|------|------|----------|
| 组件迁移遗漏 | 高 | 创建迁移清单，逐项检查 |
| 样式不一致 | 中 | 使用 CSS 变量统一管理 |
| 功能回归 | 高 | 编写测试用例 |
| 性能下降 | 中 | 使用 tree-shaking 优化 |
| 暗色模式问题 | 中 | 全面测试两种模式 |

---

## 六、验收标准

1. **功能完整性**: 所有原有功能正常工作
2. **样式一致性**: UI 与 WorkBuddy 风格一致
3. **主题支持**: 暗色/亮色模式正常工作
4. **性能指标**: 首屏加载 < 2s，交互延迟 < 100ms
5. **代码质量**: ESLint 通过，无 TypeScript 错误
6. **测试覆盖**: 核心功能测试通过

---

*执行计划创建时间: 2026-05-26*
