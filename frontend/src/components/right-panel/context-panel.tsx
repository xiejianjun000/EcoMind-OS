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
  Globe, Eye, Braces, PanelRight,
} from "lucide-react"

type PanelView = "context" | "browser" | "markdown"

interface Props {
  open: boolean
  data: ContextData
  onOpenChange: (open: boolean) => void
  className?: string
  /** URL to load in the embedded browser view */
  browserUrl?: string
  onBrowserUrlChange?: (url: string) => void
  /** Markdown content to preview */
  markdownContent?: string
  onMarkdownContentChange?: (content: string) => void
}

export function ContextPanel({ open, data, onOpenChange, className, browserUrl, onBrowserUrlChange, markdownContent, onMarkdownContentChange }: Props) {
  const [view, setView] = useState<PanelView>("context")

  if (!open) return <div className={cn(className)} />

  return (
    <div className={cn("flex flex-col", className)}>
      {/* View switcher — 对标 Trae tab bar */}
      <div className="flex items-center border-b bg-background/50">
        <ViewTab active={view === "context"} onClick={() => setView("context")} label="上下文" icon={<Eye className="h-3.5 w-3.5" />} />
        <ViewTab active={view === "browser"} onClick={() => setView("browser")} label="浏览器" icon={<Globe className="h-3.5 w-3.5" />} />
        <ViewTab active={view === "markdown"} onClick={() => setView("markdown")} label="预览" icon={<Braces className="h-3.5 w-3.5" />} />
        <div className="flex-1" />
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none" onClick={() => onOpenChange(false)}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* View content */}
      {view === "context" && <ContextView data={data} />}
      {view === "browser" && <BrowserView url={browserUrl} onUrlChange={onBrowserUrlChange} />}
      {view === "markdown" && <MarkdownView content={markdownContent} />}
    </div>
  )
}

function ViewTab({ active, onClick, label, icon }: { active: boolean; onClick: () => void; label: string; icon: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors",
        active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
      )}
    >
      {icon}
      <span className="hidden xl:inline">{label}</span>
    </button>
  )
}

// ─── Context View ─────────────────────────────────────
function ContextView({ data }: { data: ContextData }) {
  if (data.type === "empty") return <EmptyState />
  return (
    <ScrollArea className="flex-1">
      <div className="p-3 space-y-3">
        {data.type === "case" && <CaseView data={data.payload} />}
        {data.type === "regulation" && <RegulationView data={data.payload} />}
        {data.type === "monitor" && <MonitorView data={data.payload} />}
      </div>
    </ScrollArea>
  )
}

// ─── Browser View ─────────────────────────────────────
function BrowserView({ url, onUrlChange }: { url?: string; onUrlChange?: (url: string) => void }) {
  const [inputUrl, setInputUrl] = useState(url || "https://sthjt.hunan.gov.cn/")

  return (
    <div className="flex flex-col flex-1">
      <div className="flex items-center gap-1 p-2 border-b">
        <Globe className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        <input
          value={inputUrl}
          onChange={e => setInputUrl(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") onUrlChange?.(inputUrl) }}
          placeholder="输入网址..."
          className="flex-1 text-xs px-2 py-1 rounded border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <Button size="sm" className="h-6 text-[10px] px-2" onClick={() => onUrlChange?.(inputUrl)}>Go</Button>
      </div>
      <iframe
        src={url || "about:blank"}
        className="flex-1 w-full border-0"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        title="内置浏览器"
      />
    </div>
  )
}

// ─── Markdown Preview ─────────────────────────────────
function MarkdownView({ content }: { content?: string }) {
  if (!content) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <Braces className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
          <p className="text-xs text-muted-foreground">Agent 生成文档后将在此预览</p>
        </div>
      </div>
    )
  }
  return (
    <ScrollArea className="flex-1">
      <div className="p-4 prose prose-sm dark:prose-invert max-w-none">
        <div dangerouslySetInnerHTML={{ __html: content }} />
      </div>
    </ScrollArea>
  )
}

// ─── Shared view components ───────────────────────────
function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="text-center">
        <Sparkles className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
        <p className="text-xs text-muted-foreground">相关上下文将自动出现在这里</p>
      </div>
    </div>
  )
}

function CaseView({ data: _data }: { data?: any }) { return <p className="text-xs text-muted-foreground py-8 text-center">案件信息</p> }

function RegulationView({ data: _data }: { data?: any }) {
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input placeholder="搜索法规..." className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          onKeyDown={async (e) => {
            if (e.key !== "Enter") return
            setLoading(true)
            try {
              const r = await fetch("/api/rag/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: (e.target as HTMLInputElement).value, top_k: 5 }) })
              setResults((await r.json()).results || [])
            } catch { setResults([]) }
            setLoading(false)
          }} />
      </div>
      {loading && <p className="text-xs text-center text-muted-foreground">搜索中...</p>}
      {results.map((r: any, i: number) => (
        <div key={i} className="bg-background rounded-lg border p-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">{r.category || "法规"}</Badge>
            <span className="text-[11px] font-medium truncate">{r.law_name}</span>
          </div>
          <p className="text-[11px] text-muted-foreground line-clamp-2">{r.text}</p>
        </div>
      ))}
    </div>
  )
}

function MonitorView({ data: _data }: { data?: any }) {
  return (
    <div className="space-y-2">
      <MiniCityCard city="长沙市" aqi={72} level="良" primary="PM2.5" />
      <MiniCityCard city="株洲市" aqi={58} level="良" primary="O₃" />
      <MiniCityCard city="湘潭市" aqi={65} level="良" primary="PM10" />
      <Separator />
      <div className="flex items-center gap-2 px-1"><div className="w-2 h-2 rounded-full bg-green-500" /><span className="text-xs">全域 AQI 优良</span></div>
    </div>
  )
}

function MiniCityCard({ city, aqi, level, primary }: { city: string; aqi: number; level: string; primary: string }) {
  const c = aqi <= 50 ? "bg-green-500" : aqi <= 100 ? "bg-amber-500" : "bg-orange-500"
  return (
    <div className="bg-background rounded-lg border p-2.5 flex items-center justify-between">
      <div><span className="text-xs font-medium">{city}</span><p className="text-[10px] text-muted-foreground">{primary}</p></div>
      <div className="flex items-center gap-2"><span className="text-xs font-bold">{aqi}</span><Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">{level}</Badge><div className={cn("w-2 h-2 rounded-full", c)} /></div>
    </div>
  )
}
