/**
 * ToolCallMessage — 工具调用状态指示器（TRAE 模式）
 *
 * 行为：
 *   - running / pending_confirmation → 显示轻量执行中提示
 *   - success / error → 自动折叠为可展开的小标记，默认隐藏细节
 *   点击折叠标记可展开查看详情
 */
"use client"

import { useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Loader2, Check, X, AlertTriangle, ShieldAlert, ChevronRight, ChevronDown } from "lucide-react"
import type { ToolCallMessage as ToolCallMsg } from "@/pages/Chat/types"
import { getToolLabel, getToolIcon } from "@/services/toolService"

interface ToolCallMessageProps {
  toolCall: ToolCallMsg
  className?: string
}

export function ToolCallMessage({ toolCall, className }: ToolCallMessageProps) {
  const { toolName, status, result } = toolCall
  const icon = getToolIcon(toolName)
  const label = getToolLabel(toolName)
  const [expanded, setExpanded] = useState(false)

  const isRunning = status === 'running' || status === 'pending' || status === 'pending_confirmation'
  const toggleExpand = useCallback(() => setExpanded(prev => !prev), [])

  if (isRunning) {
    return (
      <div className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs animate-in fade-in slide-in-from-bottom-2 duration-200",
        "bg-blue-50/80 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400",
        className
      )}>
        <Loader2 className="h-3 w-3 animate-spin flex-shrink-0" />
        <span className="font-medium">{label}</span>
        <span className="text-blue-400/70 dark:text-blue-500/60">执行中...</span>
        <div className="flex-1" />
        <div className="h-1.5 w-16 bg-blue-200/50 dark:bg-blue-800/40 rounded-full overflow-hidden">
          <div className="h-full bg-blue-400 rounded-full animate-pulse" style={{ width: "60%" }} />
        </div>
      </div>
    )
  }

  const isSuccess = status === 'success'
  const isError = status === 'error'
  const needsConfirm = status === 'pending_confirmation'

  if (needsConfirm) {
    return (
      <div className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs",
        "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400",
        className
      )}>
        <ShieldAlert className="h-3 w-3 flex-shrink-0" />
        <span className="font-medium">{label}</span>
        <Badge variant="outline" className="text-[10px] h-4 px-1 border-amber-300 text-amber-600">
          需人工确认
        </Badge>
      </div>
    )
  }

  return (
    <div className={cn("group", className)}>
      <button
        onClick={toggleExpand}
        className={cn(
          "flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] transition-colors",
          isSuccess
            ? "text-green-600/60 hover:text-green-600 dark:text-green-500/50 hover:dark:text-green-400 hover:bg-green-50/50 dark:hover:bg-green-950/20"
            : "text-red-500/60 hover:text-red-500 dark:text-red-400/50 hover:dark:text-red-400 hover:bg-red-50/50 dark:hover:bg-red-950/20"
        )}
      >
        {isSuccess ? (
          <Check className="h-3 w-3" />
        ) : isError ? (
          <X className="h-3 w-3" />
        ) : (
          <AlertTriangle className="h-3 w-3" />
        )}
        <span>{icon} {label}</span>
        {result?.summary && (
          <span className="text-muted-foreground/70 truncate max-w-[120px]">
            {result.summary}
          </span>
        )}
        {expanded ? (
          <ChevronDown className="h-2.5 w-2.5 opacity-50" />
        ) : (
          <ChevronRight className="h-2.5 w-2.5 opacity-50" />
        )}
      </button>

      {expanded && (
        <div className={cn(
          "mt-1 p-2 rounded-md text-xs space-y-1 animate-in fade-in slide-in-from-top-1 duration-150",
          isSuccess
            ? "bg-green-50/50 dark:bg-green-950/20 text-green-700/80 dark:text-green-400/70"
            : "bg-red-50/50 dark:bg-red-950/20 text-red-700/80 dark:text-red-400/70"
        )}>
          <div className="flex items-center justify-between">
            <span className="font-medium">{icon} {label}</span>
            <span className="text-[10px] text-muted-foreground/60">
              {toolCall.timestamp}
            </span>
          </div>
          {result?.summary && (
            <div className="text-muted-foreground">{result.summary}</div>
          )}
          {isError && result?.error && (
            <div className="text-red-600 dark:text-red-400 break-all">{result.error}</div>
          )}
          {result?.duration_ms != null && (
            <div className="text-[10px] text-muted-foreground/50">
              耗时 {result.duration_ms < 1000 ? `${result.duration_ms}ms` : `${(result.duration_ms / 1000).toFixed(1)}s`}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
