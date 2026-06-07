/**
 * ChatCanvas — 对话内嵌白板 (WorkBuddy excalidraw-preview-component 对应)
 *
 * 渲染在 ChatPage 消息流中，AI 生成流程图/布点图/示意图时
 * 用户可直接在对话里编辑，不需要跳转独立页面。
 */
"use client"

import React, { useState, useEffect, useCallback, lazy, Suspense } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Maximize2,
  Minimize2,
  Download,
  RotateCcw,
  PenTool,
  Loader2,
} from "lucide-react"

// ─── 动态加载 Excalidraw (按需，不影响首屏) ───
const Excalidraw = lazy(() =>
  import("@excalidraw/excalidraw").then(m => ({ default: m.Excalidraw }))
)

// ─── Props ───

export interface ChatCanvasProps {
  /** 初始元素数据 (Excalidraw JSON) */
  initialData?: { elements: any[]; appState?: any }
  /** 画布标题 */
  title?: string
  /** 画布高度 */
  height?: number
  /** 是否只读 (仅预览) */
  readOnly?: boolean
  /** 元素变更回调 */
  onChange?: (elements: any[]) => void
  /** 容器 className */
  className?: string
}

// ─── 默认空画布 ───

const EMPTY_CANVAS = {
  elements: [],
  appState: { viewBackgroundColor: "#ffffff" },
}

// ─── 组件 ───

export const ChatCanvas: React.FC<ChatCanvasProps> = ({
  initialData = EMPTY_CANVAS,
  title = "白板",
  height = 400,
  readOnly = false,
  onChange,
  className,
}) => {
  const [expanded, setExpanded] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [key, setKey] = useState(0) // 用于重置

  const handleChange = useCallback(
    (data: any) => {
      if (data?.elements && onChange) {
        onChange(data.elements)
      }
    },
    [onChange]
  )

  const handleReset = () => {
    setKey(k => k + 1)
  }

  const handleDownload = () => {
    // Excalidraw 导出由内部 API 处理，这里提供回退
    const svg = document.querySelector(".excalidraw-wrapper svg")
    if (svg) {
      const blob = new Blob([svg.outerHTML], { type: "image/svg+xml" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${title || "canvas"}-${Date.now()}.svg`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-gray-200 dark:border-gray-800 bg-card overflow-hidden transition-all duration-300",
        expanded && "fixed inset-4 z-50 shadow-2xl",
        className
      )}
      style={expanded ? undefined : { height }}
    >
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30 shrink-0">
        <div className="flex items-center gap-2">
          <PenTool className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{title}</span>
          {readOnly && (
            <Badge variant="secondary" className="text-[10px]">
              仅预览
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleReset} title="重置">
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleDownload} title="下载 SVG">
            <Download className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setExpanded(!expanded)}
            title={expanded ? "收起" : "放大"}
          >
            {expanded ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* 画布 */}
      <div
        className="excalidraw-wrapper"
        style={{ height: expanded ? "calc(100% - 41px)" : height - 41 }}
      >
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-full bg-muted/10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          }
        >
          {loadError ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              白板引擎加载失败
            </div>
          ) : (
            <Excalidraw
              key={key}
              initialData={initialData}
              onChange={handleChange}
              UIOptions={{
                canvasActions: {
                  loadScene: false,
                  saveToActiveFile: false,
                  export: { saveFileToDisk: true },
                  changeViewBackgroundColor: true,
                },
              }}
            />
          )}
        </Suspense>
      </div>
    </div>
  )
}

export default ChatCanvas
