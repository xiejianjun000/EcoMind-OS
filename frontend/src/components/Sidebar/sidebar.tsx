"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
  LayoutTemplate,
  FolderOpen,
  Circle,
} from "lucide-react"
import { useTheme } from "@/providers/ThemeProvider"
import { useExpertStore } from "@/store/expertStore"
import { useTeamStore } from "@/store/teamStore"
import { EXPERT_GROUPS } from "@/types/team"
import { ExpertList } from "./expert-list"
import { TeamPanel } from "./team-panel"
import { SessionList } from "./session-list"

interface SidebarProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
}

export function Sidebar({ open, className }: SidebarProps) {
  const { theme, setTheme } = useTheme()
  const { experts, skills, connectors, knowledgeBases, sidebarExpandedSections, toggleSidebarSection } = useExpertStore()
  const { templates, activeTeamId, setActiveTeam } = useTeamStore()

  const [expertsExpanded, setExpertsExpanded] = useState(true)
  const [skillsExpanded, setSkillsExpanded] = useState(false)
  const [connectorsExpanded, setConnectorsExpanded] = useState(false)
  const [knowledgeExpanded, setKnowledgeExpanded] = useState(false)
  const [teamExpanded, setTeamExpanded] = useState(true)
  const [templatesExpanded, setTemplatesExpanded] = useState(false)

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
          <Button variant="ghost" size="icon">
            <Users className="h-5 w-5" />
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
          <Badge variant="secondary" className="ml-auto text-[10px]">v1.0</Badge>
        </div>
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索专家、技能、团队..."
            className="pl-9 bg-background"
          />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="p-3 space-y-2">
        <Button className="w-full gap-2" size="sm">
          <Plus className="h-4 w-4" />
          新建会话
        </Button>
        {/* Quick Templates */}
        <div className="flex gap-1.5">
          {templates.slice(0, 3).map((tmpl) => (
            <Button
              key={tmpl.templateId}
              variant="outline"
              size="sm"
              className="flex-1 gap-1 text-xs h-7"
              onClick={() => {
                useTeamStore.getState().createTeam({
                  name: tmpl.name,
                  templateId: tmpl.templateId,
                  leadExpertId: tmpl.leadExpertId,
                  memberExpertIds: tmpl.memberExpertIds,
                })
                setTeamExpanded(true)
              }}
            >
              <LayoutTemplate className="h-3 w-3" />
              {tmpl.name.slice(0, 2)}
            </Button>
          ))}
        </div>
      </div>

      <Separator />

      {/* Navigation */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {/* Experts - Grouped */}
          <SidebarSection
            icon={<Sparkles className="h-4 w-4" />}
            title="专家"
            expanded={expertsExpanded}
            onExpandedChange={setExpertsExpanded}
            badge={`${experts.length}`}
          >
            <ExpertList />
          </SidebarSection>

          {/* Team */}
          <SidebarSection
            icon={<Users className="h-4 w-4" />}
            title="团队"
            expanded={teamExpanded}
            onExpandedChange={setTeamExpanded}
            badge={activeTeamId ? "1" : undefined}
          >
            <TeamPanel />
          </SidebarSection>

          {/* Skills */}
          <SidebarSection
            icon={<Wrench className="h-4 w-4" />}
            title="技能"
            expanded={skillsExpanded}
            onExpandedChange={setSkillsExpanded}
            badge={`${skills.length}`}
          >
            {skills.map((skill) => (
              <SkillItem
                key={skill.id}
                icon={<Sparkles className="h-4 w-4" />}
                label={skill.name}
                badge={`${skill.expertIds.length}`}
              />
            ))}
          </SidebarSection>

          {/* Connectors */}
          <SidebarSection
            icon={<Plug className="h-4 w-4" />}
            title="连接器"
            expanded={connectorsExpanded}
            onExpandedChange={setConnectorsExpanded}
            badge={`${connectors.filter(c => c.status === 'connected').length}/${connectors.length}`}
          >
            {connectors.map((conn) => (
              <SkillItem
                key={conn.id}
                icon={<Plug className="h-4 w-4" />}
                label={conn.name}
                badge={conn.status === 'connected' ? '●' : '○'}
                badgeColor={conn.status === 'connected' ? 'text-green-500' : 'text-muted-foreground'}
              />
            ))}
          </SidebarSection>

          {/* Knowledge Base */}
          <SidebarSection
            icon={<BookOpen className="h-4 w-4" />}
            title="资料库"
            expanded={knowledgeExpanded}
            onExpandedChange={setKnowledgeExpanded}
            badge={`${knowledgeBases.length}`}
          >
            {knowledgeBases.map((kb) => (
              <SkillItem
                key={kb.id}
                icon={<BookOpen className="h-4 w-4" />}
                label={kb.name}
                badge={`${kb.itemCount}`}
              />
            ))}
          </SidebarSection>

          <Separator className="my-4" />

          {/* Workspaces / Sessions */}
          <div className="space-y-2">
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <FolderOpen className="h-3 w-3" />
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
      </div>
    </div>
  )
}

// ============================================================
// Sub-components
// ============================================================

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
  badge?: string
  badgeColor?: string
}

function SkillItem({ icon, label, badge, badgeColor }: SkillItemProps) {
  return (
    <button className="flex items-center gap-2 w-full px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors">
      {icon}
      <span className="flex-1 text-left truncate">{label}</span>
      {badge && (
        <span className={cn("text-xs", badgeColor || "text-muted-foreground")}>{badge}</span>
      )}
    </button>
  )
}
