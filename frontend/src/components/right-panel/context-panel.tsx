"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import type { ContextData } from "@/layouts/ChatLayout"
import {
  X, Scale, Gavel, AlertTriangle, FileText,
  Activity, Sparkles, Search, ExternalLink,
} from "lucide-react"

interface Props {
  open: boolean
  data: ContextData
  onOpenChange: (open: boolean) => void
  className?: string
}

/**
 * ContextPanel — Layer 3: 自动上下文面板
 *
 * 对标 Trae Solo 的 AuxiliaryBar (.solo-ai-sidebar):
 *   - 内容由 Layer 2 (Editor) 自动驱动
 *   - 不提供手动 Tab 切换
 *   - 显示与当前对话相关的法规、数据、文件
 */
export function ContextPanel({ open, data, onOpenChange, className }: Props) {
  if (!open) return <div className={cn(className)} />

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b bg-background/50">
        <div className="flex items-center gap-2">
          {data.type === "case" && <Gavel className="h-4 w-4 text-primary" />}
          {data.type === "regulation" && <Scale className="h-4 w-4 text-primary" />}
          {data.type === "monitor" && <Activity className="h-4 w-4 text-primary" />}
          {data.type === "empty" && <Sparkles className="h-4 w-4 text-primary" />}
          <span className="text-xs font-semibold">
            {data.title || (data.type === "empty" ? "上下文" : (
              data.type === "case" ? "案件上下文" :
              data.type === "regulation" ? "相关法规" : "环境监测"
            ))}
          </span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onOpenChange(false)}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Body */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {data.type === "empty" && <EmptyState />}
          {data.type === "case" && <CaseView data={data.payload} />}
          {data.type === "regulation" && <RegulationView data={data.payload} />}
          {data.type === "monitor" && <MonitorView data={data.payload} />}
        </div>
      </ScrollArea>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="py-12 text-center">
      <Sparkles className="h-8 w-8 mx-auto mb-3 text-muted-foreground/30" />
      <p className="text-xs text-muted-foreground">开始对话后，相关法规、数据、文件将自动出现在这里</p>
      <p className="text-[10px] text-muted-foreground/60 mt-2">无需手动切换 — 根据对话内容自动关联</p>
    </div>
  )
}

function CaseView({ data }: { data?: any }) {
  if (!data) {
    return <p className="text-xs text-muted-foreground py-8 text-center">对话中未检测到案件信息</p>
  }
  return (
    <div className="space-y-2">
      <div className="bg-background rounded-lg border p-2.5">
        <p className="text-xs font-medium">{data.title || "案件详情"}</p>
        {data.articles && (
          <div className="mt-2 space-y-1">
            {data.articles.map((a: any, i: number) => (
              <div key={i} className="flex items-start gap-1.5 p-1.5 rounded hover:bg-accent cursor-pointer">
                <Scale className="h-3 w-3 text-primary mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] font-medium">{a.law}</p>
                  <p className="text-[10px] text-muted-foreground line-clamp-2">{a.text}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function RegulationView({ data }: { data?: any }) {
  const [results, setResults] = useState<any[]>(data?.articles || [])
  const [loading, setLoading] = useState(false)

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          placeholder="搜索法规..."
          className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          onKeyDown={async (e) => {
            if (e.key === "Enter") {
              const q = (e.target as HTMLInputElement).value
              setLoading(true)
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
      {loading && <p className="text-xs text-muted-foreground py-4 text-center">搜索中...</p>}
      {results.length > 0 ? (
        <div className="space-y-1.5">
          {results.map((r: any, i: number) => (
            <div key={i} className="bg-background rounded-lg border p-2.5 hover:bg-accent/50 cursor-pointer transition-colors">
              <div className="flex items-center gap-1.5 mb-1">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">{r.category || "法规"}</Badge>
                <span className="text-[11px] font-medium truncate">{r.law_name}</span>
              </div>
              <p className="text-[11px] text-muted-foreground line-clamp-2">{r.text}</p>
              {r.article && <span className="text-[10px] text-primary mt-0.5 block">{r.article}</span>}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground py-4 text-center">输入关键词搜索生态环境法规</p>
      )}
    </div>
  )
}

function MonitorView({ data }: { data?: any }) {
  return (
    <div className="space-y-2">
      <MiniCityCard city="长沙市" aqi={72} level="良" primary="PM2.5" />
      <MiniCityCard city="株洲市" aqi={58} level="良" primary="O₃" />
      <MiniCityCard city="湘潭市" aqi={65} level="良" primary="PM10" />
      <Separator />
      <div className="flex items-center gap-2 px-1">
        <div className="w-2 h-2 rounded-full bg-green-500" />
        <span className="text-xs">湖南省全域 AQI 优良</span>
      </div>
    </div>
  )
}

function MiniCityCard({ city, aqi, level, primary }: { city: string; aqi: number; level: string; primary: string }) {
  const color = aqi <= 50 ? "bg-green-500" : aqi <= 100 ? "bg-amber-500" : aqi <= 150 ? "bg-orange-500" : "bg-red-500"
  return (
    <div className="bg-background rounded-lg border p-2.5 flex items-center justify-between">
      <div>
        <span className="text-xs font-medium">{city}</span>
        <p className="text-[10px] text-muted-foreground">{primary}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold">{aqi}</span>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">{level}</Badge>
        <div className={cn("w-2 h-2 rounded-full", color)} />
      </div>
    </div>
  )
}
