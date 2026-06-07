"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import {
  PanelRightOpen, X,
  Scale, Gavel, AlertTriangle, FileText,
  BarChart3, Activity, Clock,
  Sparkles, Search,
} from "lucide-react"

export type ContextPanelView = "case" | "regulation" | "monitor" | "insight" | "history"

interface ContextPanelProps {
  open: boolean
  view: ContextPanelView
  onViewChange: (view: ContextPanelView) => void
  onOpenChange: (open: boolean) => void
  className?: string
}

/** Tabs in the context panel header */
const VIEW_TABS: { key: ContextPanelView; label: string; icon: React.ReactNode }[] = [
  { key: "case", label: "执法", icon: <Gavel className="h-3.5 w-3.5" /> },
  { key: "regulation", label: "法规", icon: <Scale className="h-3.5 w-3.5" /> },
  { key: "monitor", label: "监测", icon: <Activity className="h-3.5 w-3.5" /> },
  { key: "insight", label: "洞察", icon: <Sparkles className="h-3.5 w-3.5" /> },
  { key: "history", label: "历史", icon: <Clock className="h-3.5 w-3.5" /> },
]

export function ContextPanel({ open, view, onViewChange, onOpenChange, className }: ContextPanelProps) {
  if (!open) {
    return (
      <div className={cn(className, "flex items-start pt-3 justify-center")}>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full mt-2"
          onClick={() => onOpenChange(true)}
          title="打开上下文面板"
        >
          <PanelRightOpen className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col bg-sidebar", className)}>
      {/* Tab bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-background/50">
        <div className="flex items-center gap-0.5">
          {VIEW_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => onViewChange(tab.key)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
                view === tab.key
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              {tab.icon}
              <span className="hidden xl:inline">{tab.label}</span>
            </button>
          ))}
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onOpenChange(false)}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {view === "case" && <CaseContext />}
          {view === "regulation" && <RegulationContext />}
          {view === "monitor" && <MonitorContext />}
          {view === "insight" && <InsightContext />}
          {view === "history" && <HistoryContext />}
        </div>
      </ScrollArea>
    </div>
  )
}

// ─── View Components ──────────────────────────────────────────────────────

function CaseContext() {
  return (
    <div className="space-y-3">
      <SectionHeading icon={<Gavel className="h-4 w-4" />} title="当前案件上下文" />
      <div className="bg-background rounded-lg border p-3 space-y-2">
        <div className="text-xs text-muted-foreground">暂无活跃案件</div>
        <p className="text-xs text-muted-foreground/70">
          执法对话中的案件信息将在此显示——关联法条、现场证据、历史处罚记录等。
        </p>
      </div>

      <Separator />

      <SectionHeading icon={<FileText className="h-4 w-4" />} title="关联文件" />
      <div className="space-y-1">
        <ContextFileItem name="暂无关联文件" desc="使用 @ 或上传文件" />
      </div>

      <Separator />

      <SectionHeading icon={<AlertTriangle className="h-4 w-4" />} title="风险提示" />
      <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800 p-3">
        <p className="text-xs text-amber-800 dark:text-amber-200">
          当前对话未检测到明确的执法案件上下文。开始讨论具体案件后，EcoMind 将自动匹配相关法规和判例。
        </p>
      </div>
    </div>
  )
}

function RegulationContext() {
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  return (
    <div className="space-y-3">
      <SectionHeading icon={<Scale className="h-4 w-4" />} title="相关法规" />
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          placeholder="搜索法规..."
          className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          onKeyDown={async (e) => {
            if (e.key === "Enter") {
              setLoading(true)
              const q = (e.target as HTMLInputElement).value
              try {
                const resp = await fetch("/api/rag/search", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ query: q, top_k: 5 }),
                })
                const data = await resp.json()
                setResults(data.results || [])
              } catch { setResults([]) }
              setLoading(false)
            }
          }}
        />
      </div>
      {loading && <p className="text-xs text-muted-foreground">搜索中...</p>}
      {results.length > 0 && (
        <div className="space-y-1.5">
          {results.map((r: any, i: number) => (
            <div key={i} className="bg-background rounded-lg border p-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">{r.category || "法规"}</Badge>
                <span className="text-[11px] font-medium truncate">{r.law_name}</span>
              </div>
              <p className="text-[11px] text-muted-foreground line-clamp-3">{r.text}</p>
              {r.article && <span className="text-[10px] text-primary mt-0.5 block">{r.article}</span>}
            </div>
          ))}
        </div>
      )}
      {!loading && results.length === 0 && (
        <p className="text-xs text-muted-foreground">输入关键词搜索生态环境法规</p>
      )}
    </div>
  )
}

function MonitorContext() {
  return (
    <div className="space-y-3">
      <SectionHeading icon={<Activity className="h-4 w-4" />} title="实时环境监测" />
      <MonitorCard city="长沙市" aqi={72} level="良" primary="PM2.5" />
      <MonitorCard city="株洲市" aqi={58} level="良" primary="O₃" />
      <MonitorCard city="湘潭市" aqi={65} level="良" primary="PM10" />

      <Separator />

      <SectionHeading icon={<BarChart3 className="h-4 w-4" />} title="告警" />
      <div className="bg-background rounded-lg border p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-xs font-medium">湖南省全域</span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          暂无环境质量超标告警。AQI 整体优良。
        </p>
      </div>
    </div>
  )
}

function InsightContext() {
  return (
    <div className="space-y-3">
      <SectionHeading icon={<Sparkles className="h-4 w-4" />} title="AI 洞察" />
      <div className="bg-background rounded-lg border p-3 space-y-2">
        <InsightItem
          title="近期高频查询"
          desc="废气排放标准、环评审批流程、排污许可证申请"
        />
        <Separator />
        <InsightItem
          title="Agent 学习要点"
          desc="最近3次纠正：法规编号格式、处罚幅度范围、监测数据单位"
        />
      </div>
    </div>
  )
}

function HistoryContext() {
  return (
    <div className="space-y-3">
      <SectionHeading icon={<Clock className="h-4 w-4" />} title="对话摘要" />
      <div className="bg-background rounded-lg border p-3">
        <p className="text-xs text-muted-foreground">
          当前会话的对话历史将在此显示。EcoMind 学习系统会在会话结束后自动生成摘要。
        </p>
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────

function SectionHeading({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-primary">{icon}</span>
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4>
    </div>
  )
}

function ContextFileItem({ name, desc }: { name: string; desc: string }) {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent transition-colors cursor-pointer">
      <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-xs truncate">{name}</p>
        <p className="text-[10px] text-muted-foreground">{desc}</p>
      </div>
    </div>
  )
}

function MonitorCard({ city, aqi, level, primary }: { city: string; aqi: number; level: string; primary: string }) {
  const color = aqi <= 50 ? "green" : aqi <= 100 ? "yellow" : aqi <= 150 ? "orange" : "red"
  const colorMap = { green: "bg-green-500", yellow: "bg-amber-500", orange: "bg-orange-500", red: "bg-red-500" }
  return (
    <div className="bg-background rounded-lg border p-2.5 flex items-center justify-between">
      <div>
        <span className="text-xs font-medium">{city}</span>
        <p className="text-[10px] text-muted-foreground">首要: {primary}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold">{aqi}</span>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">{level}</Badge>
        <div className={cn("w-2 h-2 rounded-full", colorMap[color])} />
      </div>
    </div>
  )
}

function InsightItem({ title, desc }: { title: string; desc: string }) {
  return (
    <div>
      <h5 className="text-xs font-medium mb-0.5">{title}</h5>
      <p className="text-[11px] text-muted-foreground">{desc}</p>
    </div>
  )
}
