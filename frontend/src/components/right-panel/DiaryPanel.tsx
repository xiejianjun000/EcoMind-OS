/**
 * DiaryPanel — Agent 日记/Journal 面板
 * 展示每日 Dreaming 产生的日记条目 + 手动添加
 */
"use client"

import { useState } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  BookOpen, Plus, Check, X, Calendar,
  Lightbulb, ListChecks, Sparkles,
} from "lucide-react"
import { useMemoryStore } from "@/store/memoryStore"
import { cn } from "@/lib/utils"

interface DiaryPanelProps {
  agentId: string
  className?: string
  onDiaryChange?: () => void
}

export function DiaryPanel({ agentId, className, onDiaryChange }: DiaryPanelProps) {
  const { diaryEntries, getDiaryByAgent, addDiaryEntry, runDreaming, dreamingStatus } = useMemoryStore()
  const [showAddForm, setShowAddForm] = useState(false)
  const [newSummary, setNewSummary] = useState("")
  const [newFindings, setNewFindings] = useState("")

  const entries = getDiaryByAgent(agentId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  // Group by date
  const grouped = entries.reduce<Record<string, typeof entries>>((acc, entry) => {
    const date = entry.date || new Date(entry.createdAt).toISOString().slice(0, 10)
    if (!acc[date]) acc[date] = []
    acc[date].push(entry)
    return acc
  }, {})

  const handleAdd = () => {
    if (newSummary.trim()) {
      addDiaryEntry({
        agentId,
        phase: 'light',
        date: new Date().toISOString().slice(0, 10),
        summary: newSummary.trim(),
        keyFindings: newFindings.trim() ? newFindings.split('\n').filter(l => l.trim()) : [],
        actionableItems: [],
        relatedMemoryIds: [],
        score: 0.7,
      })
      setNewSummary("")
      setNewFindings("")
      setShowAddForm(false)
      onDiaryChange?.()
    }
  }

  const handleRunDreaming = () => {
    runDreaming(agentId)
  }

  return (
    <ScrollArea className={cn("h-full", className)}>
      <div className="p-3 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h4 className="text-[11px] font-semibold flex items-center gap-1">
            <BookOpen className="h-3 w-3 text-blue-500" />
            日记 ({entries.length})
          </h4>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-[10px] gap-1"
              onClick={handleRunDreaming}
              disabled={dreamingStatus === 'running'}
            >
              <Sparkles className="h-2.5 w-2.5" />
              {dreamingStatus === 'running' ? '回顾中...' : '自动回顾'}
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowAddForm(!showAddForm)}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Auto-dreaming status */}
        {dreamingStatus === 'running' && (
          <div className="bg-purple-50 dark:bg-purple-950/30 rounded-lg p-2.5 flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-purple-500 animate-pulse" />
            <span className="text-[10px] text-purple-700 dark:text-purple-300">正在自动回顾对话历史...</span>
          </div>
        )}

        {/* Add Form */}
        {showAddForm && (
          <div className="space-y-2 p-2.5 rounded-lg border">
            <label className="text-[10px] font-medium">日记摘要</label>
            <Textarea
              value={newSummary}
              onChange={e => setNewSummary(e.target.value)}
              placeholder="今天发生了什么..."
              className="min-h-[50px] text-xs"
            />
            <label className="text-[10px] font-medium">关键发现（每行一条）</label>
            <Textarea
              value={newFindings}
              onChange={e => setNewFindings(e.target.value)}
              placeholder="发现1&#10;发现2"
              className="min-h-[40px] text-xs"
            />
            <div className="flex justify-end gap-1">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowAddForm(false)}>
                <X className="h-3 w-3 mr-1" />取消
              </Button>
              <Button size="sm" className="h-7 text-xs" onClick={handleAdd}>
                <Check className="h-3 w-3 mr-1" />添加
              </Button>
            </div>
          </div>
        )}

        <Separator />

        {/* Diary entries grouped by date */}
        {entries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-30" />
            暂无日记
            <div className="text-xs mt-1">运行自动回顾或手动添加日记</div>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(grouped).map(([date, dayEntries]) => (
              <div key={date}>
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[11px] font-semibold">{date}</span>
                  <Badge variant="secondary" className="text-[10px] px-1 h-4">{dayEntries.length}</Badge>
                </div>
                <div className="space-y-2">
                  {dayEntries.map((entry) => (
                    <div key={entry.id} className="p-2.5 rounded-lg border">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Badge
                          variant={entry.phase === 'deep' ? 'default' : 'secondary'}
                          className="text-[10px] px-1 h-4"
                        >
                          {entry.phase === 'deep' ? '深度' : '轻度'}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          评分: {(entry.score * 100).toFixed(0)}%
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed">{entry.summary}</p>
                      {entry.keyFindings && entry.keyFindings.length > 0 && (
                        <div className="mt-2 space-y-0.5">
                          {entry.keyFindings.slice(0, 5).map((f, i) => (
                            <div key={i} className="flex items-start gap-1">
                              <Lightbulb className="h-2.5 w-2.5 text-yellow-500 mt-0.5 shrink-0" />
                              <span className="text-[10px] text-muted-foreground">{f}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      {entry.actionableItems && entry.actionableItems.length > 0 && (
                        <div className="mt-2 space-y-0.5">
                          <span className="text-[10px] font-medium text-green-600">行动建议:</span>
                          {entry.actionableItems.slice(0, 3).map((a, i) => (
                            <div key={i} className="flex items-start gap-1">
                              <ListChecks className="h-2.5 w-2.5 text-green-500 mt-0.5 shrink-0" />
                              <span className="text-[10px] text-green-700 dark:text-green-400">{a}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  )
}
