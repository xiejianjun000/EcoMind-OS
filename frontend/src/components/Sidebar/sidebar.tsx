"use client"

import { useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Search,
  Plus,
  ChevronDown,
  ChevronRight,
  Settings,
  Moon,
  Sun,
  Bot,
  Sparkles,
  Wrench,
  Plug,
  BookOpen,
  MessageSquare,
  Brain,
  FolderOpen,
  Folder,
  FileText,
} from "lucide-react"
import { LogOut, Shield, BarChart3, Scale } from "lucide-react"
import { useTheme } from "@/providers/ThemeProvider"
import { useExpertStore } from "@/store/expertStore"
import { useChatStore } from "@/store/chatStore"
import { useAuthStore, ROLE_CONFIGS } from "@/store/authStore"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { SessionList } from "./session-list"
import { KnowledgeList } from "./KnowledgeList"
import type { KnowledgeFile } from "@/services/knowledgeService"

interface SidebarProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
  onFileClick?: (file: KnowledgeFile) => void
  onOpenSettings?: () => void
  onContextPanelOpen?: (view: string) => void
  contextPanelOpen?: boolean
}

export function Sidebar({ open, className, onFileClick, onOpenSettings, onContextPanelOpen, contextPanelOpen }: SidebarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { theme, setTheme } = useTheme()
  const { experts } = useExpertStore()
  const { createSession } = useChatStore()
  const [knowledgeExpanded, setKnowledgeExpanded] = useState(false)
  const [activeView, setActiveView] = useState<string>("chat")

  const handleNewSession = () => {
    const sessionId = createSession({ title: '新会话', expertId: 'ecomind', expertName: '助手' })
    navigate(`/chat/${sessionId}`)
  }

  /** Open right context panel with a specific view */
  const openContext = (view: string) => {
    setActiveView(view)
    onContextPanelOpen?.(view)
  }

  if (!open) {
    return (
      <div className={cn("h-full border-r bg-sidebar flex flex-col", className)}>
        <div className="p-3 flex justify-center">
          <Bot className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1 flex flex-col items-center py-4 space-y-4">
          <Button variant="ghost" size="icon" className="rounded-full" onClick={handleNewSession}>
            <Plus className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleNewSession}>
            <MessageSquare className="h-5 w-5" />
          </Button>
        </div>
      </div>
    )
  }

  // ── Nav items — main navigation: click → switch right context panel ──
  const mainNavItems = [
    { icon: <MessageSquare className="h-4 w-4" />, label: "助理", view: "chat",
      active: activeView === "chat" || location.pathname === "/chat",
      onClick: () => {
        setActiveView("chat")
        const s = createSession({ title: '新会话', expertId: 'ecomind', expertName: '助手' })
        navigate(`/chat/${s}`)
      }
    },
    { icon: <Sparkles className="h-4 w-4" />, label: "专家", view: "expert",
      active: activeView === "expert",
      onClick: () => openContext("case")
    },
    { icon: <Wrench className="h-4 w-4" />, label: "技能", view: "skill",
      active: activeView === "skill",
      onClick: () => openContext("insight")
    },
    { icon: <Shield className="h-4 w-4" />, label: "安全", view: "security",
      active: activeView === "security",
      onClick: () => openContext("case")
    },
    { icon: <BarChart3 className="h-4 w-4" />, label: "监测", view: "monitor",
      active: activeView === "monitor",
      onClick: () => openContext("monitor")
    },
    { icon: <Scale className="h-4 w-4" />, label: "法规", view: "regulation",
      active: activeView === "regulation",
      onClick: () => openContext("regulation")
    },
  ]

  const secondaryNavItems = [
    { icon: <Brain className="h-4 w-4" />, label: "记忆", view: "memory",
      active: activeView === "memory",
      onClick: () => openContext("insight")
    },
    { icon: <Plug className="h-4 w-4" />, label: "网关", view: "gateway",
      active: activeView === "gateway",
      onClick: () => openContext("history")
    },
    { icon: <BookOpen className="h-4 w-4" />, label: "资料", view: "knowledge",
      active: activeView === "knowledge",
      onClick: () => {
        setKnowledgeExpanded(!knowledgeExpanded)
        setActiveView("knowledge")
        openContext("history")
      }
    },
  ]

  // ── Mock workspace folders ──
  const workspaces = [
    { name: "生态环境监测", files: 12 },
    { name: "执法监察", files: 8 },
    { name: "环评项目", files: 5 },
    { name: "应急管理", files: 3 },
  ]

  return (
    <div className={cn("h-full border-r bg-sidebar flex flex-col", className)}>
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center gap-2 mb-4">
          <Bot className="h-6 w-6 text-primary" />
          <span className="font-semibold text-lg">EcoMind OS</span>
        </div>
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="搜索任务..." className="pl-9 bg-background" />
        </div>
      </div>

      {/* New Chat Button */}
      <div className="p-4 pb-2">
        <Button className="w-full gap-2" size="sm" onClick={handleNewSession}>
          <Plus className="h-4 w-4" />
          新建会话
        </Button>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1">
        <div className="p-2">

          {/* ── 1. Main nav: 助理 / 专家 / 技能 / 连接器 ── */}
          <div className="mb-1">
            {mainNavItems.map((item) => (
              <SidebarNavItem
                key={item.label}
                icon={item.icon}
                label={item.label}
                isActive={item.active}
                onClick={item.onClick}
              />
            ))}
          </div>

          {/* ── 2. Knowledge Base — keep expandable ── */}
          <KnowledgeSection
            expanded={knowledgeExpanded}
            onExpandedChange={setKnowledgeExpanded}
            onFileClick={onFileClick}
          />

          {/* ── 3. 自动化 / 记忆 ── */}
          <div className="mb-1">
            {secondaryNavItems.map((item) => (
              <SidebarNavItem
                key={item.label}
                icon={item.icon}
                label={item.label}
                isActive={item.active}
                onClick={item.onClick}
              />
            ))}
          </div>

          <Separator className="my-2" />

          {/* ── 4. 会话记录 ── */}
          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            会话记录
          </div>
          <SessionList />

          <Separator className="my-3" />

          {/* ── 5. 工作空间（文件夹） ── */}
          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            工作空间
          </div>
          {workspaces.map((ws) => (
            <button
              key={ws.name}
              className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-200 group"
            >
              <Folder className="h-4 w-4 text-yellow-500 flex-shrink-0" />
              <span className="flex-1 text-left truncate">{ws.name}</span>
              <span className="text-[10px] text-muted-foreground flex-shrink-0">{ws.files}</span>
            </button>
          ))}
          <button className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-200">
            <FolderOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span>打开工作空间</span>
          </button>

        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-3 border-t space-y-3">
        {/* Theme + Settings row */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onOpenSettings}>
            <Settings className="h-4 w-4" />
          </Button>
        </div>

        {/* User info row */}
        <SidebarUserFooter />

        {/* Version + Update */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
          <span>EcoMind OS v1.0.0</span>
          <button className="flex items-center gap-1 text-primary hover:underline">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            检查更新
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── SidebarNavItem — direct navigation (no dropdown) ───

interface SidebarNavItemProps {
  icon: React.ReactNode
  label: string
  isActive: boolean
  onClick: () => void
}

function SidebarNavItem({ icon, label, isActive, onClick }: SidebarNavItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm transition-all duration-200",
        isActive
          ? "bg-primary/10 text-primary font-medium"
          : "text-muted-foreground hover:text-foreground hover:bg-accent"
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

// ─── KnowledgeSection — keep expandable with inline KnowledgeList ───

interface KnowledgeSectionProps {
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
  onFileClick?: (file: KnowledgeFile) => void
}

function KnowledgeSection({ expanded, onExpandedChange, onFileClick }: KnowledgeSectionProps) {
  return (
    <div className="mb-1">
      <button
        onClick={() => onExpandedChange(!expanded)}
        className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-200"
      >
        {expanded ? <ChevronDown className="h-4 w-4 flex-shrink-0" /> : <ChevronRight className="h-4 w-4 flex-shrink-0" />}
        <BookOpen className="h-4 w-4" />
        <span>资料库</span>
      </button>
      {expanded && (
        <div className="ml-4 mt-1">
          <KnowledgeList onFileClick={onFileClick} />
        </div>
      )}
    </div>
  )
}

// ─── SidebarUserFooter — 当前登录用户信息，点击头像弹出菜单 ───

function SidebarUserFooter() {
  const { user, logout, isAuthenticated } = useAuthStore()
  const navigate = useNavigate()
  const [userPopoverOpen, setUserPopoverOpen] = useState(false)

  if (!user || !isAuthenticated) {
    return (
      <button
        className="flex items-center gap-3 px-1 py-1.5 w-full rounded-lg hover:bg-accent transition-colors cursor-pointer"
        onClick={() => navigate("/login")}
      >
        <Avatar className="h-8 w-8">
          <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">?</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-xs font-medium text-muted-foreground truncate">未登录</p>
          <p className="text-[10px] text-muted-foreground/60">点击登录</p>
        </div>
      </button>
    )
  }

  const roleConfig = ROLE_CONFIGS[user.role]
  const initials = user.name.slice(0, 2).replace(/[省市县区局处]/g, "")

  return (
    <Popover open={userPopoverOpen} onOpenChange={setUserPopoverOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-3 px-1 py-1.5 w-full rounded-lg hover:bg-accent transition-colors cursor-pointer">
          <Avatar className="h-8 w-8 ring-2 ring-primary/20">
            <AvatarFallback
              className="text-[10px] text-white font-medium"
              style={{ background: "linear-gradient(135deg, #52c41a, #1677ff)" }}
            >
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-xs font-medium truncate">{user.name}</p>
            <p className="text-[10px] text-muted-foreground truncate">
              {roleConfig.icon} {roleConfig.label}
              {user.role === "city" && user.city ? ` · ${user.city}` : ""}
              {user.role === "chief" && user.department ? ` · ${user.department.slice(0, 6)}` : ""}
            </p>
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" sideOffset={8} className="w-64 p-2">
        {/* User info header */}
        <div className="flex items-center gap-3 px-3 py-2.5">
          <Avatar className="h-10 w-10 ring-2 ring-primary/20">
            <AvatarFallback
              className="text-xs text-white font-medium"
              style={{ background: "linear-gradient(135deg, #52c41a, #1677ff)" }}
            >
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{user.name}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Shield className="h-3 w-3 text-primary" />
              <span className="text-[11px] text-muted-foreground">
                {roleConfig.icon} {roleConfig.label}
              </span>
            </div>
            {user.role === "city" && user.city && (
              <p className="text-[11px] text-muted-foreground mt-0.5">📍 {user.city}</p>
            )}
            {user.role === "chief" && user.department && (
              <p className="text-[11px] text-muted-foreground mt-0.5">🏢 {user.department}</p>
            )}
          </div>
        </div>

        <Separator className="my-1.5" />

        {/* Logout */}
        <button
          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          onClick={() => {
            setUserPopoverOpen(false)
            logout()
            navigate("/login", { replace: true })
          }}
        >
          <LogOut className="h-4 w-4" />
          退出登录
        </button>
      </PopoverContent>
    </Popover>
  )
}
