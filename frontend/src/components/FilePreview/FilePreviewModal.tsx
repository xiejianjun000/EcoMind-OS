/**
 * FilePreviewModal — 中间栏文件预览器
 *
 * 支持 PDF / DOCX / XLSX / 图片 / Markdown / 文本
 * 从侧边栏资料库点击文件后在中间区域打开
 */
"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  X, Download, Loader2, FileText,
  Maximize2, Minimize2,
} from "lucide-react"
import type { KnowledgeFile } from "@/services/knowledgeService"

interface FilePreviewModalProps {
  file: KnowledgeFile | null
  onClose: () => void
  className?: string
}

export function FilePreviewModal({ file, onClose, className }: FilePreviewModalProps) {
  const [loading, setLoading] = useState(false)
  const [content, setContent] = useState<string>("")
  const [error, setError] = useState<string | null>(null)
  const [fullscreen, setFullscreen] = useState(false)

  const ext = file?.extension?.toLowerCase() || ""
  const isImage = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'].includes(ext)
  const isPdf = ext === '.pdf'
  const isDocx = ext === '.docx'
  const isXlsx = ext === '.xlsx' || ext === '.xls'
  const isText = ['.md', '.txt', '.json', '.xml', '.csv', '.yaml', '.yml', '.log'].includes(ext)
  const isCode = ['.ts', '.tsx', '.js', '.jsx', '.py', '.css', '.html', '.sh'].includes(ext)

  const loadFile = useCallback(async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    setContent("")

    try {
      if (isPdf || isImage) {
        const fileUrl = `/api/knowledge/file/raw?path=${encodeURIComponent(file.path)}`
        setContent(fileUrl)
        setLoading(false)
        return
      }

      if (isText || isCode) {
        const resp = await fetch(`/api/knowledge/file?path=${encodeURIComponent(file.path)}`)
        const json = await resp.json()
        if (json.code === 200 && json.data?.content) {
          setContent(json.data.content)
        } else {
          setError(json.data?.note || "无法读取文件内容")
        }
        setLoading(false)
        return
      }

      if (isDocx) {
        try {
          const { default: mammoth } = await import("mammoth")
          const resp = await fetch(`/api/knowledge/file/raw?path=${encodeURIComponent(file.path)}`)
          const arrayBuffer = await resp.arrayBuffer()
          const result = await mammoth.convertToHtml({ arrayBuffer })
          setContent(result.value)
        } catch (e: any) {
          setError("DOCX 解析失败: " + (e.message || "未知错误"))
        }
        setLoading(false)
        return
      }

      if (isXlsx) {
        try {
          const { read, utils } = await import("xlsx")
          const resp = await fetch(`/api/knowledge/file/raw?path=${encodeURIComponent(file.path)}`)
          const arrayBuffer = await resp.arrayBuffer()
          const workbook = read(arrayBuffer, { type: "array" })
          const sheetName = workbook.SheetNames[0]
          const sheet = workbook.Sheets[sheetName]
          const html = utils.sheet_to_html(sheet, { id: "xlsx-preview", editable: false })
          setContent(html)
        } catch (e: any) {
          setError("XLSX 解析失败: " + (e.message || "未知错误"))
        }
        setLoading(false)
        return
      }

      // Fallback
      const resp = await fetch(`/api/knowledge/file?path=${encodeURIComponent(file.path)}`)
      const json = await resp.json()
      if (json.code === 200 && json.data?.content) {
        setContent(json.data.content)
      } else {
        setError(json.data?.note || "不支持的文件格式")
      }
    } catch (e: any) {
      setError("加载失败: " + (e.message || "未知错误"))
    } finally {
      setLoading(false)
    }
  }, [file, isPdf, isImage, isDocx, isXlsx, isText, isCode])

  useEffect(() => { if (file) loadFile() }, [file, loadFile])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [onClose])

  if (!file) return null

  return (
    <div className={cn("fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4", fullscreen && "p-0", className)}>
      <div className={cn("bg-background rounded-xl shadow-2xl flex flex-col overflow-hidden",
        fullscreen ? "w-full h-full rounded-none" : "w-full max-w-4xl h-[85vh]")}>
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0 bg-muted/30">
          <FileText className="h-4 w-4 text-primary flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold truncate">{file.name}</h3>
            <p className="text-[10px] text-muted-foreground truncate">{file.path}</p>
          </div>
          <span className="text-[10px] text-muted-foreground">{file.size_display}</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setFullscreen(f => !f)}
            title={fullscreen ? "退出全屏" : "全屏"}>
            {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7"
            onClick={() => window.open(`/api/knowledge/file/raw?path=${encodeURIComponent(file.path)}`, '_blank')}
            title="下载">
            <Download className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="text-sm">正在加载...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-3 text-muted-foreground p-8 text-center">
                <FileText className="h-10 w-10 opacity-30" />
                <p className="text-sm text-red-500">{error}</p>
                <Button variant="outline" size="sm" onClick={loadFile}>重试</Button>
              </div>
            </div>
          ) : (
            <FileRenderer ext={ext} content={content} isPdf={isPdf} isImage={isImage}
              isDocx={isDocx} isXlsx={isXlsx} isText={isText} isCode={isCode} />
          )}
        </div>

        <div className="px-4 py-2 border-t bg-muted/30 flex items-center justify-between shrink-0">
          <span className="text-[10px] text-muted-foreground">{file.extension} · {file.category_name}</span>
          <span className="text-[10px] text-muted-foreground">Esc 关闭</span>
        </div>
      </div>
    </div>
  )
}

// ─── File Renderer ───

function FileRenderer({ ext, content, isPdf, isImage, isDocx, isXlsx, isText, isCode }: {
  ext: string; content: string; isPdf: boolean; isImage: boolean
  isDocx: boolean; isXlsx: boolean; isText: boolean; isCode: boolean
}) {
  if (isPdf) return <iframe src={content} className="w-full h-full border-0" title="PDF" />

  if (isImage) return (
    <div className="flex items-center justify-center h-full p-4 bg-muted/20">
      <img src={content} alt="preview" className="max-w-full max-h-full object-contain rounded-lg shadow-lg" />
    </div>
  )

  if (isDocx) return (
    <ScrollArea className="h-full">
      <div className="p-6 prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: content }} />
    </ScrollArea>
  )

  if (isXlsx) return (
    <ScrollArea className="h-full">
      <div className="p-4 overflow-auto">
        <style>{`#xlsx-preview { border-collapse:collapse; font-size:12px } #xlsx-preview td,#xlsx-preview th { border:1px solid #ddd; padding:4px 8px; min-width:60px } #xlsx-preview tr:nth-child(even) { background:#fafafa } #xlsx-preview th { background:#f0f0f0; font-weight:600 }`}</style>
        <div dangerouslySetInnerHTML={{ __html: content }} />
      </div>
    </ScrollArea>
  )

  if (ext === '.md') return (
    <ScrollArea className="h-full">
      <div className="p-6 prose prose-sm max-w-none dark:prose-invert">
        <MarkdownView content={content} />
      </div>
    </ScrollArea>
  )

  return (
    <ScrollArea className="h-full">
      <pre className="p-6 text-xs font-mono leading-relaxed whitespace-pre-wrap"><code>{content}</code></pre>
    </ScrollArea>
  )
}

function MarkdownView({ content }: { content: string }) {
  const html = useMemo(() => {
    let h = content
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/\n\n/g, '<br/><br/>')
    return h
  }, [content])
  return <div dangerouslySetInnerHTML={{ __html: html }} />
}
