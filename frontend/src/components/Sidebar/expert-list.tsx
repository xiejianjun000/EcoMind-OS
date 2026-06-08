"use client"

import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ChevronDown, ChevronRight } from "lucide-react"
import { useState } from "react"
import { useExpertStore } from "@/store/expertStore"
import { useChatStore } from "@/store/chatStore"
import { EXPERT_GROUPS } from "@/types/team"

export function ExpertList() {
  const { experts, activeExpertId, setActiveExpert, updateExpertStatus } = useExpertStore()
  const [groupExpanded, setGroupExpanded] = useState<Record<string, boolean>>({
    core: true,
    approval: false,
    monitoring: false,
    enforcement: false,
    public: false,
  })

  const toggleGroup = (group: string) => {
    setGroupExpanded((prev) => ({ ...prev, [group]: !prev[group] }))
  }

  return (
    <div className="space-y-1">
      {Object.entries(EXPERT_GROUPS).map(([groupKey, group]) => {
        const groupExperts = experts.filter((e) =>
          group.expertIds.includes(e.id)
        )
        if (groupExperts.length === 0) return null

        const isExpanded = groupExpanded[groupKey] ?? false

        return (
          <div key={groupKey} className="mb-1">
            {/* Group Header */}
            <button
              onClick={() => toggleGroup(groupKey)}
              className="flex items-center gap-1.5 w-full px-1 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              <span>{group.label}</span>
              <span className="text-[10px] text-muted-foreground/60">
                {groupExperts.length}
              </span>
            </button>

            {/* Group Experts */}
            {isExpanded && (
              <div className="ml-1 space-y-0.5">
                {groupExperts.map((expert) => (
                  <ExpertItem
                    key={expert.id}
                    expert={expert}
                    isActive={activeExpertId === expert.id}
                    onSelect={() => {
                      // 双向绑定：设置 activeExpert 影响整个应用
                      setActiveExpert(expert.id)
                      // 如果当前会话存在，更新会话的 expertId
                      const { currentSessionId, sessions } = useChatStore.getState()
                      if (currentSessionId) {
                        // 侧边栏选择专家自动切换输入框专家
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}

      {/* Unclassified experts */}
      {experts
        .filter(
          (e) =>
            !Object.values(EXPERT_GROUPS)
              .flatMap((g) => g.expertIds)
              .includes(e.id)
        )
        .map((expert) => (
          <ExpertItem
            key={expert.id}
            expert={{
              id: expert.id,
              name: expert.displayName,
              description: expert.description,
              status: expert.status,
              color: expert.color,
              safetyLevel: expert.safetyLevel,
              capabilities: expert.capabilities,
            }}
            isActive={activeExpertId === expert.id}
            onSelect={() => setActiveExpert(expert.id)}
          />
        ))}
    </div>
  )
}

interface ExpertItemProps {
  expert: {
    id: string
    name: string
    description?: string
    status: "online" | "busy" | "offline" | "error"
    color?: string
    safetyLevel?: string
    capabilities?: string[]
  }
  isActive: boolean
  onSelect: () => void
  className?: string
}

function ExpertItem({ expert, isActive, onSelect, className }: ExpertItemProps) {
  const statusColors = {
    online: "bg-green-500",
    busy: "bg-yellow-500",
    offline: "bg-gray-400",
    error: "bg-red-500",
  }

  return (
    <button
      onClick={onSelect}
      className={cn(
        "flex items-center gap-2.5 w-full p-1.5 rounded-md transition-colors text-left",
        isActive
          ? "bg-accent text-accent-foreground"
          : "hover:bg-accent/50",
        className
      )}
    >
      <div className="relative">
        <Avatar className="h-7 w-7">
          <AvatarFallback
            className="text-[10px] font-medium"
            style={{
              backgroundColor: expert.color ? `${expert.color}20` : undefined,
              color: expert.color || undefined,
            }}
          >
            {expert.name.slice(0, 2)}
          </AvatarFallback>
        </Avatar>
        <div
          className={cn(
            "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background",
            statusColors[expert.status]
          )}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className={cn("text-xs font-medium truncate", isActive && "font-semibold")}>
            {expert.name}
          </span>
          {expert.safetyLevel && (
            <Badge
              variant="outline"
              className="text-[9px] h-3.5 px-1 py-0 font-mono"
            >
              {expert.safetyLevel}
            </Badge>
          )}
        </div>
      </div>
    </button>
  )
}
