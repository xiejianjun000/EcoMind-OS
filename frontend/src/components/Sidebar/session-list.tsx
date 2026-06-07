"use client"

import { useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  ChevronDown, ChevronRight, MessageSquare, Trash2, Pencil, Check, X,
  Search, Square, CheckSquare, MoreHorizontal, Tag,
} from "lucide-react"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip"
import { useChatStore } from "@/store/chatStore"
import { useExpertStore } from "@/store/expertStore"

/**
 * SessionList — 增强版会话列表
 *
 * 功能: 选择会话 / 内联重命名 / 删除 / 批量选择 / 跨会话搜索 / 标签
 */
export function SessionList() {
  const {
    sessions, currentSessionId,
    deleteSession, deleteSessions,
    setCurrentSession, updateSessionTitle,
    toggleSessionSelection, selectedSessionIds,
    selectAllSessions, clearSelection,
    searchAcrossSessions,
  } = useChatStore()
  const { experts } = useExpertStore()
  const navigate = useNavigate()
  const params = useParams()

  const [expanded, setExpanded] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const [batchMode, setBatchMode] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<ReturnType<typeof searchAcrossSessions>>([])

  const handleSelectSession = (sessionId: string) => {
    if (batchMode) {
      toggleSessionSelection(sessionId)
      return
    }
    setCurrentSession(sessionId)
    navigate(`/chat/${sessionId}`)
  }

  const handleDelete = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation()
    deleteSession(sessionId)
  }

  const startRename = (e: React.MouseEvent, sessionId: string, currentTitle: string) => {
    e.stopPropagation()
    setEditingId(sessionId)
    setEditValue(currentTitle)
  }

  const commitRename = (e?: React.MouseEvent | React.KeyboardEvent) => {
    e?.stopPropagation()
    if (editingId && editValue.trim()) {
      updateSessionTitle(editingId, editValue.trim())
    }
    setEditingId(null)
  }

  const cancelRename = (e?: React.MouseEvent | React.KeyboardEvent) => {
    e?.stopPropagation()
    setEditingId(null)
  }

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); commitRename(e) }
    if (e.key === 'Escape') { e.preventDefault(); setEditingId(null) }
  }

  const handleBatchDelete = () => {
    if (selectedSessionIds.length > 0) {
      if (confirm(`确定删除 ${selectedSessionIds.length} 个会话？`)) {
        deleteSessions(selectedSessionIds)
        setBatchMode(false)
      }
    }
  }

  // Cross-session search
  const handleSearchChange = (val: string) => {
    setSearchQuery(val)
    if (val.trim().length >= 2) {
      setSearchResults(searchAcrossSessions(val))
    } else {
      setSearchResults([])
    }
  }

  const workspaceSessions = sessions.filter(s => !s.workspaceId || s.workspaceId === 'default')
  const isAllSelected = workspaceSessions.length > 0 && selectedSessionIds.length === workspaceSessions.length

  return (
    <TooltipProvider>
      <div className="space-y-2">
        {/* EcoMind OS workspace */}
        <div>
          <div className="flex items-center gap-1 px-2">
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-2 flex-1 py-1.5 text-sm font-medium hover:bg-accent rounded-md transition-colors"
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="flex-1 text-left truncate">EcoMind OS</span>
              <span className="text-xs text-muted-foreground">
                {workspaceSessions.length}
              </span>
            </button>
            {/* Batch toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={batchMode ? "secondary" : "ghost"}
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => { setBatchMode(!batchMode); clearSelection() }}
                >
                  <CheckSquare className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">{batchMode ? "退出批量模式" : "批量管理"}</TooltipContent>
            </Tooltip>
          </div>

          {/* Batch action bar */}
          {batchMode && selectedSessionIds.length > 0 && (
            <div className="ml-2 mr-1 mb-1 p-1.5 rounded-md bg-accent flex items-center gap-1">
              <span className="text-xs flex-1">{selectedSessionIds.length} 个已选</span>
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => selectAllSessions()}
                disabled={isAllSelected}>
                <CheckSquare className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={handleBatchDelete}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          )}

          {/* Cross-session search */}
          <div className="px-2 mb-1">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={e => handleSearchChange(e.target.value)}
                placeholder="搜索会话..."
                className="h-7 pl-7 text-xs bg-background"
              />
              {searchQuery && (
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                  onClick={() => { setSearchQuery(""); setSearchResults([]) }}
                >
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              )}
            </div>
          </div>

          {/* Search results (跨会话) */}
          {searchResults.length > 0 && searchQuery.trim().length >= 2 && (
            <div className="ml-2 mb-2 border rounded-md bg-background max-h-48 overflow-y-auto">
              <div className="px-2 py-1 text-[10px] text-muted-foreground border-b">
                找到 {searchResults.length} 个会话
              </div>
              {searchResults.map(r => (
                <button
                  key={r.sessionId}
                  className="w-full text-left px-2 py-1.5 hover:bg-accent transition-colors"
                  onClick={() => { handleSelectSession(r.sessionId); setSearchResults([]); setSearchQuery("") }}
                >
                  <div className="text-xs font-medium truncate">{r.title}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{r.preview}</div>
                  <Badge variant="secondary" className="text-[9px] px-1 h-3.5 mt-0.5">
                    {r.matchCount} 处匹配
                  </Badge>
                </button>
              ))}
            </div>
          )}

          {expanded && (
            <div className="ml-4 mt-1 space-y-1">
              {workspaceSessions.length === 0 ? (
                <div className="px-2 py-3 text-xs text-muted-foreground text-center">
                  暂无会话 · 点击"新建会话"开始
                </div>
              ) : (
                workspaceSessions.map((session) => {
                  const expert = experts.find((e) => e.id === session.expertId)
                  const isActive = currentSessionId === session.id || params.sessionId === session.id
                  const isSelected = selectedSessionIds.includes(session.id)
                  const isEditing = editingId === session.id

                  return (
                    <div
                      key={session.id}
                      className={cn(
                        "flex items-center gap-2 w-full p-2 rounded-md transition-colors text-left group",
                        isActive
                          ? "bg-primary/10 border border-primary/20"
                          : isSelected
                            ? "bg-accent border border-primary/30"
                            : "hover:bg-accent border border-transparent"
                      )}
                    >
                      {/* Batch select checkbox */}
                      {batchMode && (
                        <span
                          className="shrink-0 cursor-pointer"
                          onClick={(e) => { e.stopPropagation(); toggleSessionSelection(session.id) }}
                        >
                          {isSelected ? (
                            <CheckSquare className="h-4 w-4 text-primary" />
                          ) : (
                            <Square className="h-4 w-4 text-muted-foreground" />
                          )}
                        </span>
                      )}

                      <button
                        className="flex items-center gap-2 flex-1 min-w-0 text-left"
                        onClick={() => handleSelectSession(session.id)}
                      >
                        {/* 专家头像 */}
                        {expert ? (
                          <div
                            className="h-7 w-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                            style={{ backgroundColor: expert.color || '#52c41a' }}
                          >
                            {expert.displayName?.charAt(0) || '助'}
                          </div>
                        ) : (
                          <MessageSquare
                            className={cn(
                              "h-4 w-4 shrink-0",
                              isActive ? "text-primary" : "text-muted-foreground"
                            )}
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          {isEditing ? (
                            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                              <Input
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                onKeyDown={handleRenameKeyDown}
                                onBlur={() => commitRename()}
                                className="h-6 text-xs py-0 px-1"
                                autoFocus
                              />
                              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={(e) => commitRename(e)}>
                                <Check className="h-3 w-3 text-green-500" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={(e) => cancelRename(e)}>
                                <X className="h-3 w-3 text-red-500" />
                              </Button>
                            </div>
                          ) : (
                            <>
                              <div
                                className={cn(
                                  "text-sm truncate",
                                  isActive ? "font-medium text-primary" : "group-hover:text-foreground"
                                )}
                              >
                                {session.title}
                              </div>
                              <div className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                                {expert && (
                                  <span style={{ color: expert.color }}>{expert.displayName}</span>
                                )}
                                {session.messageCount > 0
                                  ? <span>{session.messageCount} 条消息</span>
                                  : null}
                                <span>{formatRelativeTime(session.updatedAt)}</span>
                                {session.conclusion && (
                                  <Badge variant="outline" className="text-[9px] px-1 h-3.5 text-yellow-600 border-yellow-300">
                                    已总结
                                  </Badge>
                                )}
                                {(session.tags || []).length > 0 && session.tags!.slice(0, 2).map(tag => (
                                  <Badge key={tag} variant="secondary" className="text-[9px] px-1 h-3.5">{tag}</Badge>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      </button>

                      {/* Action buttons (non-batch mode) */}
                      {!batchMode && !isEditing && (
                        <div className="flex gap-0.5 shrink-0">
                          {/* Rename */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span
                                className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                onClick={(e) => startRename(e, session.id, session.title)}
                              >
                                <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-primary" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="right">重命名</TooltipContent>
                          </Tooltip>

                          {/* Delete */}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span
                                className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => handleDelete(e, session.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-red-500 hover:text-red-700" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="right">删除会话</TooltipContent>
                          </Tooltip>

                          {/* More actions */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <span
                                className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={e => e.stopPropagation()}
                              >
                                <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                              </span>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-36">
                              <DropdownMenuItem onClick={(e) => startRename(e as any, session.id, session.title)}>
                                <Pencil className="h-3.5 w-3.5 mr-2" />重命名
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={(e) => handleDelete(e as any, session.id)}>
                                <Trash2 className="h-3.5 w-3.5 mr-2" />删除
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  )
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return '刚刚'
  if (diffMins < 60) return `${diffMins}分钟前`
  if (diffHours < 24) return `${diffHours}小时前`
  if (diffDays < 7) return `${diffDays}天前`
  return `${date.getMonth() + 1}/${date.getDate()}`
}
