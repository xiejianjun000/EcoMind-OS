/**
 * AgentProfilePanel — 智能体画像展示
 * 显示 Agent 名称、简介、能力、技能、安全等级
 */
"use client"

import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  Bot, Shield, Sparkles, Zap, Wrench,
  Activity, Cpu,
} from "lucide-react"
import { useExpertStore } from "@/store/expertStore"
import { cn } from "@/lib/utils"

interface AgentProfilePanelProps {
  agentId: string
  className?: string
}

export function AgentProfilePanel({ agentId, className }: AgentProfilePanelProps) {
  const { experts, skills } = useExpertStore()
  const agent = experts.find(e => e.id === agentId)
  const agentSkills = skills.filter(s => s.expertIds.includes(agentId))

  if (!agent) {
    return (
      <div className={cn("flex items-center justify-center h-48 text-muted-foreground text-sm", className)}>
        未选择专家
      </div>
    )
  }

  const safetyColor = agent.safetyLevel === 'L3' ? 'destructive' : agent.safetyLevel === 'L2' ? 'default' : 'secondary'
  const modelTierLabel = agent.modelTier === 'opus' ? '高端 (Opus)' : agent.modelTier === 'sonnet' ? '标准 (Sonnet)' : '轻量 (Haiku)'
  const modelTierColor = agent.modelTier === 'opus' ? 'text-purple-500' : agent.modelTier === 'sonnet' ? 'text-blue-500' : 'text-gray-500'

  return (
    <ScrollArea className={cn("h-full", className)}>
      <div className="p-3 space-y-3">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-lg shrink-0"
            style={{ background: agent.color || '#52c41a' }}
          >
            <Bot className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate">{agent.displayName}</h3>
            <p className="text-[10px] text-muted-foreground font-mono">{agent.name}</p>
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-muted-foreground leading-relaxed">{agent.description}</p>

        {/* Meta badges */}
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline" className="text-[10px] gap-1">
            <Shield className="h-2.5 w-2.5" />
            {agent.safetyLevel}
          </Badge>
          <Badge variant="outline" className={cn("text-[10px] gap-1", modelTierColor)}>
            <Cpu className="h-2.5 w-2.5" />
            {modelTierLabel}
          </Badge>
          <Badge
            variant={agent.status === 'online' ? 'default' : 'secondary'}
            className="text-[10px] gap-1"
          >
            <Activity className="h-2.5 w-2.5" />
            {agent.status === 'online' ? '在线' : agent.status === 'busy' ? '忙碌' : '离线'}
          </Badge>
        </div>

        {agent.whenToUse && (
          <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-2.5">
            <p className="text-[10px] font-medium text-blue-700 dark:text-blue-300 mb-1">💡 何时使用</p>
            <p className="text-[11px] text-blue-600 dark:text-blue-400 leading-relaxed">{agent.whenToUse}</p>
          </div>
        )}

        <Separator />

        {/* Capabilities */}
        <div>
          <h4 className="text-[11px] font-semibold mb-2 flex items-center gap-1">
            <Zap className="h-3 w-3 text-yellow-500" />
            核心能力
          </h4>
          <div className="flex flex-wrap gap-1">
            {agent.capabilities.map((cap, i) => (
              <Badge key={i} variant="secondary" className="text-[10px]">
                {cap}
              </Badge>
            ))}
          </div>
        </div>

        {/* Skills */}
        {agentSkills.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="text-[11px] font-semibold mb-2 flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-purple-500" />
                关联技能 ({agentSkills.length})
              </h4>
              <div className="space-y-1.5">
                {agentSkills.map((skill) => (
                  <div key={skill.id} className="flex items-start gap-2 p-2 rounded-lg border hover:bg-accent transition-colors">
                    <span className="text-lg shrink-0 mt-0.5">{skill.icon === 'GlobalOutlined' ? '🌍' :
                      skill.icon === 'ScanOutlined' ? '📡' :
                      skill.icon === 'HeatMapOutlined' ? '🔥' :
                      skill.icon === 'CheckCircleOutlined' ? '✅' :
                      skill.icon === 'FileTextOutlined' ? '📄' :
                      skill.icon === 'EyeOutlined' ? '👁' :
                      skill.icon === 'BarChartOutlined' ? '📊' :
                      skill.icon === 'NodeIndexOutlined' ? '🔗' : '🔧'
                    }</span>
                    <div className="min-w-0">
                      <p className="text-xs font-medium">{skill.name}</p>
                      <p className="text-[10px] text-muted-foreground">{skill.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Category */}
        <Separator />
        <div className="text-[10px] text-muted-foreground flex items-center gap-4">
          <span>类别: {agent.category}</span>
          <span>内置: {agent.isBuiltin ? '是' : '否'}</span>
        </div>
      </div>
    </ScrollArea>
  )
}
