"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useTheme } from "@/providers/ThemeProvider"
import {
  Cloud,
  Cpu,
  Key,
  Save,
  Settings,
  Sun,
  Moon,
  Palette,
  Plug,
  User,
  Shield,
  Brain,
  Sparkles,
  Database,
  Monitor,
  MessageCircle,
  CheckCircle2,
  XCircle,
  ChevronRight,
} from "lucide-react"
import {
  getModelConfig,
  saveModelConfig,
  getActiveApiKey,
  hasRealModel,
  type ModelGlobalConfig,
} from "@/services/modelConfig"

// ─── Tab definitions ───

interface SettingsTab {
  id: string
  label: string
  icon: React.ReactNode
}

const SETTINGS_TABS: SettingsTab[] = [
  { id: "models", label: "模型配置", icon: <Cpu className="h-4 w-4" /> },
  { id: "appearance", label: "外观", icon: <Palette className="h-4 w-4" /> },
  { id: "general", label: "常规", icon: <Settings className="h-4 w-4" /> },
  { id: "connectors", label: "连接器", icon: <Plug className="h-4 w-4" /> },
  { id: "account", label: "账号", icon: <User className="h-4 w-4" /> },
  { id: "permissions", label: "权限", icon: <Shield className="h-4 w-4" /> },
  { id: "memory", label: "记忆", icon: <Brain className="h-4 w-4" /> },
  { id: "personalization", label: "个性化", icon: <Sparkles className="h-4 w-4" /> },
  { id: "data", label: "数据管理", icon: <Database className="h-4 w-4" /> },
  { id: "software", label: "软件配置", icon: <Monitor className="h-4 w-4" /> },
  { id: "help", label: "帮助反馈", icon: <MessageCircle className="h-4 w-4" /> },
]

// ─── Provider options ───

const PROVIDER_OPTIONS = [
  { id: "deepseek", name: "DeepSeek (云端)", model: "deepseek-chat", baseUrl: "https://api.deepseek.com", color: "#1677ff" },
  { id: "qwen", name: "通义千问 (云端)", model: "qwen-max", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", color: "#722ed1" },
  { id: "glm", name: "智谱 GLM (云端)", model: "glm-4", baseUrl: "https://open.bigmodel.cn/api/paas/v4", color: "#13c2c2" },
  { id: "local-ollama", name: "Ollama 本地推理", model: "qwen2.5:7b", baseUrl: "http://localhost:11434", color: "#52c41a" },
]

// ─── Models Panel ───

function ModelsPanel() {
  const [config, setConfig] = useState<ModelGlobalConfig>(getModelConfig)
  const [apiKey, setApiKey] = useState(getActiveApiKey() || "")
  const [saved, setSaved] = useState(false)

  const activeProvider = config.providers.find(p => p.id === config.activeProvider)
  const online = hasRealModel()

  const handleProviderChange = (providerId: string) => {
    const updated = { ...config, activeProvider: providerId }
    setConfig(updated)
    saveModelConfig(updated)
    const p = updated.providers.find(pp => pp.id === providerId)
    if (p) setApiKey(p.apiKey || "")
  }

  const handleSave = () => {
    const updated = { ...config }
    const provider = updated.providers.find(p => p.id === config.activeProvider)
    if (provider) {
      provider.apiKey = apiKey
      provider.enabled = !!apiKey
    }
    updated.providers = [...updated.providers]
    setConfig(updated)
    saveModelConfig(updated)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="space-y-5">
      {/* Status */}
      <div className={cn(
        "flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm border",
        online
          ? "bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-200"
          : "bg-orange-50 border-orange-200 text-orange-800 dark:bg-orange-950 dark:border-orange-800 dark:text-orange-200"
      )}>
        {online ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
        <span className="text-xs">
          {online
            ? `${activeProvider?.name || ""} (${activeProvider?.model || ""}) 已连接`
            : "未配置 API Key · 使用 Mock 模式"}
        </span>
      </div>

      {/* Provider selector */}
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">模型提供商</h4>
        <div className="grid grid-cols-2 gap-2.5">
          {PROVIDER_OPTIONS.map(p => {
            const isActive = p.id === config.activeProvider
            const isConfigured = config.providers.find(pp => pp.id === p.id)?.enabled
            return (
              <button
                key={p.id}
                onClick={() => handleProviderChange(p.id)}
                className={cn(
                  "flex flex-col items-start gap-1 p-3 rounded-lg border text-left transition-all duration-150",
                  isActive
                    ? "border-primary bg-primary/5 ring-1 ring-primary/20 shadow-sm"
                    : "border-gray-200 dark:border-gray-800 hover:border-primary/30 hover:bg-accent"
                )}
              >
                <div className="flex items-center gap-2 w-full">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                  <span className="text-sm font-medium flex-1 truncate">{p.name}</span>
                  {isConfigured && (
                    <Badge variant="outline" className="text-[9px] h-4 px-1 text-green-600 shrink-0">已配</Badge>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground pl-4">{p.model}</span>
              </button>
            )
          })}
        </div>
      </div>

      <Separator />

      {/* API Key */}
      <div className="space-y-3">
        <div className="space-y-1.5">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">API Key</h4>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            className="font-mono text-sm"
          />
          <p className="text-[10px] text-muted-foreground">
            Key 保存在浏览器本地存储中，仅本地使用
          </p>
        </div>

        <div className="space-y-1.5">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">API 地址</h4>
          <Input
            value={activeProvider?.baseUrl || ""}
            readOnly
            className="text-sm text-muted-foreground bg-muted"
          />
        </div>

        <Button onClick={handleSave} className="w-full gap-2" size="sm">
          {saved ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saved ? "已保存" : "保存配置"}
        </Button>
      </div>

      <Separator />

      {/* Supported models */}
      <div className="text-xs text-muted-foreground space-y-1.5">
        <h4 className="font-medium text-foreground text-sm">📋 支持的模型</h4>
        {config.activeProvider === "deepseek" && (
          <div className="space-y-1">
            <p><code className="bg-muted px-1 rounded text-[11px]">deepseek-chat</code> — DeepSeek-V3 (通用对话)</p>
            <p><code className="bg-muted px-1 rounded text-[11px]">deepseek-reasoner</code> — DeepSeek-R1 (深度推理)</p>
          </div>
        )}
        {config.activeProvider === "qwen" && (
          <div className="space-y-1">
            <p><code className="bg-muted px-1 rounded text-[11px]">qwen-max</code> — 最强性能</p>
            <p><code className="bg-muted px-1 rounded text-[11px]">qwen-plus</code> — 均衡性价比</p>
            <p><code className="bg-muted px-1 rounded text-[11px]">qwen-turbo</code> — 极速响应</p>
          </div>
        )}
        {config.activeProvider === "glm" && (
          <p><code className="bg-muted px-1 rounded text-[11px]">glm-4</code> — GLM-4 旗舰模型</p>
        )}
        {config.activeProvider === "local-ollama" && (
          <div className="space-y-1">
            <p><code className="bg-muted px-1 rounded text-[11px]">qwen2.5:7b</code> / 14b / 32b</p>
            <p><code className="bg-muted px-1 rounded text-[11px]">deepseek-r1:7b</code> / 14b</p>
            <p className="text-[10px] mt-1">需先安装 Ollama：<code className="bg-muted px-1 rounded text-[11px]">brew install ollama</code></p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Appearance Panel ───

function AppearancePanel() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="space-y-5">
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">主题</h4>
        <div className="flex items-center justify-between p-3 rounded-lg border">
          <div>
            <span className="text-sm font-medium">深色模式</span>
            <p className="text-xs text-muted-foreground mt-0.5">切换亮色/暗色主题</p>
          </div>
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md border text-sm transition-colors",
              theme === "dark"
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-muted border-gray-200 dark:border-gray-800"
            )}
          >
            {theme === "dark" ? (
              <><Moon className="h-4 w-4" /> 暗色</>
            ) : (
              <><Sun className="h-4 w-4" /> 亮色</>
            )}
          </button>
        </div>
      </div>

      <Separator />

      <div>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">关于</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between py-1">
            <span className="text-muted-foreground">版本</span>
            <span className="font-medium">1.0.0</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-muted-foreground">平台</span>
            <span className="font-medium">EcoMind OS</span>
          </div>
          <div className="flex justify-between py-1">
            <span className="text-muted-foreground">描述</span>
            <span className="font-medium text-right max-w-[200px]">生态环境智能协作平台</span>
          </div>
        </div>
        <div className="mt-4 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground space-y-1">
          <p>🖥️ 支持国产 CPU：鲲鹏 920 / 飞腾 S2500 / 龙芯 3A6000</p>
          <p>🗄️ 适配数据库：达梦 DM8 / 人大金仓 / openGauss</p>
        </div>
      </div>
    </div>
  )
}

// ─── Placeholder Panel ───

function PlaceholderPanel({ title, description, icon }: { title: string; description: string; icon: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] text-center space-y-3">
      <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground">
        {icon}
      </div>
      <div>
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-[280px]">{description}</p>
      </div>
      <Badge variant="secondary" className="text-[10px]">即将推出</Badge>
    </div>
  )
}

// ─── Main Component ───

export default function SettingsSheetContent() {
  const [activeTab, setActiveTab] = useState("models")

  const renderContent = () => {
    switch (activeTab) {
      case "models":
        return <ModelsPanel />
      case "appearance":
        return <AppearancePanel />
      case "general":
        return <PlaceholderPanel title="常规设置" description="配置应用语言、启动行为、默认视图等常规选项" icon={<Settings className="h-7 w-7" />} />
      case "connectors":
        return <PlaceholderPanel title="连接器管理" description="管理外部数据源连接：数据库、API、IoT 设备、消息队列等" icon={<Plug className="h-7 w-7" />} />
      case "account":
        return <PlaceholderPanel title="账号管理" description="管理用户账号、团队权限、SSO 单点登录配置" icon={<User className="h-7 w-7" />} />
      case "permissions":
        return <PlaceholderPanel title="权限控制" description="细粒度权限管理：角色分配、数据访问策略、操作审计" icon={<Shield className="h-7 w-7" />} />
      case "memory":
        return <PlaceholderPanel title="记忆管理" description="AI 对话记忆存储策略、上下文窗口配置、记忆检索设置" icon={<Brain className="h-7 w-7" />} />
      case "personalization":
        return <PlaceholderPanel title="个性化" description="自定义界面布局、快捷指令、通知偏好、工作空间配置" icon={<Sparkles className="h-7 w-7" />} />
      case "data":
        return <PlaceholderPanel title="数据管理" description="数据导入导出、备份恢复、存储空间管理、数据清理策略" icon={<Database className="h-7 w-7" />} />
      case "software":
        return <PlaceholderPanel title="软件配置" description="系统更新、插件管理、依赖检测、运行环境配置" icon={<Monitor className="h-7 w-7" />} />
      case "help":
        return <PlaceholderPanel title="帮助与反馈" description="使用文档、常见问题、问题反馈、版本更新日志" icon={<MessageCircle className="h-7 w-7" />} />
      default:
        return <ModelsPanel />
    }
  }

  return (
    <div className="flex h-full">
      {/* ── Left Navigation ── */}
      <div className="w-[185px] shrink-0 border-r bg-muted/30 flex flex-col">
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-0.5">
            {SETTINGS_TABS.map((tab) => {
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-2.5 w-full px-3 py-2 rounded-md text-sm transition-all duration-150 group",
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  <span className={cn(
                    "shrink-0 transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                  )}>
                    {tab.icon}
                  </span>
                  <span className="flex-1 text-left truncate">{tab.label}</span>
                  {isActive && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-primary" />}
                </button>
              )
            })}
          </div>
        </ScrollArea>

        {/* Footer info */}
        <div className="p-3 border-t">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold"
              style={{ background: "linear-gradient(135deg, #52c41a, #237804)" }}>
              EM
            </div>
            <div>
              <p className="text-xs font-medium">EcoMind OS</p>
              <p className="text-[10px] text-muted-foreground">v1.0.0</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right Content ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Content header */}
        <div className="px-5 py-3 border-b">
          <div className="flex items-center gap-2">
            {SETTINGS_TABS.find(t => t.id === activeTab)?.icon}
            <h3 className="text-sm font-semibold">
              {SETTINGS_TABS.find(t => t.id === activeTab)?.label || "设置"}
            </h3>
          </div>
        </div>

        {/* Content body */}
        <ScrollArea className="flex-1">
          <div className="p-5">
            {renderContent()}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
