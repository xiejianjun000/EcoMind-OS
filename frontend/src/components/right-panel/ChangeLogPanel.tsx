/**
 * ChangeLogPanel — 专家变更审计追踪
 * 展示记忆修改、技能增减、设定变更等历史记录
 */
"use client"

import { useMemo } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  GitBranch, Clock, Brain, Settings, Wrench,
  BookOpen, Sparkles, ArrowRight,
} from "lucide-react"
import { useChatStore } from "@/store/chatStore"
import type { ChangeLogEntry } from "@/types/chat"
import { cn } from "@/lib/utils"

interface ChangeLogPanelProps {
  sessionId?: string
  agentId?: string
  className?: string
}

const CHANGE_ICONS: Record<string, React.ReactNode> = {
  memory_added: <Brain className="h-3 w-3 text-green-500" />,
  memory_updated: <Brain className="h-3 w-3 text-yellow-500" />,
  memory_deleted: <Brain className="h-3 w-3 text-red-500" />,
  setting_changed: <Settings className="h-3 w-3 text-blue-500" />,
  skill_added: <Wrench className="h-3 w-3 text-green-500" />,
  skill_removed: <Wrench className="h-3 w-3 text-red-500" />,
  diary_added: <BookOpen className="h-3 w-3 text-purple-500" />,
  conclusion_generated: <Sparkles className="h-3 w-3 text-yellow-500" />,
}

const CHANGE_LABELS: Record<string, string> = {
  memory_added: '记忆添加',
  memory_updated: '记忆更新',
  memory_deleted: '记忆删除',
  setting_changed: '设定变更',
  skill_added: '技能添加',
  skill_removed: '技能移除',
  diary_added: '日记添加',
  conclusion_generated: '结论生成',
}

export function ChangeLogPanel({ sessionId, agentId, className }: ChangeLogPanelProps) {
  const { sessions } = useChatStore()

  // Gather all change logs from matching sessions
  const allEntries = useMemo(() => {
    let entries: (ChangeLogEntry & { sessionTitle: string })[] = []
    for (const s of sessions) {
      // Filter by sessionId or agentId
      if (sessionId && s.id !== sessionId) continue
      if (s.changeLog && s.changeLog.length > 0) {
        if (agentId) {
          entries.push(...s.changeLog
            .filter(e => e.agentId === agentId)
            .map(e => ({ ...e, sessionTitle: s.title }))
          )
        } else {
          entries.push(...s.changeLog.map(e => ({ ...e, sessionTitle: s.title })))
        }
      }
    }
    return entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [sessions, sessionId, agentId])

  return (
    <ScrollArea className={cn("h-full", className)}>
      <div className="p-3 space-y-3">
        <h4 className="text-[11px] font-semibold flex items-center gap-1 mb-2">
          <GitBranch className="h-3 w-3 text-blue-500" />
          变更记录 ({allEntries.length})
        </h4>

        <Separator />

        {allEntries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <GitBranch className="h-8 w-8 mx-auto mb-2 opacity-30" />
            暂无变更记录
            <div className="text-xs mt-1">专家记忆/技能/设定变更将自动记录</div>
          </div>
        ) : (
          <div className="space-y-2">
            {allEntries.map((entry) => (
              <div key={entry.id} className="p-2.5 rounded-lg border hover:bg-accent transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <span className="shrink-0">{CHANGE_ICONS[entry.changeType] || <GitBranch className="h-3 w-3" />}</span>
                  <Badge variant="outline" className="text-[9px] px-1 h-3.5">
                    {CHANGE_LABELS[entry.changeType] || entry.changeType}
                  </Badge>
                  <Clock className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(entry.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground">{entry.description}</p>

                {(entry.before || entry.after) && (
                  <div className="mt-1.5 flex items-center gap-2 text-[10px]">
                    {entry.before && (
                      <span className="px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 line-through max-w-[45%] truncate">
                        {entry.before}
                      </span>
                    )}
                    {entry.before && entry.after && <ArrowRight className="h-2.5 w-2.5 text-muted-foreground shrink-0" />}
                    {entry.after && (
                      <span className="px-1.5 py-0.5 rounded bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 max-w-[45%] truncate">
                        {entry.after}
                      </span>
                    )}
                  </div>
                )}

                <div className="text-[10px] text-muted-foreground mt-1">
                  📁 {entry.sessionTitle} · {entry.agentName}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  )
}
