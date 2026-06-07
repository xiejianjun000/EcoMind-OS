"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Cloud,
  Cpu,
  Zap,
  ChevronDown,
  Settings,
} from "lucide-react"
import {
  getModelConfig,
  saveModelConfig,
  hasRealModel,
  type ModelGlobalConfig,
} from "@/services/modelConfig"

interface ModelSelectorBarProps {
  className?: string
  onOpenSettings?: () => void
}

const PROVIDER_META: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  deepseek: { icon: <Cloud className="h-3.5 w-3.5" />, color: "#1677ff", label: "DeepSeek" },
  qwen: { icon: <Cloud className="h-3.5 w-3.5" />, color: "#722ed1", label: "通义千问" },
  glm: { icon: <Cloud className="h-3.5 w-3.5" />, color: "#13c2c2", label: "智谱 GLM" },
  "local-ollama": { icon: <Cpu className="h-3.5 w-3.5" />, color: "#52c41a", label: "Ollama 本地" },
}

/**
 * ModelSelectorBar — 大模型选择栏，横跨输入框上方
 * 显示当前模型名称、连接状态、可切换模型
 */
export function ModelSelectorBar({ className, onOpenSettings }: ModelSelectorBarProps) {
  const [config, setConfig] = useState<ModelGlobalConfig>(getModelConfig)
  const active = config.providers.find((p) => p.id === config.activeProvider)
  const online = hasRealModel()
  const meta = active ? PROVIDER_META[active.id] : undefined

  const handleSwitchProvider = (providerId: string) => {
    const updated = { ...config, activeProvider: providerId }
    setConfig(updated)
    saveModelConfig(updated)
  }

  const shortModelName = active?.model
    ?.replace("deepseek-chat", "V3")
    ?.replace("deepseek-reasoner", "R1")
    ?.replace("qwen-max", "Max")
    ?.replace("qwen-plus", "Plus")
    ?.replace("qwen-turbo", "Turbo")
    ?.replace("glm-4", "GLM-4")
    ?.replace("qwen2.5:7b", "7B")
    ?.replace("qwen2.5:14b", "14B")
    ?.replace("qwen2.5:32b", "32B")
    ?.replace("deepseek-r1:7b", "R1-7B")
    ?.replace("deepseek-r1:14b", "R1-14B")
    || ""

  return (
    <div className={cn("flex items-center gap-2 px-3 py-1.5 border-t bg-muted/30", className)}>
      {/* Model Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs font-medium hover:bg-accent data-[state=open]:bg-accent"
          >
            {meta?.icon ?? <Cloud className="h-3.5 w-3.5" />}
            <span className="max-w-[120px] truncate">
              {active?.name || "选择模型"}
            </span>
            {shortModelName && (
              <span className="text-muted-foreground font-normal text-[10px] bg-muted px-1 rounded">
                {shortModelName}
              </span>
            )}
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[270px]">
          <DropdownMenuLabel className="text-xs">切换大模型</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {config.providers.map((p) => {
            const pmeta = PROVIDER_META[p.id]
            const isActive = p.id === config.activeProvider
            return (
              <DropdownMenuItem
                key={p.id}
                onClick={() => handleSwitchProvider(p.id)}
                className={cn(
                  "flex items-center gap-2.5 cursor-pointer py-2",
                  isActive && "bg-accent"
                )}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: pmeta?.color || "#888" }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{p.name}</div>
                  <div className="text-[10px] text-muted-foreground">{p.model}</div>
                </div>
                {p.enabled ? (
                  <Badge variant="outline" className="text-[9px] h-4 px-1 text-green-600 border-green-300">
                    已配
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[9px] h-4 px-1 text-orange-500 border-orange-300">
                    未配
                  </Badge>
                )}
                {isActive && <Zap className="h-3 w-3 text-primary ml-1 shrink-0" />}
              </DropdownMenuItem>
            )
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={onOpenSettings}
            className="flex items-center gap-2 text-xs cursor-pointer text-muted-foreground"
          >
            <Settings className="h-3.5 w-3.5" />
            模型配置...
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Divider */}
      <div className="w-px h-4 bg-border" />

      {/* Connection Status */}
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 cursor-default">
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full animate-pulse",
                online ? "bg-green-500" : "bg-orange-500"
              )}
            />
            <span className="text-[10px] text-muted-foreground">
              {online ? "在线" : "Mock"}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {online
            ? `${active?.name} (${active?.model}) 已连接`
            : "未配置 API Key · 使用 Mock 模式"}
        </TooltipContent>
      </Tooltip>

      <div className="flex-1" />

      {/* Settings gear */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onOpenSettings}
          >
            <Settings className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">模型配置</TooltipContent>
      </Tooltip>
    </div>
  )
}
