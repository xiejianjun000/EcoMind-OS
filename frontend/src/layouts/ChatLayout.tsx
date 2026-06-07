"use client"

import { useState, useCallback, lazy, Suspense } from "react"
import { Outlet } from "react-router-dom"
import { cn } from "@/lib/utils"
import { SessionSidebar } from "@/components/Sidebar/session-sidebar"
import { ContextPanel } from "@/components/right-panel/context-panel"
import { FilePreviewModal } from "@/components/FilePreview/FilePreviewModal"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import type { KnowledgeFile } from "@/services/knowledgeService"

const SettingsSheetContent = lazy(() => import("@/components/Settings/SettingsSheetContent"))

/**
 * ChatLayout — 三面板布局（对标 Trae Solo 四层模型）
 *
 * Layer 1: SessionSidebar    — 会话列表 + 专家切换  (~280px, 可折叠为 56px)
 * Layer 2: Editor Area       — 对话流 + 输入框       (flex-1, 唯一焦点)
 * Layer 3: ContextPanel      — 自动上下文面板         (~360px, 可关闭)
 *
 * 层间规则（对标 Trae）:
 *   - 每层独立，互不控制
 *   - Sidebar 折叠/展开不影响 ContextPanel
 *   - ContextPanel 的内容由 Editor 自动驱动（通过 ChatPage 的 context 事件）
 *   - 不手动切换 ContextPanel Tab
 */
export interface ChatLayoutContext {
  sidebarOpen: boolean
  toggleSidebar: () => void
  contextPanelOpen: boolean
  toggleContextPanel: () => void
  settingsOpen: boolean
  onOpenSettings: () => void
  /** Editor 通知 ContextPanel 更新上下文 */
  setContextData: (data: ContextData) => void
}

export interface ContextData {
  type: "case" | "regulation" | "monitor" | "empty"
  payload?: any
  title?: string
}

export function ChatLayout({ className }: { className?: string }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [contextPanelOpen, setContextPanelOpen] = useState(false)
  const [contextData, setContextData] = useState<ContextData>({ type: "empty" })
  const [previewFile, setPreviewFile] = useState<KnowledgeFile | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const toggleSidebar = useCallback(() => setSidebarOpen((p) => !p), [])
  const toggleContextPanel = useCallback(() => setContextPanelOpen((p) => !p), [])
  const openSettings = useCallback(() => setSettingsOpen(true), [])

  const ctx: ChatLayoutContext = {
    sidebarOpen, toggleSidebar,
    contextPanelOpen, toggleContextPanel,
    settingsOpen, onOpenSettings: openSettings,
    setContextData,
  }

  return (
    <div className={cn("flex h-screen bg-background overflow-hidden", className)}>
      {/* Layer 1: Session + Expert Sidebar */}
      <SessionSidebar
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
        onFileClick={setPreviewFile}
        onOpenSettings={openSettings}
        className={cn(
          "h-full flex-shrink-0 transition-all duration-200 ease-out border-r",
          sidebarOpen ? "w-[280px]" : "w-[52px]"
        )}
      />

      {/* Layer 2: Editor Area — 唯一的焦点 */}
      <main className="flex-1 flex flex-col min-w-0 h-full">
        <Outlet context={ctx} />
      </main>

      {/* Layer 3: Context Panel — 自动上下文，不可手动切 Tab */}
      <ContextPanel
        open={contextPanelOpen}
        data={contextData}
        onOpenChange={setContextPanelOpen}
        className={cn(
          "h-full flex-shrink-0 bg-sidebar border-l transition-all duration-200 ease-out",
          contextPanelOpen ? "w-[360px]" : "w-0 overflow-hidden border-l-0"
        )}
      />

      {/* Modals */}
      <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent side="right" className="w-[700px] max-w-[95vw] p-0">
          <SheetHeader className="border-b px-6 py-4"><SheetTitle>设置</SheetTitle></SheetHeader>
          <Suspense fallback={<div className="flex items-center justify-center h-64 text-muted-foreground text-sm">加载中...</div>}>
            <SettingsSheetContent />
          </Suspense>
        </SheetContent>
      </Sheet>
    </div>
  )
}
