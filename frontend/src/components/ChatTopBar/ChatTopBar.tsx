/**
 * ChatTopBar — WorkBuddy-style conversation header
 *
 * Left:   [☰ sidebar toggle] [＋ new chat] | title
 * Right:  [share] [🔍 search] [📋 history] [📂 panel toggle]
 */
"use client"

import { useState, useRef, useCallback, useEffect, useMemo } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Share2,
  Search,
  X,
  ChevronUp,
  ChevronDown,
  PanelRightClose,
  PanelRightOpen,
  History,
  Pencil,
  Check,
} from "lucide-react"

export interface ChatTopBarProps {
  title?: string
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
  onNewChat: () => void
  onUpdateTitle?: (title: string) => void
  onShare?: () => void
  panelVisible: boolean
  onTogglePanel: () => void
  messages?: { id: string; content: string; role: "user" | "assistant" }[]
  onScrollToMessage?: (messageId: string) => void
  className?: string
}

export function ChatTopBar({
  title,
  sidebarCollapsed,
  onToggleSidebar,
  onNewChat,
  onUpdateTitle,
  onShare,
  panelVisible,
  onTogglePanel,
  messages = [],
  onScrollToMessage,
  className,
}: ChatTopBarProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editTitleValue, setEditTitleValue] = useState("")
  const titleInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus()
      titleInputRef.current.select()
    }
  }, [isEditingTitle])

  const handleStartEditTitle = useCallback(() => {
    setEditTitleValue(title || "")
    setIsEditingTitle(true)
  }, [title])

  const handleSaveTitle = useCallback(() => {
    setIsEditingTitle(false)
    const trimmed = editTitleValue.trim()
    if (trimmed && trimmed !== title) {
      onUpdateTitle?.(trimmed)
    }
  }, [editTitleValue, title, onUpdateTitle])

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault()
        handleSaveTitle()
      } else if (e.key === "Escape") {
        setIsEditingTitle(false)
      }
    },
    [handleSaveTitle]
  )

  // ─── Chat Search ───
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState("")
  const [searchResults, setSearchResults] = useState<string[]>([])
  const [searchIndex, setSearchIndex] = useState(0)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }, [searchOpen])

  const handleSearch = useCallback(
    (keyword: string) => {
      setSearchKeyword(keyword)
      if (!keyword.trim() || !messages.length) {
        setSearchResults([])
        setSearchIndex(0)
        return
      }
      const kw = keyword.toLowerCase()
      const matched = messages
        .filter((m) => m.content.toLowerCase().includes(kw))
        .map((m) => m.id)
      setSearchResults(matched)
      setSearchIndex(0)
      if (matched.length > 0) {
        onScrollToMessage?.(matched[0])
      }
    },
    [messages, onScrollToMessage]
  )

  const handleSearchNav = useCallback(
    (direction: "prev" | "next") => {
      if (!searchResults.length) return
      const newIndex =
        direction === "next"
          ? (searchIndex + 1) % searchResults.length
          : (searchIndex - 1 + searchResults.length) % searchResults.length
      setSearchIndex(newIndex)
      onScrollToMessage?.(searchResults[newIndex])
    },
    [searchResults, searchIndex, onScrollToMessage]
  )

  const handleCloseSearch = useCallback(() => {
    setSearchOpen(false)
    setSearchKeyword("")
    setSearchResults([])
    setSearchIndex(0)
  }, [])

  // ─── History ───
  const [historyOpen, setHistoryOpen] = useState(false)
  const historyRef = useRef<HTMLDivElement>(null)

  const userPrompts = useMemo(
    () => messages.filter((m) => m.role === "user"),
    [messages]
  )

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) {
        setHistoryOpen(false)
      }
    }
    if (historyOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [historyOpen])

  return (
    <div className={cn("flex items-center gap-2 px-3 py-2 border-b bg-background shrink-0 h-11", className)}>
      {/* ── Left ── */}
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggleSidebar}>
              {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{sidebarCollapsed ? "展开侧栏" : "收起侧栏"}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onNewChat}>
              <Plus className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">新建对话</TooltipContent>
        </Tooltip>
        <div className="w-px h-5 bg-border mx-1" />
      </div>

      {/* ── Title ── */}
      <div className="flex-1 min-w-0 flex items-center">
        {isEditingTitle ? (
          <div className="flex items-center gap-1 flex-1">
            <Input ref={titleInputRef} value={editTitleValue}
              onChange={(e) => setEditTitleValue(e.target.value)}
              onBlur={handleSaveTitle} onKeyDown={handleTitleKeyDown}
              className="h-7 text-sm border-0 border-b rounded-none px-1 bg-transparent focus-visible:ring-0 focus-visible:border-primary" />
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleSaveTitle}>
              <Check className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <button className="text-sm font-medium truncate hover:text-primary transition-colors flex items-center gap-1 group"
            onClick={handleStartEditTitle} title="点击编辑标题">
            <span className="truncate">{title || "EcoMind OS"}</span>
            <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-50 flex-shrink-0" />
          </button>
        )}
      </div>

      {/* ── Right Actions ── */}
      <div className="flex items-center gap-0.5">
        {onShare && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onShare}>
                <Share2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">分享对话</TooltipContent>
          </Tooltip>
        )}

        {/* Search */}
        {searchOpen ? (
          <div className="flex items-center gap-1 bg-muted rounded-md px-2 h-8">
            <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <Input ref={searchInputRef} value={searchKeyword}
              onChange={(e) => handleSearch(e.target.value)} placeholder="搜索对话..."
              className="h-7 w-36 text-xs border-0 bg-transparent focus-visible:ring-0 p-0"
              onKeyDown={(e) => { if (e.key === "Enter") handleSearchNav("next"); if (e.key === "Escape") handleCloseSearch() }} />
            {searchResults.length > 0 && (
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">{searchIndex + 1}/{searchResults.length}</span>
            )}
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleSearchNav("prev")}><ChevronUp className="h-3 w-3" /></Button>
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleSearchNav("next")}><ChevronDown className="h-3 w-3" /></Button>
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={handleCloseSearch}><X className="h-3 w-3" /></Button>
          </div>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSearchOpen(true)}>
                <Search className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">搜索对话</TooltipContent>
          </Tooltip>
        )}

        {/* History */}
        {userPrompts.length > 0 && (
          <div className="relative" ref={historyRef}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setHistoryOpen(!historyOpen)}>
                  <History className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">历史提问</TooltipContent>
            </Tooltip>
            {historyOpen && (
              <div className="absolute right-0 top-full mt-1 w-80 max-h-96 bg-popover border rounded-lg shadow-lg z-50 overflow-hidden">
                <div className="px-3 py-2 border-b text-xs font-semibold text-muted-foreground">历史提问（{userPrompts.length}）</div>
                <div className="overflow-y-auto max-h-80">
                  {userPrompts.map((prompt) => (
                    <button key={prompt.id}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-accent transition-colors border-b last:border-0 truncate"
                      onClick={() => { onScrollToMessage?.(prompt.id); setHistoryOpen(false) }}
                      title={prompt.content.slice(0, 200)}>
                      {prompt.content.slice(0, 100)}{prompt.content.length > 100 ? "..." : ""}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Panel Toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onTogglePanel}>
              {panelVisible ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{panelVisible ? "隐藏面板" : "显示面板"}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
