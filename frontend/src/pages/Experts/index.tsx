/**
 * 专家集市 — 12 位生态环境领域专家全览
 */
"use client"

import { useNavigate } from "react-router-dom"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  GlobalOutlined, LineChartOutlined, SafetyCertificateOutlined,
  FileTextOutlined, BugOutlined, CloudOutlined, AlertOutlined,
  ReloadOutlined, AuditOutlined, TeamOutlined, DropboxOutlined,
  IdcardOutlined,
} from "@ant-design/icons"
import { useExpertStore } from "@/store/expertStore"
import { useChatStore } from "@/store/chatStore"

const EXPERT_ICONS: Record<string, React.ReactNode> = {
  GlobalOutlined: <GlobalOutlined />,
  LineChartOutlined: <LineChartOutlined />,
  SafetyCertificateOutlined: <SafetyCertificateOutlined />,
  FileTextOutlined: <FileTextOutlined />,
  BugOutlined: <BugOutlined />,
  CloudOutlined: <CloudOutlined />,
  AlertOutlined: <AlertOutlined />,
  ReloadOutlined: <ReloadOutlined />,
  AuditOutlined: <AuditOutlined />,
  TeamOutlined: <TeamOutlined />,
  DropboxOutlined: <DropboxOutlined />,
  IdcardOutlined: <IdcardOutlined />,
}

const SAFETY_LABELS: Record<string, { label: string; className: string }> = {
  L1: { label: "L1 公开", className: "bg-domain-ecology/10 text-domain-ecology border-domain-ecology/30" },
  L2: { label: "L2 公务", className: "bg-domain-water/10 text-domain-water border-domain-water/30" },
  L3: { label: "L3 执法", className: "bg-alert-critical/10 text-alert-critical border-alert-critical/30" },
}

export default function ExpertsPage() {
  const navigate = useNavigate()
  const { experts } = useExpertStore()
  const { createSession } = useChatStore()

  const handleStartChat = (expertId: string, displayName: string) => {
    const sessionId = createSession({
      title: `与 ${displayName} 的对话`,
      expertId,
    })
    navigate(`/chat/${sessionId}`)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-5 border-b bg-background">
        <h1 className="text-[20px] font-semibold">专家集市</h1>
        <p className="text-xs text-muted-foreground mt-1">
          12 位生态环境领域专家，覆盖监测、执法、环评、碳排、应急等全业务线
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {experts.map((expert) => (
            <div
              key={expert.id}
              className="bg-card rounded-xl border hover:shadow-md transition-shadow cursor-pointer group"
              onClick={() => handleStartChat(expert.id, expert.displayName)}
            >
              <div className="p-5">
                {/* Header row */}
                <div className="flex items-start gap-4 mb-4">
                  <Avatar className="h-12 w-12 rounded-xl flex-shrink-0"
                    style={{ backgroundColor: expert.color + "18" }}>
                    <AvatarFallback style={{ color: expert.color, fontSize: 18 }}>
                      {EXPERT_ICONS[expert.icon] || expert.displayName.slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold truncate">{expert.displayName}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{expert.description}</p>
                  </div>
                  {/* Status dot */}
                  <div className={cn(
                    "w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1",
                    expert.status === "online" ? "bg-domain-ecology" :
                    expert.status === "busy" ? "bg-alert-moderate" : "bg-muted-foreground/40"
                  )} />
                </div>

                {/* Capabilities */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {expert.capabilities.slice(0, 4).map((cap) => (
                    <Badge key={cap} variant="secondary" className="text-xs font-normal">{cap}</Badge>
                  ))}
                </div>

                {/* Footer meta */}
                <div className="flex items-center justify-between">
                  <Badge variant="outline"
                    className={cn("text-xs", SAFETY_LABELS[expert.safetyLevel]?.className)}>
                    {SAFETY_LABELS[expert.safetyLevel]?.label || expert.safetyLevel}
                  </Badge>
                  <span className="text-xs text-primary group-hover:underline">
                    开始对话 →
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
