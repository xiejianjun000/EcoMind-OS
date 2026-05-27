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
  Zap,
  Users,
  MessageSquare,
  LayoutGrid,
} from "lucide-react"
import { useTheme } from "@/providers/ThemeProvider"
import { useExpertStore } from "@/store/expertStore"
import { useChatStore } from "@/store/chatStore"
import { ExpertList } from "./expert-list"
import { SessionList } from "./session-list"

interface SidebarProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
}

export function Sidebar({ open, className }: SidebarProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { theme, setTheme } = useTheme()
  const { experts, activeExpertId, setActiveExpert } = useExpertStore()
  const { createSession } = useChatStore()
  const [expertsExpanded, setExpertsExpanded] = useState(false)
  const [skillsExpanded, setSkillsExpanded] = useState(false)
  const [connectorsExpanded, setConnectorsExpanded] = useState(false)
  const [knowledgeExpanded, setKnowledgeExpanded] = useState(false)
  const [automationExpanded, setAutomationExpanded] = useState(false)

  const gaiaExpert = experts.find(e => e.id === 'gaia')
  const isExpertsPage = location.pathname === '/experts'

  const handleNewSession = () => {
    const expert = activeExpertId || 'gaia'
    const sessionId = createSession({ title: '新会话', expertId: expert })
    navigate(`/chat/${sessionId}`)
  }

  const handleGaiaClick = () => {
    setActiveExpert('gaia')
    const sessionId = createSession({ title: 'GAIA 生态主控', expertId: 'gaia' })
    navigate(`/chat/${sessionId}`)
  }

  const handleExpertsClick = () => {
    navigate('/experts')
  }

  if (!open) {
    return (
      <div className={cn("h-full border-r bg-sidebar flex flex-col", className)}>
        <div className="p-3 flex justify-center">
          <Bot className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1 flex flex-col items-center py-4 space-y-4">
          <Button variant="ghost" size="icon" className="rounded-full">
            <Plus className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon">
            <Bot className="h-5 w-5" />
          </Button>
        </div>
      </div>
    )
  }

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
          <Input
            placeholder="搜索任务..."
            className="pl-9 bg-background"
          />
        </div>
      </div>

      {/* New Chat Button */}
      <div className="p-4 pb-2">
        <Button className="w-full gap-2" size="sm" onClick={handleNewSession}>
          <Plus className="h-4 w-4" />
          新建会话
        </Button>
      </div>

      {/* ── GAIA 生态主控 — 主智能体入口 ── */}
      {gaiaExpert && (
        <div className="px-4 pb-2">
          <button
            onClick={handleGaiaClick}
            className={cn(
              "flex items-center gap-3 w-full p-2.5 rounded-lg transition-all duration-200 text-left",
              activeExpertId === 'gaia'
                ? "bg-primary/10 border border-primary/30 shadow-sm"
                : "hover:bg-accent border border-transparent"
            )}
          >
            <div className="relative flex-shrink-0">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg font-bold shadow-sm"
                style={{ background: "linear-gradient(135deg, #52c41a, #237804)" }}
              >
                GA
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-green-500 border-2 border-background" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold">GAIA 生态主控</div>
              <div className="text-xs text-muted-foreground">通用生态环境AI助手</div>
            </div>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">主控</Badge>
          </button>
        </div>
      )}

      <Separator />

      {/* Navigation */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {/* Experts — click title to go to full page */}
          <MarketplaceSection
            icon={<Sparkles className="h-4 w-4 text-muted-foreground" />}
            title="专家"
            count="12"
            isActive={isExpertsPage}
            onTitleClick={handleExpertsClick}
            expanded={expertsExpanded}
            onExpandedChange={setExpertsExpanded}
          >
            <ExpertList />
          </MarketplaceSection>

          {/* Skills */}
          <MarketplaceSection
            icon={<Wrench className="h-4 w-4" />}
            title="技能"
            count="8"
            isActive={location.pathname === '/skills'}
            onTitleClick={() => navigate('/skills')}
            expanded={skillsExpanded}
            onExpandedChange={setSkillsExpanded}
          >
            <SkillItem icon={<Sparkles className="h-4 w-4" />} label="3D地图分析" />
            <SkillItem icon={<BookOpen className="h-4 w-4" />} label="报告生成" />
            <SkillItem icon={<Zap className="h-4 w-4" />} label="合规校验" />
            <SkillItem icon={<Users className="h-4 w-4" />} label="遥感解译" />
          </MarketplaceSection>

          {/* Connectors */}
          <MarketplaceSection
            icon={<Plug className="h-4 w-4" />}
            title="连接器"
            count="5"
            isActive={location.pathname === '/connectors'}
            onTitleClick={() => navigate('/connectors')}
            expanded={connectorsExpanded}
            onExpandedChange={setConnectorsExpanded}
          >
            <SkillItem icon={<Plug className="h-4 w-4" />} label="监测站点" />
            <SkillItem icon={<Plug className="h-4 w-4" />} label="IoT传感器" />
            <SkillItem icon={<Plug className="h-4 w-4" />} label="卫星遥感" />
          </MarketplaceSection>

          {/* Knowledge Base */}
          <MarketplaceSection
            icon={<BookOpen className="h-4 w-4" />}
            title="资料库"
            count="5"
            isActive={false}
            onTitleClick={() => {}}
            expanded={knowledgeExpanded}
            onExpandedChange={setKnowledgeExpanded}
          >
            <SkillItem icon={<BookOpen className="h-4 w-4" />} label="腾讯文档" />
            <SkillItem icon={<BookOpen className="h-4 w-4" />} label="ima知识库" />
            <SkillItem icon={<BookOpen className="h-4 w-4" />} label="乐享知识库" />
          </MarketplaceSection>

          {/* Automation */}
          <MarketplaceSection
            icon={<Zap className="h-4 w-4" />}
            title="自动化"
            count="9"
            isActive={location.pathname === '/automation'}
            onTitleClick={() => navigate('/automation')}
            expanded={automationExpanded}
            onExpandedChange={setAutomationExpanded}
          >
            <SkillItem icon={<Zap className="h-4 w-4" />} label="定时巡检" />
            <SkillItem icon={<Zap className="h-4 w-4" />} label="异常告警" />
            <SkillItem icon={<Zap className="h-4 w-4" />} label="自动报告" />
          </MarketplaceSection>

          <Separator className="my-4" />

          {/* Workspaces / Sessions */}
          <div className="space-y-2">
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              工作空间
            </div>
            <SessionList />
          </div>
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t">
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>
          <Button variant="ghost" size="icon">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
        {/* Team Members */}
        <div className="flex items-center gap-2 mt-4">
          <div className="flex -space-x-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-8 w-8 rounded-full bg-primary/20 border-2 border-background flex items-center justify-center text-xs font-medium"
              >
                {String.fromCharCode(64 + i)}
              </div>
            ))}
          </div>
          <span className="text-xs text-muted-foreground">团队成员</span>
        </div>
      </div>
    </div>
  )
}

interface MarketplaceSectionProps {
  icon: React.ReactNode
  title: string
  count: string
  isActive: boolean
  onTitleClick: () => void
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
  children: React.ReactNode
}

/** Section that expands/collapses inline + navigates to full page on title click */
function MarketplaceSection({
  icon,
  title,
  count,
  isActive,
  onTitleClick,
  expanded,
  onExpandedChange,
  children,
}: MarketplaceSectionProps) {
  return (
    <div className="mb-2">
      <div className="flex items-center gap-2 w-full px-2 py-1.5">
        <button
          onClick={() => onExpandedChange(!expanded)}
          className="flex-shrink-0"
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
        {icon}
        <button
          onClick={onTitleClick}
          className={cn(
            "flex-1 text-left text-sm font-medium hover:text-primary transition-colors",
            isActive && "text-primary"
          )}
        >
          {title}
        </button>
        <button
          onClick={onTitleClick}
          className="text-muted-foreground hover:text-primary transition-colors"
          title={`查看全部${title}`}
        >
          <LayoutGrid className="h-3.5 w-3.5" />
        </button>
        <span className="text-xs text-muted-foreground">{count}</span>
      </div>
      {expanded && <div className="ml-4 mt-1 space-y-1">{children}</div>}
    </div>
  )
}

interface SkillItemProps {
  icon: React.ReactNode
  label: string
}

function SkillItem({ icon, label }: SkillItemProps) {
  return (
    <button className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors">
      {icon}
      <span>{label}</span>
    </button>
  )
}
