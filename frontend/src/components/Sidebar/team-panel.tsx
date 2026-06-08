"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Users,
  Plus,
  ChevronRight,
  CheckCircle,
  Circle,
  Loader2,
  Ban,
  LayoutTemplate,
} from "lucide-react"
import { useTeamStore } from "@/store/teamStore"
import { useExpertStore } from "@/store/expertStore"
import { PHASE_LABELS } from "@/types/team"
import type { Team, TeamTask, PhaseType, TaskStatusType } from "@/types/team"

export function TeamPanel() {
  const { teams, activeTeamId, setActiveTeam, createTeam, templates, advancePhase } = useTeamStore()
  const { experts } = useExpertStore()

  const activeTeam = teams.find((t) => t.teamId === activeTeamId)

  return (
    <div className="space-y-2">
      {/* Active Team Progress */}
      {activeTeam && <TeamProgressCard team={activeTeam} />}

      {/* Team List */}
      {teams.length > 0 ? (
        <div className="space-y-1">
          {teams.map((team) => (
            <TeamItem
              key={team.teamId}
              team={team}
              isActive={team.teamId === activeTeamId}
              onSelect={() => setActiveTeam(team.teamId)}
            />
          ))}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground text-center py-3">
          暂无团队，使用下方模板快速创建
        </div>
      )}

      {/* Quick Create from Templates */}
      <div className="border-t pt-2 mt-2 space-y-1">
        <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1">
          快速建队
        </div>
        {templates.map((tmpl) => (
          <button
            key={tmpl.templateId}
            className="flex items-center gap-2 w-full px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
            onClick={async () => {
              await createTeam({
                name: tmpl.name,
                description: tmpl.description,
                templateId: tmpl.templateId,
                leadExpertId: tmpl.leadExpertId,
                memberExpertIds: tmpl.memberExpertIds,
              })
            }}
          >
            <LayoutTemplate className="h-3.5 w-3.5" />
            <span className="flex-1 text-left">{tmpl.name}</span>
            <Badge variant="outline" className="text-[9px] h-3.5">
              {tmpl.memberExpertIds.length + 1}人
            </Badge>
          </button>
        ))}
      </div>
    </div>
  )
}

// ============================================================
// Team Progress Card (shown when a team is active)
// ============================================================

function TeamProgressCard({ team }: { team: Team }) {
  const { advancePhase, isAdvancingPhase } = useTeamStore()

  const phases: PhaseType[] = ['requirement', 'research', 'design', 'development', 'review']
  const currentPhaseIdx = team.currentPhase ? phases.indexOf(team.currentPhase) : -1
  const completedTasks = team.tasks.filter((t) => t.status === 'completed').length
  const totalTasks = team.tasks.filter((t) => t.status !== 'deleted').length
  const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  return (
    <div className="p-2 rounded-lg border bg-accent/30 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold truncate">{team.name}</span>
        <Badge variant="secondary" className="text-[9px]">
          {team.status}
        </Badge>
      </div>

      {/* Phase Progress */}
      <div className="flex items-center gap-0.5">
        {phases.map((phase, idx) => {
          const isCompleted = idx < currentPhaseIdx
          const isCurrent = idx === currentPhaseIdx
          const isFuture = idx > currentPhaseIdx

          return (
            <div key={phase} className="flex items-center">
              {isCompleted ? (
                <CheckCircle className="h-3.5 w-3.5 text-green-500" />
              ) : isCurrent ? (
                <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
              ) : (
                <Circle className="h-3.5 w-3.5 text-muted-foreground/40" />
              )}
              {idx < phases.length - 1 && (
                <div
                  className={cn(
                    "h-0.5 w-3",
                    isCompleted ? "bg-green-500" : "bg-muted"
                  )}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Task Progress */}
      <div className="flex items-center gap-2">
        <Progress value={progress} className="h-1.5 flex-1" />
        <span className="text-[10px] text-muted-foreground">
          {completedTasks}/{totalTasks}
        </span>
      </div>

      {/* Phase Labels */}
      {team.currentPhase && (
        <div className="text-[10px] text-muted-foreground">
          当前: {PHASE_LABELS[team.currentPhase]?.label || team.currentPhase}
        </div>
      )}

      {/* Advance Phase Button */}
      {team.currentPhase && currentPhaseIdx < phases.length - 1 && (
        <Button
          size="sm"
          variant="outline"
          className="w-full h-6 text-[10px] gap-1"
          onClick={() => advancePhase(team.teamId, phases[currentPhaseIdx + 1])}
          disabled={isAdvancingPhase}
        >
          <ChevronRight className="h-3 w-3" />
          推进至 {PHASE_LABELS[phases[currentPhaseIdx + 1]]?.label}
        </Button>
      )}
    </div>
  )
}

// ============================================================
// Team Item
// ============================================================

function TeamItem({
  team,
  isActive,
  onSelect,
}: {
  team: Team
  isActive: boolean
  onSelect: () => void
}) {
  const { experts } = useExpertStore()
  const completedTasks = team.tasks.filter((t) => t.status === 'completed').length
  const totalTasks = team.tasks.filter((t) => t.status !== 'deleted').length

  return (
    <button
      onClick={onSelect}
      className={cn(
        "flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-md transition-colors text-left",
        isActive ? "bg-accent" : "hover:bg-accent/50"
      )}
    >
      <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate">{team.name}</div>
        <div className="text-[10px] text-muted-foreground">
          {team.members.length}人 · {completedTasks}/{totalTasks} 任务
        </div>
      </div>
      <Badge variant="outline" className="text-[9px] h-3.5">
        {team.status === 'active' ? '运行中' : team.status === 'completed' ? '已完成' : team.status}
      </Badge>
    </button>
  )
}
