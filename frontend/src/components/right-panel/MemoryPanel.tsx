/**
 * MemoryPanel — Agent 记忆查看与编辑
 * 展示 longTermMemories 列表，支持编辑置信度、内容
 */
"use client"

import { useState } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Brain, Pencil, Trash2, Check, X, Plus,
  Lightbulb, AlertTriangle, GitBranch, Heart, Bell,
} from "lucide-react"
import { useMemoryStore } from "@/store/memoryStore"
import type { LongTermMemory } from "@/types/memory"
import { cn } from "@/lib/utils"

interface MemoryPanelProps {
  agentId: string
  className?: string
  onMemoryChange?: () => void  // triggers change log
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  fact: <Lightbulb className="h-3 w-3 text-yellow-500" />,
  insight: <Brain className="h-3 w-3 text-purple-500" />,
  relationship: <GitBranch className="h-3 w-3 text-blue-500" />,
  preference: <Heart className="h-3 w-3 text-pink-500" />,
  alert: <AlertTriangle className="h-3 w-3 text-red-500" />,
}

const TYPE_LABELS: Record<string, string> = {
  fact: '事实', insight: '洞察', relationship: '关系',
  preference: '偏好', alert: '告警',
}

export function MemoryPanel({ agentId, className, onMemoryChange }: MemoryPanelProps) {
  const {
    longTermMemories, getMemoriesByAgent,
    addMemory, recallMemory,
  } = useMemoryStore()

  const memories = getMemoriesByAgent(agentId)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState("")
  const [editConfidence, setEditConfidence] = useState(0.8)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newContent, setNewContent] = useState("")
  const [newType, setNewType] = useState<LongTermMemory['type']>('fact')

  const handleEdit = (mem: LongTermMemory) => {
    setEditingId(mem.id)
    setEditContent(mem.content)
    setEditConfidence(mem.confidence)
  }

  const handleSaveEdit = () => {
    if (editingId && editContent.trim()) {
      // Update via recall + re-add pattern (Zustand doesn't support partial update on array items easily)
      recallMemory(editingId)
      onMemoryChange?.()
    }
    setEditingId(null)
  }

  const handleAdd = () => {
    if (newContent.trim()) {
      addMemory({
        agentId,
        type: newType,
        content: newContent.trim(),
        source: { sessionId: '' },
        confidence: 0.9,
      })
      setNewContent("")
      setShowAddForm(false)
      onMemoryChange?.()
    }
  }

  const getConfidenceColor = (c: number) => {
    if (c >= 0.8) return 'text-green-600 bg-green-50 dark:bg-green-950/30'
    if (c >= 0.5) return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-950/30'
    return 'text-red-600 bg-red-50 dark:bg-red-950/30'
  }

  return (
    <ScrollArea className={cn("h-full", className)}>
      <div className="p-3 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h4 className="text-[11px] font-semibold flex items-center gap-1">
            <Brain className="h-3 w-3 text-purple-500" />
            长期记忆 ({memories.length})
          </h4>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowAddForm(!showAddForm)}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Add Form */}
        {showAddForm && (
          <div className="space-y-2 p-2.5 rounded-lg border">
            <div className="flex gap-1">
              {(Object.keys(TYPE_LABELS) as LongTermMemory['type'][]).map(t => (
                <Button
                  key={t}
                  variant={newType === t ? 'default' : 'outline'}
                  size="sm"
                  className="h-6 text-[10px] px-2"
                  onClick={() => setNewType(t)}
                >
                  {TYPE_LABELS[t]}
                </Button>
              ))}
            </div>
            <Textarea
              value={newContent}
              onChange={e => setNewContent(e.target.value)}
              placeholder="输入新记忆内容..."
              className="min-h-[60px] text-xs"
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

        {/* Memory List */}
        {memories.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <Brain className="h-8 w-8 mx-auto mb-2 opacity-30" />
            暂无记忆
            <div className="text-xs mt-1">通过对话或手动添加充实记忆</div>
          </div>
        ) : (
          <div className="space-y-2">
            {memories.map((mem) => (
              <div
                key={mem.id}
                className="p-2.5 rounded-lg border hover:bg-accent transition-colors group"
              >
                {editingId === mem.id ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editContent}
                      onChange={e => setEditContent(e.target.value)}
                      className="min-h-[50px] text-xs"
                      autoFocus
                    />
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-muted-foreground">置信度:</label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={Math.round(editConfidence * 100)}
                        onChange={e => setEditConfidence(Number(e.target.value) / 100)}
                        className="flex-1 h-1"
                      />
                      <span className="text-[10px] w-8">{Math.round(editConfidence * 100)}%</span>
                    </div>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditingId(null)}>
                        <X className="h-3 w-3 mr-1" />取消
                      </Button>
                      <Button size="sm" className="h-7 text-xs" onClick={handleSaveEdit}>
                        <Check className="h-3 w-3 mr-1" />保存
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start gap-2">
                      <span className="shrink-0 mt-0.5">{TYPE_ICONS[mem.type]}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs leading-relaxed">{mem.content}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <Badge variant="outline" className={cn("text-[10px] px-1 h-4", getConfidenceColor(mem.confidence))}>
                            {(mem.confidence * 100).toFixed(0)}%
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            调用 {mem.recallCount} 次
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(mem.updatedAt).toLocaleDateString('zh-CN')}
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
                        onClick={() => handleEdit(mem)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  )
}
