/**
 * Conversations Audit Page — 对话审计与管理
 *
 * Displays all historical chat sessions with search, filter, detail view,
 * and delete capabilities. Data sourced from useChatStore (localStorage persisted).
 */
import React, { useState, useMemo, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import {
  Search,
  Trash2,
  MessageSquare,
  User,
  Bot,
  Calendar,
  ArrowLeft,
  AlertTriangle,
  ChevronRight,
  Filter,
  X,
} from "lucide-react"
import { useChatStore } from "@/store"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import type { ChatSession, ChatMessage } from "@/types/chat"

const ConversationsPage: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { sessions, messages, deleteSession } = useChatStore()

  // ── State ──
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [expertFilter, setExpertFilter] = useState<string>("all")
  const [deleteTarget, setDeleteTarget] = useState<ChatSession | null>(null)
  const [batchMode, setBatchMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // ── Derived: unique experts ──
  const experts = useMemo(() => {
    const set = new Set<string>()
    sessions.forEach((s) => {
      if (s.expertName) set.add(s.expertName)
    })
    return Array.from(set).sort()
  }, [sessions])

  // ── Derived: filtered sessions ──
  const filteredSessions = useMemo(() => {
    let list = [...sessions]
    // search
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      list = list.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.expertName?.toLowerCase().includes(q)
      )
    }
    // expert filter
    if (expertFilter !== "all") {
      list = list.filter((s) => s.expertName === expertFilter)
    }
    // sort by updatedAt desc
    list.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
    return list
  }, [sessions, searchQuery, expertFilter])

  // ── Derived: selected session ──
  const selectedSession = useMemo(
    () => sessions.find((s) => s.id === selectedId) ?? null,
    [sessions, selectedId]
  )

  // ── Derived: session messages ──
  const selectedMessages = useMemo((): ChatMessage[] => {
    if (!selectedId) return []
    return messages[selectedId] ?? []
  }, [messages, selectedId])

  // ── Handlers ──
  const handleSelect = useCallback((id: string) => {
    if (batchMode) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
    } else {
      setSelectedId((prev) => (prev === id ? null : id))
    }
  }, [batchMode])

  const handleDelete = useCallback(() => {
    if (!deleteTarget) return
    deleteSession(deleteTarget.id)
    if (selectedId === deleteTarget.id) setSelectedId(null)
    setDeleteTarget(null)
  }, [deleteTarget, deleteSession, selectedId])

  const handleBatchDelete = useCallback(() => {
    selectedIds.forEach((id) => deleteSession(id))
    setSelectedIds(new Set())
    setBatchMode(false)
    if (selectedId && selectedIds.has(selectedId)) setSelectedId(null)
  }, [selectedIds, deleteSession, selectedId])

  const handleNavigateToChat = useCallback(() => {
    navigate("/chat")
  }, [navigate])

  // ── Helper: format time ──
  const formatTime = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    const time = d.toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    })
    if (isToday) return `今天 ${time}`
    return d.toLocaleDateString("zh-CN", {
      month: "short",
      day: "numeric",
    }) + ` ${time}`
  }

  // ── Render: Empty State ──
  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[500px] gap-4 p-8">
        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
          <MessageSquare className="w-10 h-10 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold">暂无对话记录</h2>
        <p className="text-muted-foreground text-sm text-center max-w-md">
          您还没有开始任何 AI 对话。前往 Chat 页面与 EcoMind 生态主控智能体开始对话，所有记录将自动保存于此。
        </p>
        <Button onClick={handleNavigateToChat}>
          <MessageSquare className="w-4 h-4 mr-2" />
          开始新对话
        </Button>
      </div>
    )
  }

  // ── Render ──
  return (
    <div className="flex h-full max-h-[calc(100vh-120px)]">
      {/* ═══════════ Left: Session List ═══════════ */}
      <div className="w-full lg:w-[55%] xl:w-[50%] flex flex-col border-r">
        {/* Header */}
        <div className="p-4 border-b space-y-3 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">对话审计</h2>
              <p className="text-xs text-muted-foreground">
                共 {sessions.length} 个会话
              </p>
            </div>
            <div className="flex gap-2">
              {batchMode ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setBatchMode(false)
                      setSelectedIds(new Set())
                    }}
                  >
                    <X className="w-4 h-4 mr-1" /> 取消
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={selectedIds.size === 0}
                    onClick={handleBatchDelete}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    删除({selectedIds.size})
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBatchMode(true)}
                >
                  批量管理
                </Button>
              )}
            </div>
          </div>

          {/* Search + Filter */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="搜索会话标题..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
            <select
              value={expertFilter}
              onChange={(e) => setExpertFilter(e.target.value)}
              className="h-9 px-2 rounded-md border text-sm bg-background"
            >
              <option value="all">全部专家</option>
              {experts.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Session Cards */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {filteredSessions.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">
                <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
                未找到匹配的会话
              </div>
            ) : (
              filteredSessions.map((session) => {
                const isSelected = selectedId === session.id
                const isChecked = selectedIds.has(session.id)
                const msgCount = session.messageCount || (messages[session.id]?.length ?? 0)

                return (
                  <div
                    key={session.id}
                    onClick={() => handleSelect(session.id)}
                    className={`
                      flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors
                      ${isSelected ? "bg-primary/10 border border-primary/30" : "hover:bg-accent border border-transparent"}
                    `}
                  >
                    {batchMode && (
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleSelect(session.id)}
                        className="w-4 h-4 shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">
                          {session.title}
                        </span>
                        {session.expertName && (
                          <Badge variant="secondary" className="text-xs shrink-0">
                            {session.expertName}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          {msgCount} 条
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatTime(session.updatedAt)}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteTarget(session)
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                      </Button>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </ScrollArea>
      </div>

      {/* ═══════════ Right: Session Detail ═══════════ */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[50%] flex-col">
        {selectedSession ? (
          <>
            {/* Detail Header */}
            <div className="p-4 border-b shrink-0">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold truncate">
                  {selectedSession.title}
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedId(null)}
                >
                  <ArrowLeft className="w-4 h-4 mr-1" /> 关闭
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2 text-xs text-muted-foreground">
                <Badge variant="outline">
                  ID: {selectedSession.id.slice(0, 12)}...
                </Badge>
                {selectedSession.expertName && (
                  <Badge variant="secondary">{selectedSession.expertName}</Badge>
                )}
                <span>创建: {formatTime(selectedSession.createdAt)}</span>
                <span>更新: {formatTime(selectedSession.updatedAt)}</span>
                <span>共 {selectedMessages.length} 条消息</span>
              </div>
            </div>

            {/* Messages Preview */}
            <ScrollArea className="flex-1">
              <div className="p-4 space-y-3">
                {selectedMessages.length === 0 ? (
                  <div className="text-center text-muted-foreground py-12">
                    <Bot className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    该会话暂无消息记录
                  </div>
                ) : (
                  selectedMessages.slice(-20).map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex gap-3 ${
                        msg.role === "user" ? "justify-end" : ""
                      }`}
                    >
                      {msg.role === "assistant" && (
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                          <Bot className="w-4 h-4 text-primary" />
                        </div>
                      )}
                      <div
                        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        <div className="whitespace-pre-wrap break-words line-clamp-6">
                          {msg.content || "(空消息)"}
                        </div>
                        {msg.content && msg.content.length > 200 && (
                          <div className="text-xs text-muted-foreground mt-1">
                            共 {msg.content.length} 字符
                          </div>
                        )}
                      </div>
                      {msg.role === "user" && (
                        <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                          <User className="w-4 h-4" />
                        </div>
                      )}
                    </div>
                  ))
                )}
                {selectedMessages.length > 20 && (
                  <div className="text-center text-xs text-muted-foreground py-2 border-t">
                    仅显示最近 20 条消息（共 {selectedMessages.length} 条）
                  </div>
                )}
              </div>
            </ScrollArea>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <MessageSquare className="w-12 h-12 opacity-20" />
            <p className="text-sm">选择左侧会话查看详情</p>
          </div>
        )}
      </div>

      {/* ═══════════ Delete Confirm Dialog ═══════════ */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              确认删除
            </DialogTitle>
            <DialogDescription>
              确定要删除会话「{deleteTarget?.title}」吗？此操作将同时删除该会话下的所有消息，且不可恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              取消
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default ConversationsPage
