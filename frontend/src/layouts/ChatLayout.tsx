"use client"

import { useState } from "react"
import { Outlet } from "react-router-dom"
import { cn } from "@/lib/utils"
import { Sidebar } from "@/components/sidebar/sidebar"
import { ArtifactPanel } from "@/components/artifact-panel/artifact-panel"

interface ChatLayoutProps {
  className?: string
}

export function ChatLayout({ className }: ChatLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [artifactPanelOpen, setArtifactPanelOpen] = useState(true)

  return (
    <div className={cn("flex h-screen bg-background", className)}>
      {/* Left Sidebar */}
      <Sidebar
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
        className={cn(
          "transition-all duration-300 ease-in-out",
          sidebarOpen ? "w-[280px]" : "w-[60px]"
        )}
      />

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col min-w-0">
        <Outlet />
      </main>

      {/* Right Artifact Panel */}
      <ArtifactPanel
        open={artifactPanelOpen}
        onOpenChange={setArtifactPanelOpen}
        className={cn(
          "transition-all duration-300 ease-in-out",
          artifactPanelOpen ? "w-[320px]" : "w-[0px] overflow-hidden"
        )}
      />
    </div>
  )
}
