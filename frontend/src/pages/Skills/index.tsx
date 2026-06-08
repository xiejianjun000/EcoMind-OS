/**
 * 技能工坊 — 8 项 AI 技能全览
 */
"use client"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  GlobalOutlined, ScanOutlined, HeatMapOutlined, CheckCircleOutlined,
  FileTextOutlined, EyeOutlined, BarChartOutlined, NodeIndexOutlined,
  LineChartOutlined, SafetyCertificateOutlined, BugOutlined,
  CloudOutlined, AlertOutlined, ReloadOutlined,
  AuditOutlined, TeamOutlined, DropboxOutlined, IdcardOutlined,
} from "@ant-design/icons"
import { useExpertStore } from "@/store/expertStore"

const SKILL_ICONS: Record<string, React.ReactNode> = {
  GlobalOutlined: <GlobalOutlined />,
  ScanOutlined: <ScanOutlined />,
  HeatMapOutlined: <HeatMapOutlined />,
  CheckCircleOutlined: <CheckCircleOutlined />,
  FileTextOutlined: <FileTextOutlined />,
  EyeOutlined: <EyeOutlined />,
  BarChartOutlined: <BarChartOutlined />,
  NodeIndexOutlined: <NodeIndexOutlined />,
}

const EXPERT_ICONS_MAP: Record<string, React.ReactNode> = {
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

const SKILL_COLORS = [
  "bg-domain-water/10 text-domain-water border-domain-water/30",
  "bg-domain-ecology/10 text-domain-ecology border-domain-ecology/30",
  "bg-domain-soil/10 text-domain-soil border-domain-soil/30",
  "bg-domain-carbon/10 text-domain-carbon border-domain-carbon/30",
  "bg-domain-air/10 text-domain-air border-domain-air/30",
  "bg-domain-waste/10 text-domain-waste border-domain-waste/30",
  "bg-primary/10 text-primary border-primary/30",
  "bg-alert-moderate/10 text-alert-moderate border-alert-moderate/30",
]

export default function SkillsPage() {
  const { skills, experts } = useExpertStore()

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-5 border-b bg-background">
        <h1 className="text-[20px] font-semibold">技能工坊</h1>
        <p className="text-xs text-muted-foreground mt-1">
          8 项 AI 技能，由领域专家调用，覆盖数据分析、合规检查、可视化等场景
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {skills.map((skill, i) => {
            const colorClass = SKILL_COLORS[i % SKILL_COLORS.length]
            return (
              <div key={skill.id} className="bg-card rounded-xl border hover:shadow-md transition-shadow p-5">
                <div className="flex items-start gap-4 mb-4">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-lg",
                    colorClass
                  )}>
                    {SKILL_ICONS[skill.icon] || <CheckCircleOutlined />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold">{skill.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{skill.description}</p>
                  </div>
                </div>

                {/* Associated experts */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">调用专家:</span>
                  {skill.expertIds.map((eid) => {
                    const exp = experts.find(e => e.id === eid)
                    if (!exp) return null
                    return (
                      <Badge key={eid} variant="outline" className="text-xs font-normal gap-1">
                        <span className="text-[10px]">{EXPERT_ICONS_MAP[exp.icon]}</span>
                        {exp.displayName.slice(0, 6)}
                      </Badge>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}
