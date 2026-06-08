"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Loader2, CheckCircle2, XCircle, ChevronUp, ChevronDown,
  GripHorizontal, EyeOff,
} from "lucide-react"
import type { ToolCallMessage as ToolCallMsg } from "@/pages/Chat/types"

interface Props {
  toolCalls: ToolCallMsg[]
  visible: boolean
  onToggle: () => void
}

export function TaskList({ toolCalls, visible, onToggle }: Props) {
  const [expanded, setExpanded] = useState(true)
  if (!visible || toolCalls.length === 0) return null

  const running = toolCalls.filter(t => t.status === "running")
  const done = toolCalls.filter(t => t.status === "success")
  const failed = toolCalls.filter(t => t.status === "error")

  return (
    <div className="border-t bg-muted/30">
      <div className="flex items-center justify-between px-4 py-1.5">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          <GripHorizontal className="h-3 w-3" />
          任务 ({running.length} 进行中{done.length > 0 ? `, ${done.length} 已完成` : ""})
        </button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onToggle}>
          <EyeOff className="h-3.5 w-3.5" />
        </Button>
      </div>
      {expanded && (
        <div className="px-4 pb-2 space-y-1 max-h-[200px] overflow-auto">
          {running.map(tc => (
            <TaskItem key={tc.id} name={tc.name} status="running" detail={typeof tc.params === 'object' ? (tc.params as any)?.query || (tc.params as any)?.file || "" : ""} />
          ))}
          {done.slice(-5).map(tc => (
            <TaskItem key={tc.id} name={tc.name} status="success" />
          ))}
          {failed.map(tc => (
            <TaskItem key={tc.id} name={tc.name} status="error" detail={(tc as any).result || ""} />
          ))}
        </div>
      )}
    </div>
  )
}

function TaskItem({ name, status, detail }: { name: string; status: "running" | "success" | "error"; detail?: string }) {
  const labelMap: Record<string, string> = {
    env_monitor: "环境数据查询",
    regulatory_search: "法规检索",
    regulatory_ask: "法规问答",
    code_read: "读取文件",
    code_write: "写入文件",
    code_edit: "编辑文件",
    web_search: "联网搜索",
    web_fetch: "抓取网页",
    report_generate: "生成报告",
    knowledge_search: "知识库搜索",
    memory_save: "保存记忆",
    memory_search: "搜索记忆",
  }
  const label = labelMap[name] || name

  return (
    <div className={cn(
      "flex items-center gap-2 px-2 py-1 rounded text-xs",
      status === "running" && "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300",
      status === "success" && "text-muted-foreground",
      status === "error" && "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300",
    )}>
      {status === "running" && <Loader2 className="h-3 w-3 animate-spin flex-shrink-0" />}
      {status === "success" && <CheckCircle2 className="h-3 w-3 text-green-500 flex-shrink-0" />}
      {status === "error" && <XCircle className="h-3 w-3 text-red-500 flex-shrink-0" />}
      <span className="flex-1 truncate">{label}</span>
      {detail && <span className="text-[10px] opacity-60 truncate max-w-[200px]">{detail}</span>}
    </div>
  )
}
