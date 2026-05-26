"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
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
} from "lucide-react"
import { useTheme } from "@/providers/ThemeProvider"
import { ExpertList } from "./expert-list"
import { SessionList } from "./session-list"

interface SidebarProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
}

export function Sidebar({ open, className }: SidebarProps) {
  const { theme, setTheme } = useTheme()
  const [expertsExpanded, setExpertsExpanded] = useState(true)
  const [skillsExpanded, setSkillsExpanded] = useState(false)
  const [connectorsExpanded, setConnectorsExpanded] = useState(false)
  const [knowledgeExpanded, setKnowledgeExpanded] = useState(false)
  const [automationExpanded, setAutomationExpanded] = useState(false)

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
      <div className="p-4">
        <Button className="w-full gap-2" size="sm">
          <Plus className="h-4 w-4" />
          新建会话
        </Button>
      </div>

      <Separator />

      {/* Navigation */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {/* Experts */}
          <SidebarSection
            icon={<Sparkles className="h-4 w-4" />}
            title="专家"
            expanded={expertsExpanded}
            onExpandedChange={setExpertsExpanded}
            badge="12"
          >
            <ExpertList />
          </SidebarSection>

          {/* Skills */}
          <SidebarSection
            icon={<Wrench className="h-4 w-4" />}
            title="技能"
            expanded={skillsExpanded}
            onExpandedChange={setSkillsExpanded}
          >
            <SkillItem icon={<Sparkles className="h-4 w-4" />} label="3D地图分析" />
            <SkillItem icon={<BookOpen className="h-4 w-4" />} label="报告生成" />
            <SkillItem icon={<Zap className="h-4 w-4" />} label="合规校验" />
            <SkillItem icon={<Users className="h-4 w-4" />} label="遥感解译" />
          </SidebarSection>

          {/* Connectors */}
          <SidebarSection
            icon={<Plug className="h-4 w-4" />}
            title="连接器"
            expanded={connectorsExpanded}
            onExpandedChange={setConnectorsExpanded}
          >
            <SkillItem icon={<Plug className="h-4 w-4" />} label="监测站点" />
            <SkillItem icon={<Plug className="h-4 w-4" />} label="IoT传感器" />
            <SkillItem icon={<Plug className="h-4 w-4" />} label="卫星遥感" />
          </SidebarSection>

          {/* Knowledge Base */}
          <SidebarSection
            icon={<BookOpen className="h-4 w-4" />}
            title="资料库"
            expanded={knowledgeExpanded}
            onExpandedChange={setKnowledgeExpanded}
          >
            <SkillItem icon={<BookOpen className="h-4 w-4" />} label="腾讯文档" />
            <SkillItem icon={<BookOpen className="h-4 w-4" />} label="ima知识库" />
            <SkillItem icon={<BookOpen className="h-4 w-4" />} label="乐享知识库" />
          </SidebarSection>

          {/* Automation */}
          <SidebarSection
            icon={<Zap className="h-4 w-4" />}
            title="自动化"
            expanded={automationExpanded}
            onExpandedChange={setAutomationExpanded}
          >
            <SkillItem icon={<Zap className="h-4 w-4" />} label="定时巡检" />
            <SkillItem icon={<Zap className="h-4 w-4" />} label="异常告警" />
            <SkillItem icon={<Zap className="h-4 w-4" />} label="自动报告" />
          </SidebarSection>

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

interface SidebarSectionProps {
  icon: React.ReactNode
  title: string
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
  badge?: string
  children: React.ReactNode
}

function SidebarSection({
  icon,
  title,
  expanded,
  onExpandedChange,
  badge,
  children,
}: SidebarSectionProps) {
  return (
    <div className="mb-2">
      <button
        onClick={() => onExpandedChange(!expanded)}
        className="flex items-center gap-2 w-full px-2 py-1.5 text-sm font-medium hover:bg-accent rounded-md transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        {icon}
        <span className="flex-1 text-left">{title}</span>
        {badge && (
          <span className="text-xs text-muted-foreground">{badge}</span>
        )}
      </button>
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
