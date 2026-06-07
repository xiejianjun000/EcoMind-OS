"use client"

import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import type { ContextData } from "@/layouts/ChatLayout"
import {
  X, Scale, Gavel, AlertTriangle, FileText,
  Activity, Sparkles, Search, ExternalLink,
  Globe, Eye, Braces, ImageIcon, Download, ZoomIn, ZoomOut,
  GitCompare, Terminal, Network, Settings, Copy,
} from "lucide-react"

/**
 * PanelView — 对标 Trae Solo 全部右侧视图类型
 *
 * Trae 原始视图: solo_chat / solo_browser / solo_terminal / solo_editor_panel /
 *   solo_diff_view / solo_deepwiki / solo_lark_doc / solo_supabase / solo_settings
 *
 * EcoMind 映射（保留6个高频 + "更多"下拉收折4个低频）:
 */
type PanelView = "context" | "browser" | "image" | "markdown" | "diff" | "terminal" | "knowledge" | "settings"

interface Props {
  open: boolean
  data: ContextData
  onOpenChange: (open: boolean) => void
  className?: string
  browserUrl?: string
  onBrowserUrlChange?: (url: string) => void
  markdownContent?: string
  imageUrls?: string[]
  onImageClick?: (url: string) => void
  diffContent?: { oldText: string; newText: string; title?: string }
  terminalOutput?: string
  knowledgeGraphData?: { nodes: Array<{ id: string; label: string }>; edges: Array<{ source: string; target: string }> }
}

/** Tab definitions — 6 主 tab + 2 折叠 tab（对标 Trae 的视图容器注册机制） */
/**
 * ALL_TABS — 对标 Trae Solo 的 ActivityBar + ViewContainer 模式
 *
 * 不堆在顶部, 而是:
 *   左侧 40px 纵向图标条 (ActivityBar)
 *   右侧 flex-1 主内容区
 *
 * 但因为我们只有 8 个视图（Trae VS Code 有十几个 + 扩展视图）,
 * 且右侧面板宽度 360px 已经很窄, 40px 再切一刀会让内容区只剩 320px。
 * 所以这里用 8 个图标纵向排列, 紧凑高效。
 */
const ALL_TABS: { key: PanelView; icon: React.ReactNode; label: string }[] = [
  { key: "context",   icon: <Eye className="h-4 w-4" />,         label: "上下文" },
  { key: "browser",   icon: <Globe className="h-4 w-4" />,       label: "浏览器" },
  { key: "image",     icon: <ImageIcon className="h-4 w-4" />,   label: "图片" },
  { key: "markdown",  icon: <Braces className="h-4 w-4" />,      label: "预览" },
  { key: "diff",      icon: <GitCompare className="h-4 w-4" />,  label: "对比" },
  { key: "terminal",  icon: <Terminal className="h-4 w-4" />,    label: "终端" },
  { key: "knowledge", icon: <Network className="h-4 w-4" />,     label: "图谱" },
  { key: "settings",  icon: <Settings className="h-4 w-4" />,    label: "设置" },
]

export function ContextPanel({
  open, data, onOpenChange, className,
  browserUrl, onBrowserUrlChange, markdownContent,
  imageUrls, onImageClick, diffContent,
  terminalOutput, knowledgeGraphData,
}: Props) {
  const [view, setView] = useState<PanelView>("context")

  if (!open) return <div className={cn(className)} />

  return (
    <div className={cn("flex", className)}>
      {/* ── ActivityBar (40px) — 对标 Trae: 纵向图标条 ── */}
      <div className="w-10 flex-shrink-0 flex flex-col items-center py-2 gap-1 border-r bg-background/50">
        {ALL_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setView(tab.key)}
            title={tab.label}
            className={cn(
              "w-8 h-8 flex items-center justify-center rounded-md transition-colors",
              view === tab.key
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            )}
          >
            {tab.icon}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={() => onOpenChange(false)}
          className="w-8 h-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          title="关闭面板"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* ── View Header + Content ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header: 显示当前视图名称（对标 Trae 的 pane header） */}
        <div className="flex items-center justify-between px-3 h-9 border-b bg-background/50 flex-shrink-0">
          <div className="flex items-center gap-2">
            {ALL_TABS.find(t => t.key === view)?.icon}
            <span className="text-xs font-semibold">
              {ALL_TABS.find(t => t.key === view)?.label}
            </span>
          </div>
        </div>

      {/* Content */}
      <ViewContent view={view} data={data}
        browserUrl={browserUrl} onBrowserUrlChange={onBrowserUrlChange}
        markdownContent={markdownContent} imageUrls={imageUrls}
        onImageClick={onImageClick} diffContent={diffContent}
        terminalOutput={terminalOutput} knowledgeGraphData={knowledgeGraphData}
      />
      </div>
    </div>
  )
}

// ─── View Router ───────────────────────────────────────

function ViewContent(props: { view: PanelView } & Props) {
  switch (props.view) {
    case "context":   return <ContextView data={props.data} />
    case "browser":   return <BrowserView url={props.browserUrl} onUrlChange={props.onBrowserUrlChange} />
    case "image":     return <ImageView urls={props.imageUrls} onImageClick={props.onImageClick} />
    case "markdown":  return <MarkdownView content={props.markdownContent} />
    case "diff":      return <DiffView content={props.diffContent} />
    case "terminal":  return <TerminalView output={props.terminalOutput} />
    case "knowledge": return <KnowledgeView data={props.knowledgeGraphData} />
    case "settings":  return <SettingsView />
    default:          return <EmptyState />
  }
}

// ─── Context ────────────────────────────────────────────

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

// ─── Browser ────────────────────────────────────────────

function BrowserView({ url, onUrlChange }: { url?: string; onUrlChange?: (url: string) => void }) {
  const [inputUrl, setInputUrl] = useState(url || "https://sthjt.hunan.gov.cn/")
  return (
    <div className="flex flex-col flex-1">
      <div className="flex items-center gap-1 p-2 border-b">
        <Globe className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        <input value={inputUrl} onChange={e => setInputUrl(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") onUrlChange?.(inputUrl) }}
          placeholder="输入网址..." className="flex-1 text-xs px-2 py-1 rounded border bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
        <Button size="sm" className="h-6 text-[10px] px-2" onClick={() => onUrlChange?.(inputUrl)}>Go</Button>
      </div>
      <iframe src={url || "about:blank"} className="flex-1 w-full border-0"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups" title="内置浏览器" />
    </div>
  )
}

// ─── Markdown ───────────────────────────────────────────

function MarkdownView({ content }: { content?: string }) {
  if (!content) return <EmptyHint icon={<Braces />} text="Agent 生成文档后将在此预览" />
  return (
    <ScrollArea className="flex-1">
      <div className="p-4 prose prose-sm dark:prose-invert max-w-none">
        <div dangerouslySetInnerHTML={{ __html: content }} />
      </div>
    </ScrollArea>
  )
}

// ─── Image ──────────────────────────────────────────────

function ImageView({ urls, onImageClick }: { urls?: string[]; onImageClick?: (url: string) => void }) {
  const [selectedIdx, setSelectedIdx] = useState(0)
  if (!urls || urls.length === 0) return <EmptyHint icon={<ImageIcon />} text="对话中的图片将在此显示" sub="支持点击查看、缩放、分享" />

  return (
    <div className="flex flex-col flex-1">
      <div className="flex-1 flex items-center justify-center bg-black/5 dark:bg-white/5 p-4">
        <img src={urls[selectedIdx]} alt={`图片 ${selectedIdx + 1}`}
          className="max-w-full max-h-full object-contain rounded cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => onImageClick?.(urls[selectedIdx])} />
      </div>
      {urls.length > 1 && (
        <div className="flex gap-1.5 p-2 border-t overflow-x-auto">
          {urls.map((url, i) => (
            <img key={i} src={url} alt={`缩略图 ${i + 1}`} onClick={() => setSelectedIdx(i)}
              className={cn("w-12 h-12 object-cover rounded cursor-pointer border-2 flex-shrink-0 transition-all",
                i === selectedIdx ? "border-primary" : "border-transparent hover:border-muted-foreground")} />
          ))}
        </div>
      )}
      <div className="flex items-center justify-between px-3 py-2 border-t bg-background/50">
        <span className="text-[10px] text-muted-foreground">{selectedIdx + 1} / {urls.length}</span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedIdx(Math.max(0, selectedIdx - 1))} disabled={selectedIdx === 0}><ZoomOut className="h-3 w-3" /></Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSelectedIdx(Math.min(urls.length - 1, selectedIdx + 1))} disabled={selectedIdx === urls.length - 1}><ZoomIn className="h-3 w-3" /></Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => window.open(urls[selectedIdx], "_blank")}><Download className="h-3 w-3" /></Button>
        </div>
      </div>
    </div>
  )
}

// ─── Diff View — 对标 Trae solo_diff_view ──────────────

function DiffView({ content }: { content?: { oldText: string; newText: string; title?: string } }) {
  if (!content) return <EmptyHint icon={<GitCompare />} text="Agent 编辑文档后可在此查看变更对比" sub="支持前后版本逐行对比" />

  return (
    <div className="flex flex-col flex-1">
      <div className="px-3 py-2 border-b bg-background/50 flex items-center gap-2">
        <GitCompare className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-medium">{content.title || "文档对比"}</span>
      </div>
      <div className="flex-1 flex">
        {/* Old (left) */}
        <div className="flex-1 border-r">
          <div className="px-2 py-1 border-b bg-red-50/50 dark:bg-red-950/20">
            <span className="text-[10px] font-medium text-red-600 dark:text-red-400">修改前</span>
          </div>
          <ScrollArea className="h-[calc(100%-28px)]">
            <pre className="p-2 text-[11px] font-mono whitespace-pre-wrap text-muted-foreground">{content.oldText}</pre>
          </ScrollArea>
        </div>
        {/* New (right) */}
        <div className="flex-1">
          <div className="px-2 py-1 border-b bg-green-50/50 dark:bg-green-950/20">
            <span className="text-[10px] font-medium text-green-600 dark:text-green-400">修改后</span>
          </div>
          <ScrollArea className="h-[calc(100%-28px)]">
            <pre className="p-2 text-[11px] font-mono whitespace-pre-wrap">{content.newText}</pre>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}

// ─── Terminal View — 对标 Trae solo_terminal ───────────

function TerminalView({ output }: { output?: string }) {
  const [logs, setLogs] = useState<string[]>(output ? output.split("\n") : [])
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }) }, [logs])

  // Accept new output via prop changes
  useEffect(() => { if (output) setLogs(output.split("\n")) }, [output])

  return (
    <div className="flex flex-col flex-1">
      <div className="flex items-center justify-between px-3 py-1.5 border-b bg-background/50">
        <div className="flex items-center gap-2">
          <Terminal className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium">沙箱输出</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">{logs.length} 行</Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => navigator.clipboard.writeText(logs.join("\n"))}><Copy className="h-3 w-3" /></Button>
        </div>
      </div>
      <ScrollArea className="flex-1 bg-black dark:bg-zinc-950 rounded-none">
        <div className="p-3 font-mono text-[11px] text-green-400 min-h-full">
          {logs.length === 0 ? (
            <span className="text-muted-foreground">$ 等待 Agent 执行代码...</span>
          ) : (
            logs.map((line, i) => (
              <div key={i} className="leading-relaxed">
                <span className="text-zinc-500 mr-2 select-none">{String(i + 1).padStart(3)}</span>
                <span className={line.startsWith("Error") || line.includes("Traceback") ? "text-red-400" : "text-green-400"}>{line}</span>
              </div>
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
    </div>
  )
}

// ─── Knowledge Graph — 对标 Trae solo_deepwiki ─────────

function KnowledgeView({ data }: { data?: { nodes: Array<{ id: string; label: string; type?: string; layer?: number }>; edges: Array<{ source: string; target: string; relation: string; layer?: number; weight?: number }> } }) {
  const [liveData, setLiveData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => { setLoading(true); fetch("/api/graph/subgraph").then(r => r.json()).then(d => { if (d.nodes?.length > 0) setLiveData(d); setLoading(false) }).catch(() => setLoading(false)) }, [])

  const displayData = data || liveData
  const layerColors: Record<number, string> = { 1: "border-blue-300", 2: "border-green-300", 3: "border-purple-300" }
  const relationLabels: Record<string, string> = { cites: "引用", session_references: "搜索引用", user_corrects: "⚠纠正", co_occurred: "共现", frequently_cited: "高频引用", knowledge_gap: "知识缺口" }

  if (loading && !displayData) return <div className="flex-1 flex items-center justify-center"><p className="text-xs text-muted-foreground">加载中...</p></div>
  if (!displayData || displayData.nodes?.length === 0) return <EmptyHint icon={<Network />} text="知识图谱将在对话中自动构建" sub="RAG注入→Layer1 / 搜索→Layer2 / 反思→Layer3" />

  const nodes = displayData.nodes || []; const edges = displayData.edges || []

  return (
    <div className="flex flex-col flex-1">
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-background/50">
        <Network className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-medium">知识图谱</span>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">{nodes.length} 节点</Badge>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">{edges.length} 边</Badge>
      </div>
      <ScrollArea className="flex-1 p-3">
        <div className="space-y-3">
          <div className="flex gap-1.5">{[1,2,3].map(layer => { const cnt = nodes.filter((n:any) => (n.layer||1)===layer).length; if(!cnt) return null; return <Badge key={layer} variant="outline" className={cn("text-[10px] px-1.5 py-0 h-4 border", layerColors[layer]||"")}>{layer===1?"法规层":layer===2?"会话层":"进化层"} {cnt}</Badge>})}</div>
          <Separator />
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">实体节点</p>
            <div className="flex flex-wrap gap-1">
              {nodes.map((n: any) => <Badge key={n.id} variant="secondary" className={cn("text-[10px] border", layerColors[n.layer||1]||layerColors[1])} title={n.id}>{(n.type==="regulation"?"📜 ":n.type==="session"?"💬 ":n.type==="user"?"👤 ":"")}{n.label.length>18?n.label.slice(0,16)+"…":n.label}</Badge>)}
            </div>
          </div>
          <Separator />
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">关联关系（带权重）</p>
            <div className="space-y-1">
              {edges.slice(0,30).map((e: any, i: number) => {
                const srcN = nodes.find((n:any) => n.id === e.source); const tgtN = nodes.find((n:any) => n.id === e.target)
                return (<div key={i} className={cn("flex items-center gap-1 text-[10px] p-1 rounded border", layerColors[e.layer||1]||layerColors[1])}>
                  <span className="font-medium flex-1 truncate">{srcN?.label || e.source.slice(0,12)}</span>
                  <span className="text-primary font-medium px-1 rounded bg-primary/5 text-[9px]">{relationLabels[e.relation]||e.relation}</span>
                  <span className="font-medium flex-1 truncate text-right">{tgtN?.label || e.target.slice(0,12)}</span>
                  {e.weight && e.weight !== 1 && <span className="text-[8px] text-muted-foreground">{e.relation==="user_corrects"?"⚠":`×${e.weight.toFixed(1)}`}</span>}
                </div>)
              })}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}

// ─── Settings — 对标 Trae solo_settings ────────────────

function SettingsView() {
  return (
    <ScrollArea className="flex-1">
      <div className="p-3 space-y-4">
        <SectionTitle icon={<Globe className="h-4 w-4" />} title="连接状态" />
        <div className="space-y-1.5">
          <StatusRow name="DeepSeek API" status="connected" detail="deepseek-chat" />
          <StatusRow name="HN.Leite 环境数据" status="connected" detail="14 市州实时监测" />
          <StatusRow name="WebSocket 推送" status="pending" detail="ws://localhost:8000" />
          <StatusRow name="飞书消息网关" status="disabled" detail="未配置 App ID" />
          <StatusRow name="企业微信网关" status="disabled" detail="未配置 Corp ID" />
          <StatusRow name="钉钉消息网关" status="disabled" detail="未配置 App Key" />
          <StatusRow name="微信公众号网关" status="disabled" detail="未配置 App ID" />
        </div>

        <Separator />
        <SectionTitle icon={<FileText className="h-4 w-4" />} title="系统信息" />
        <div className="text-xs text-muted-foreground space-y-1">
          <div className="flex justify-between"><span>版本</span><span>EcoMind OS v2.2</span></div>
          <div className="flex justify-between"><span>Agent 引擎</span><span>EcoAgentEngine (自建)</span></div>
          <div className="flex justify-between"><span>向量后端</span><span>SQLite + numpy</span></div>
          <div className="flex justify-between"><span>国密算法</span><span>SM2/SM3/SM4 (govmcp)</span></div>
          <div className="flex justify-between"><span>数据库</span><span>SQLite (hermes_memory.db)</span></div>
        </div>
      </div>
    </ScrollArea>
  )
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return <div className="flex items-center gap-2"><span className="text-primary">{icon}</span><h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h4></div>
}

function StatusRow({ name, status, detail }: { name: string; status: "connected" | "pending" | "disabled"; detail: string }) {
  const color = status === "connected" ? "bg-green-500" : status === "pending" ? "bg-amber-500" : "bg-zinc-400"
  return (
    <div className="flex items-center justify-between bg-background rounded-lg border p-2">
      <div className="flex items-center gap-2">
        <div className={cn("w-2 h-2 rounded-full", color)} />
        <span className="text-xs">{name}</span>
      </div>
      <span className="text-[10px] text-muted-foreground">{detail}</span>
    </div>
  )
}

// ─── Shared ────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="text-center">
        <Sparkles className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
        <p className="text-xs text-muted-foreground">开始对话后，相关上下文将自动出现在这里</p>
      </div>
    </div>
  )
}

function EmptyHint({ icon, text, sub }: { icon: React.ReactNode; text: string; sub?: string }) {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="text-center">
        <div className="mb-2 text-muted-foreground/30 flex justify-center">{icon}</div>
        <p className="text-xs text-muted-foreground">{text}</p>
        {sub && <p className="text-[10px] text-muted-foreground/60 mt-1">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Context sub-views ─────────────────────────────────

function CaseView({ data: _ }: { data?: any }) {
  return <p className="text-xs text-muted-foreground py-8 text-center">案件信息将自动关联到当前对话</p>
}

function RegulationView({ data: _ }: { data?: any }) {
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input placeholder="搜索法规..."
          className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
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
      {loading && <p className="text-xs text-center text-muted-foreground py-4">搜索中...</p>}
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
  )
}

function MonitorView({ data: _ }: { data?: any }) {
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
