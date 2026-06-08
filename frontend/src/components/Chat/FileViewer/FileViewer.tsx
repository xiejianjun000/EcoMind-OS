/**
 * FileViewer — Multi-tab file viewer with Markdown/C code/image preview
 * WorkBuddy pattern: FileTabs + FileViewer for right panel content
 */
"use client"

import { useState, useMemo, useCallback } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { X, FileText, Image, Code, ExternalLink, Pin, PinOff } from "lucide-react"

export interface ViewerFile {
  id: string
  name: string
  path?: string
  content: string
  type: "markdown" | "code" | "image" | "text" | "json"
  language?: string
  url?: string
  size?: number
  pinned?: boolean
}

interface FileViewerProps {
  files: ViewerFile[]
  activeFileId?: string
  onSelectFile?: (fileId: string) => void
  onCloseFile?: (fileId: string) => void
  onPinFile?: (fileId: string) => void
  className?: string
}

export function FileViewer({
  files,
  activeFileId,
  onSelectFile,
  onCloseFile,
  onPinFile,
  className,
}: FileViewerProps) {
  const [internalActiveId, setInternalActiveId] = useState(files[0]?.id || "")
  const activeId = activeFileId ?? internalActiveId
  const activeFile = files.find((f) => f.id === activeId)

  const handleSelect = useCallback((id: string) => {
    setInternalActiveId(id)
    onSelectFile?.(id)
  }, [onSelectFile])

  if (files.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-full text-muted-foreground", className)}>
        <FileText className="h-10 w-10 mb-2 opacity-20" />
        <p className="text-sm">选择文件以查看</p>
        <p className="text-xs mt-1 opacity-50">对话中生成的文件将显示在此</p>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* File Tabs */}
      <div className="flex items-center border-b bg-muted/30 overflow-x-auto shrink-0">
        {files.map((file) => (
          <button
            key={file.id}
            className={cn(
              "flex items-center gap-1 px-3 py-1.5 text-xs border-r border-b-2 transition-colors shrink-0 max-w-[160px]",
              activeId === file.id
                ? "bg-background border-b-primary text-foreground font-medium"
                : "border-b-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
            onClick={() => handleSelect(file.id)}
          >
            {file.type === "image" ? <Image className="h-3 w-3" /> :
             file.type === "code" ? <Code className="h-3 w-3" /> :
             <FileText className="h-3 w-3" />}
            <span className="truncate">{file.name}</span>
            {file.pinned && <Pin className="h-2.5 w-2.5 text-primary flex-shrink-0" />}
            <button
              className="ml-0.5 hover:bg-muted rounded-sm flex-shrink-0"
              onClick={(e) => { e.stopPropagation(); onCloseFile?.(file.id) }}
            >
              <X className="h-3 w-3" />
            </button>
          </button>
        ))}
        {files.length > 0 && (
          <div className="flex items-center gap-0.5 px-2 ml-auto">
            <button
              className="p-0.5 hover:bg-muted rounded"
              onClick={() => activeFile && onPinFile?.(activeFile.id)}
              title={activeFile?.pinned ? "取消固定" : "固定标签"}
            >
              {activeFile?.pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
            </button>
          </div>
        )}
      </div>

      {/* File Content */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          {activeFile ? (
            <FileContent file={activeFile} />
          ) : (
            <div className="text-center py-8 text-muted-foreground text-sm">
              请选择文件查看
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

/** Render file content based on type */
function FileContent({ file }: { file: ViewerFile }) {
  switch (file.type) {
    case "image":
      return (
        <div className="flex items-center justify-center">
          <img
            src={file.url || file.content}
            alt={file.name}
            className="max-w-full max-h-[60vh] rounded-lg shadow-sm object-contain"
          />
        </div>
      )
    case "code":
    case "json":
      return (
        <pre className="bg-muted rounded-lg p-4 overflow-auto text-xs font-mono leading-relaxed">
          <code>{file.content}</code>
        </pre>
      )
    case "markdown":
      return <MarkdownPreview content={file.content} />
    case "text":
    default:
      return (
        <div className="text-sm whitespace-pre-wrap leading-relaxed text-muted-foreground">
          {file.content}
        </div>
      )
  }
}

/** Simple Markdown preview (inline) */
function MarkdownPreview({ content }: { content: string }) {
  const html = useMemo(() => {
    let html = content
      // Headers
      .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-4 mb-2">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold mt-5 mb-2">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold mt-6 mb-3">$1</h1>')
      // Bold / Italic
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // Inline code
      .replace(/`([^`]+)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-xs font-mono">$1</code>')
      // Code blocks
      .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-muted rounded-lg p-4 overflow-auto text-xs font-mono my-3"><code>$2</code></pre>')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary underline" target="_blank">$1</a>')
      // Lists
      .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-sm">$1</li>')
      .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal text-sm">$1</li>')
      // Tables (basic)
      .replace(/\|(.+)\|/g, (match) => {
        const cells = match.split('|').filter(c => c.trim() && !c.match(/^[-:|\s]+$/))
        if (cells.length === 0) return match
        return '<tr>' + cells.map(c => `<td class="border px-2 py-1 text-sm">${c.trim()}</td>`).join('') + '</tr>'
      })
      // Paragraphs
      .replace(/\n\n/g, '<br/><br/>')
    return html
  }, [content])

  return (
    <div
      className="prose prose-sm max-w-none dark:prose-invert"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
