"use client"

import { useState, useCallback, lazy, Suspense } from "react"
import { Outlet, useLocation } from "react-router-dom"
import { cn } from "@/lib/utils"
import { Sidebar } from "@/components/Sidebar/sidebar"
import { ContextPanel, type ContextPanelView } from "@/components/right-panel/context-panel"
import { FilePreviewModal } from "@/components/FilePreview/FilePreviewModal"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import type { KnowledgeFile } from "@/services/knowledgeService"

const SettingsSheetContent = lazy(() => import("@/components/Settings/SettingsSheetContent"))

/** Shared context for child routes (Chat page) */
export interface ChatLayoutContext {
  sidebarOpen: boolean
  toggleSidebar: () => void
  contextPanelOpen: boolean
  contextPanelView: ContextPanelView
  setContextPanelView: (view: ContextPanelView) => void
  toggleContextPanel: () => void
  settingsOpen: boolean
  onOpenSettings: () => void
}

export function ChatLayout({ className }: { className?: string }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [contextPanelOpen, setContextPanelOpen] = useState(false)
  const [contextPanelView, setContextPanelView] = useState<ContextPanelView>("case")
  const [previewFile, setPreviewFile] = useState<KnowledgeFile | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const toggleSidebar = useCallback(() => setSidebarOpen((p) => !p), [])
  const toggleContextPanel = useCallback(() => setContextPanelOpen((p) => !p), [])
  const openSettings = useCallback(() => setSettingsOpen(true), [])

  const ctx: ChatLayoutContext = {
    sidebarOpen, toggleSidebar,
    contextPanelOpen, contextPanelView, setContextPanelView, toggleContextPanel,
    settingsOpen, onOpenSettings: openSettings,
  }

  return (
    <div className={cn("flex h-screen bg-background overflow-hidden", className)}>
      {/* ── LEFT: Navigation Sidebar ── */}
      <Sidebar
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
        onFileClick={setPreviewFile}
        onOpenSettings={openSettings}
        onContextPanelOpen={(view) => {
          setContextPanelView(view as ContextPanelView)
          setContextPanelOpen(true)
        }}
        contextPanelOpen={contextPanelOpen}
        className={cn(
          "h-full flex-shrink-0 transition-all duration-300 ease-in-out border-r",
          sidebarOpen ? "w-[280px]" : "w-[56px]"
        )}
      />

      {/* ── CENTER: Chat Flow ── */}
      <main className="flex-1 flex flex-col min-w-0 h-full">
        <Outlet context={ctx} />
      </main>

      {/* ── RIGHT: Context Panel ── */}
      <ContextPanel
        open={contextPanelOpen}
        view={contextPanelView}
        onViewChange={setContextPanelView}
        onOpenChange={setContextPanelOpen}
        className={cn(
          "h-full flex-shrink-0 transition-all duration-300 ease-in-out border-l",
          contextPanelOpen ? "w-[360px]" : "w-0 overflow-hidden border-l-0"
        )}
      />

      {/* ── Modals ── */}
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
