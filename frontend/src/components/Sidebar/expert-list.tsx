"use client"

import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"

interface Expert {
  id: string
  name: string
  avatar?: string
  description?: string
  status: "online" | "busy" | "offline"
}

const experts: Expert[] = [
  { id: "gaia", name: "GAIA 生态主控", status: "online", description: "通用环境咨询入口" },
  { id: "monitor", name: "环境监测专家", status: "online", description: "环境数据监测分析" },
  { id: "law", name: "执法监察专家", status: "online", description: "执法监察合规" },
  { id: "eia", name: "环评审批专家", status: "busy", description: "环境影响评价" },
  { id: "bio", name: "生物多样性专家", status: "offline", description: "生物多样性保护" },
  { id: "permit", name: "排污许可专家", status: "online", description: "排污许可管理" },
  { id: "restore", name: "生态修复专家", status: "online", description: "生态系统修复" },
  { id: "emergency", name: "应急管理专家", status: "offline", description: "环境应急响应" },
  { id: "supervise", name: "生态督察专家", status: "online", description: "生态环保督察" },
  { id: "carbon", name: "碳排放专家", status: "online", description: "碳排放核算管理" },
  { id: "public", name: "公众服务专家", status: "online", description: "公众环保服务" },
  { id: "water", name: "水资源专家", status: "offline", description: "水资源管理" },
]

export function ExpertList() {
  return (
    <div className="space-y-1">
      {experts.map((expert) => (
        <ExpertItem key={expert.id} expert={expert} />
      ))}
    </div>
  )
}

interface ExpertItemProps {
  expert: Expert
  className?: string
}

function ExpertItem({ expert, className }: ExpertItemProps) {
  const statusColors = {
    online: "bg-green-500",
    busy: "bg-yellow-500",
    offline: "bg-gray-400",
  }

  return (
    <button
      className={cn(
        "flex items-center gap-3 w-full p-2 rounded-md hover:bg-accent transition-colors text-left",
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
