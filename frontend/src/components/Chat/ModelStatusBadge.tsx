"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Cloud, Cpu, ChevronDown, Settings, Zap } from "lucide-react"
import {
  getModelConfig,
  saveModelConfig,
  hasRealModel,
  type ModelGlobalConfig,
} from "@/services/modelConfig"

interface ModelStatusBadgeProps {
  className?: string
  onOpenSettings?: () => void
}

const PROVIDER_META: Record<string, { icon: React.ReactNode; color: string }> = {
  deepseek: { icon: <Cloud className="h-3 w-3" />, color: "#1677ff" },
  qwen: { icon: <Cloud className="h-3 w-3" />, color: "#722ed1" },
  glm: { icon: <Cloud className="h-3 w-3" />, color: "#13c2c2" },
  "local-ollama": { icon: <Cpu className="h-3 w-3" />, color: "#52c41a" },
}

/**
 * ModelStatusBadge — 模型状态指示器，与输入区按钮同行
 * 显示: DeepSeek-V4-Pro | ctx -- | ░░ | 4s | ⏲ 0s
 */
export function ModelStatusBadge({ className, onOpenSettings }: ModelStatusBadgeProps) {
  const [config, setConfig] = useState<ModelGlobalConfig>(getModelConfig)
  const [elapsed, setElapsed] = useState(0)
  const online = hasRealModel()
  const active = config.providers.find((p) => p.id === config.activeProvider)

  // Friendly model display name
  const modelLabel = active?.model
    ?.replace("deepseek-chat", "DeepSeek Chat")
    ?.replace("deepseek-reasoner", "DeepSeek R1")
    ?.replace("qwen-max", "Qwen Max")
    ?.replace("qwen-plus", "Qwen Plus")
    ?.replace("qwen-turbo", "Qwen Turbo")
    ?.replace("glm-4", "GLM-4")
    ?.replace("qwen2.5:7b", "Qwen 2.5 7B")
    ?.replace("qwen2.5:14b", "Qwen 2.5 14B")
    ?.replace("qwen2.5:32b", "Qwen 2.5 32B")
    ?.replace("deepseek-r1:7b", "DS R1 7B")
    ?.replace("deepseek-r1:14b", "DS R1 14B")
    || active?.model || "--"

  const modelId = active?.model || "--"
  const providerShort = active?.name?.split(" ")[0]?.replace(/[（(].*$/, "") || ""

  // Elapsed timer (placeholder — real value would come from stream timing)
  useEffect(() => {
    const t = setInterval(() => setElapsed((p) => p + 1), 1000)
    return () => clearInterval(t)
  }, [])

  const handleSwitch = (providerId: string) => {
    const updated = { ...config, activeProvider: providerId }
    setConfig(updated)
    saveModelConfig(updated)
  }

  // Listen for global config changes
  useEffect(() => {
    const onStorage = () => setConfig(getModelConfig())
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  return (
    <div className={cn("flex items-center gap-2 ml-auto", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-[11px] font-mono text-muted-foreground hover:text-foreground hover:bg-accent data-[state=open]:bg-accent"
          >
            <span
              className={cn("w-1.5 h-1.5 rounded-full shrink-0", online ? "bg-green-500" : "bg-orange-500")}
              style={{ backgroundColor: PROVIDER_META[config.activeProvider]?.color }}
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="font-medium text-foreground">{modelLabel}</span>
              </TooltipTrigger>
              <TooltipContent className="text-xs">
                {providerShort} · {modelId}
              </TooltipContent>
            </Tooltip>
            <span className="text-muted-foreground">|</span>
            <span className="text-muted-foreground">ctx --</span>
            <span className="text-muted-foreground">|</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-[10px] tabular-nums">{elapsed}s</span>
              </TooltipTrigger>
              <TooltipContent className="text-xs">会话时长</TooltipContent>
            </Tooltip>
            <span className="text-muted-foreground">|</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>⏲ 0s</span>
              </TooltipTrigger>
              <TooltipContent className="text-xs">上次响应耗时</TooltipContent>
            </Tooltip>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[260px]">
          <DropdownMenuLabel className="text-xs">切换大模型</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {config.providers.map((p) => {
            const pmeta = PROVIDER_META[p.id]
            const isActive = p.id === config.activeProvider
            return (
              <DropdownMenuItem
                key={p.id}
                onClick={() => handleSwitch(p.id)}
                className={cn("flex items-center gap-2.5 cursor-pointer py-2", isActive && "bg-accent")}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: pmeta?.color || "#888" }} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm">{p.name}</div>
                  <div className="text-[10px] text-muted-foreground">{p.model}</div>
                </div>
                {p.enabled && <span className="text-[9px] text-green-600 bg-green-50 px-1 rounded">已配</span>}
                {isActive && <Zap className="h-3 w-3 text-primary" />}
              </DropdownMenuItem>
            )
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onOpenSettings} className="gap-2 text-xs cursor-pointer text-muted-foreground">
            <Settings className="h-3.5 w-3.5" />
            模型配置...
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
