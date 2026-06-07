"use client"

import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useTheme } from "@/providers/ThemeProvider"
import { useChatStore } from "@/store/chatStore"
import { useExpertStore } from "@/store/expertStore"
import { useAuthStore, ROLE_CONFIGS } from "@/store/authStore"
import { SessionList } from "./session-list"
import { KnowledgeList } from "./KnowledgeList"
import {
  Plus, Bot, Settings, Moon, Sun, ChevronLeft, ChevronRight,
  Search, LogOut, Shield, BookOpen, PanelRight, Sparkles,
} from "lucide-react"
import type { KnowledgeFile } from "@/services/knowledgeService"

// ── Expert quick-switch icons ──
const EXPERT_QUICK = [
  { id: "ecomind", label: "助手", emoji: "🧠" },
  { id: "env-monitoring", label: "监测", emoji: "📡" },
  { id: "enforcement", label: "执法", emoji: "⚖️" },
  { id: "eia", label: "环评", emoji: "📋" },
  { id: "carbon", label: "碳排", emoji: "🏭" },
  { id: "emergency", label: "应急", emoji: "🚨" },
]

interface Props {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
  onFileClick?: (file: KnowledgeFile) => void
  onOpenSettings?: () => void
}

export function SessionSidebar({ open, className, onFileClick, onOpenSettings }: Props) {
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()
  const { createSession } = useChatStore()
  const { experts } = useExpertStore()
  const { user, logout, isAuthenticated } = useAuthStore()
  const [knowledgeExpanded, setKnowledgeExpanded] = useState(false)
  const [userPopoverOpen, setUserPopoverOpen] = useState(false)

  const handleNewSession = () => {
    const s = createSession({ title: "新会话", expertId: "ecomind", expertName: "助手" })
    navigate(`/chat/${s}`)
  }

  const handleExpertSwitch = (expertId: string, expertName: string) => {
    const s = createSession({ title: `与${expertName}的对话`, expertId, expertName })
    navigate(`/chat/${s}`)
  }

  // ── Collapsed state (52px wide) ──
  if (!open) {
    return (
      <div className={cn("h-full border-r bg-sidebar flex flex-col items-center py-3 gap-2", className)}>
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg" onClick={handleNewSession}>
          <Plus className="h-5 w-5" />
        </Button>
        <Separator className="w-8" />
        {EXPERT_QUICK.slice(0, 5).map((e) => (
          <Button
            key={e.id}
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-lg text-xs"
            onClick={() => handleExpertSwitch(e.id, e.label)}
            title={e.label}
          >
            {e.emoji}
          </Button>
        ))}
        <div className="flex-1" />
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onOpenSettings}>
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  // ── Full state (280px wide) ──
  return (
    <div className={cn("h-full border-r bg-sidebar flex flex-col", className)}>
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary text-primary-foreground">
            <Bot className="h-5 w-5" />
          </div>
          <span className="font-semibold text-base">EcoMind OS</span>
          <div className="flex-1" />
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onOpenSettings}>
            <Settings className="h-3.5 w-3.5" />
          </Button>
        </div>
        <Button className="w-full gap-2" size="sm" onClick={handleNewSession}>
          <Plus className="h-4 w-4" />
          新建会话
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3">
          {/* Expert quick switch */}
          <div className="mb-4">
            <p className="px-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              专家
            </p>
            <div className="flex flex-wrap gap-1.5">
              {EXPERT_QUICK.map((e) => (
                <button
                  key={e.id}
                  onClick={() => handleExpertSwitch(e.id, e.label)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs hover:bg-accent transition-colors"
                >
                  <span>{e.emoji}</span>
                  <span>{e.label}</span>
                </button>
              ))}
            </div>
          </div>

          <Separator className="my-2" />

          {/* Session list */}
          <div className="mb-2">
            <p className="px-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              会话记录
            </p>
            <SessionList />
          </div>

          <Separator className="my-3" />

          {/* Knowledge base */}
          <KnowledgeSection
            expanded={knowledgeExpanded}
            onExpandedChange={setKnowledgeExpanded}
            onFileClick={onFileClick}
          />
        </div>
      </ScrollArea>

      {/* Footer — user info */}
      <div className="p-3 border-t">
        <Separator className="mb-3" />
        <UserFooter
          user={user}
          isAuthenticated={isAuthenticated}
          userPopoverOpen={userPopoverOpen}
          setUserPopoverOpen={setUserPopoverOpen}
          navigate={navigate}
          logout={logout}
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-[10px] text-muted-foreground">EcoMind OS v2.2</span>
          <button
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-muted-foreground hover:text-foreground hover:bg-accent"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────

function KnowledgeSection({ expanded, onExpandedChange, onFileClick }: {
  expanded: boolean; onExpandedChange: (v: boolean) => void;
  onFileClick?: (file: KnowledgeFile) => void;
}) {
  return (
    <div>
      <button
        onClick={() => onExpandedChange(!expanded)}
        className="flex items-center gap-2 w-full px-1 py-1 rounded text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {expanded ? <ChevronLeft className="h-3 w-3 rotate-90" /> : <ChevronRight className="h-3 w-3" />}
        <BookOpen className="h-3.5 w-3.5" />
        <span>资料库</span>
      </button>
      {expanded && (
        <div className="ml-3 mt-1">
          <KnowledgeList onFileClick={onFileClick} />
        </div>
      )}
    </div>
  )
}

function UserFooter({ user, isAuthenticated, userPopoverOpen, setUserPopoverOpen, navigate, logout }: any) {
  if (!user || !isAuthenticated) {
    return (
      <button
        className="flex items-center gap-3 px-1 py-1.5 w-full rounded-lg hover:bg-accent transition-colors"
        onClick={() => navigate("/login")}
      >
        <Avatar className="h-7 w-7">
          <AvatarFallback className="text-[10px]">?</AvatarFallback>
        </Avatar>
        <span className="text-xs text-muted-foreground">点击登录</span>
      </button>
    )
  }

  const roleConfig = ROLE_CONFIGS[user.role]
  const initials = user.name.slice(0, 2).replace(/[省市县区局处]/g, "")

  return (
    <Popover open={userPopoverOpen} onOpenChange={setUserPopoverOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-2 px-1 py-1 w-full rounded-lg hover:bg-accent transition-colors">
          <Avatar className="h-7 w-7 ring-1 ring-primary/20">
            <AvatarFallback className="text-[10px] text-white font-medium" style={{ background: "linear-gradient(135deg, #52c41a, #1677ff)" }}>
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-xs font-medium truncate">{user.name}</p>
            <p className="text-[10px] text-muted-foreground truncate">
              {roleConfig?.icon} {roleConfig?.label}
            </p>
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" sideOffset={8} className="w-56 p-2">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <Avatar className="h-8 w-8 ring-2 ring-primary/20">
            <AvatarFallback className="text-[10px] text-white" style={{ background: "linear-gradient(135deg, #52c41a, #1677ff)" }}>
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-semibold">{user.name}</p>
            <p className="text-[11px] text-muted-foreground">{roleConfig?.label}</p>
          </div>
        </div>
        <Separator className="my-1.5" />
        <button
          className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          onClick={() => { setUserPopoverOpen(false); logout(); navigate("/login", { replace: true }) }}
        >
          <LogOut className="h-4 w-4" />
          退出登录
        </button>
      </PopoverContent>
    </Popover>
  )
}
