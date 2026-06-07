"use client"

import { useState, useCallback, lazy, Suspense } from "react"
import { Outlet, useLocation } from "react-router-dom"
import { cn } from "@/lib/utils"
import { Sidebar } from "@/components/Sidebar/sidebar"
import { ArtifactPanel } from "@/components/artifact-panel/artifact-panel"
import { FilePreviewModal } from "@/components/FilePreview/FilePreviewModal"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import type { KnowledgeFile } from "@/services/knowledgeService"

const SettingsSheetContent = lazy(() => import("@/components/Settings/SettingsSheetContent"))

export function ChatLayout({ className }: { className?: string }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [artifactPanelOpen, setArtifactPanelOpen] = useState(false)
  const [previewFile, setPreviewFile] = useState<KnowledgeFile | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const location = useLocation()

  const isChatRoute = location.pathname.startsWith("/chat/") || location.pathname === "/chat"
  const showArtifactPanel = artifactPanelOpen && isChatRoute

  const toggleSidebar = useCallback(() => setSidebarOpen((prev) => !prev), [])
  const toggleArtifactPanel = useCallback(() => setArtifactPanelOpen((prev) => !prev), [])
  const openSettings = useCallback(() => setSettingsOpen(true), [])

  const ctx = { sidebarOpen, toggleSidebar, artifactPanelOpen, toggleArtifactPanel, isChatRoute, settingsOpen, onOpenSettings: openSettings }

  return (
    <div className={cn("flex h-screen bg-background", className)}>
      <Sidebar
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
        onFileClick={setPreviewFile}
        onOpenSettings={openSettings}
        className={cn("transition-all duration-300 ease-in-out", sidebarOpen ? "w-[280px]" : "w-[60px]")}
      />
      <main className="flex-1 flex flex-col min-w-0">
        <Outlet context={ctx} />
      </main>
      <ArtifactPanel
        open={showArtifactPanel}
        onOpenChange={setArtifactPanelOpen}
        className={cn("transition-all duration-300 ease-in-out", showArtifactPanel ? "w-[380px]" : "w-[0px] overflow-hidden")}
      />
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
