"use client"

import { useNavigate } from "react-router-dom"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { useExpertStore } from "@/store/expertStore"
import { useChatStore } from "@/store/chatStore"

export function ExpertList() {
  const navigate = useNavigate()
  const { experts, activeExpertId, setActiveExpert } = useExpertStore()
  const { createSession } = useChatStore()

  // Exclude EcoMind from inline list (shown as main card in sidebar nav)
  const visibleExperts = experts.filter(e => e.id !== 'ecomind')

  const handleSummon = (expertId: string, displayName: string) => {
    setActiveExpert(expertId)
    const sessionId = createSession({
      title: `与 ${displayName} 的对话`,
      expertId,
    })
    navigate(`/chat/${sessionId}`)
  }

  return (
    <div className="space-y-1">
      {visibleExperts.slice(0, 8).map((expert) => (
        <ExpertItem
          key={expert.id}
          expert={{
            id: expert.id,
            name: expert.displayName,
            description: expert.description,
            status: (expert.status === 'online' || expert.status === 'busy') ? expert.status : 'offline',
          }}
          isActive={activeExpertId === expert.id}
          onClick={() => handleSummon(expert.id, expert.displayName)}
        />
      ))}
    </div>
  )
}

interface ExpertItemProps {
  expert: {
    id: string
    name: string
    avatar?: string
    description?: string
    status: "online" | "busy" | "offline"
  }
  isActive?: boolean
  onClick?: () => void
  className?: string
}

function ExpertItem({ expert, isActive, onClick, className }: ExpertItemProps) {
  const statusColors = {
    online: "bg-green-500",
    busy: "bg-yellow-500",
    offline: "bg-gray-400",
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 w-full p-2 rounded-md hover:bg-accent transition-colors text-left",
        isActive && "bg-accent",
        className
      )}
    >
      <div className="relative">
        <Avatar className="h-8 w-8">
          <AvatarImage src={expert.avatar} alt={expert.name} />
          <AvatarFallback className="text-xs">
            {expert.name.slice(0, 2)}
          </AvatarFallback>
        </Avatar>
        <div
          className={cn(
            "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background",
            statusColors[expert.status]
          )}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{expert.name}</div>
      </div>
    </button>
  )
}
