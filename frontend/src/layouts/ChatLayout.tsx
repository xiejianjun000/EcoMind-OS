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
      {/* Left Sidebar — Experts + Team + Skills + Connectors */}
      <Sidebar
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
        className={cn(
          "transition-all duration-300 ease-in-out flex-shrink-0",
          sidebarOpen ? "w-[280px]" : "w-[48px]"
        )}
      />

      {/* Main Chat Area — Messages + Input */}
      <main className="flex-1 flex flex-col min-w-0">
        <Outlet />
      </main>

      {/* Right Artifact Panel — Artifacts + Tasks + Notifications + Preview + Status */}
      <ArtifactPanel
        open={artifactPanelOpen}
        onOpenChange={setArtifactPanelOpen}
        className={cn(
          "transition-all duration-300 ease-in-out flex-shrink-0",
          artifactPanelOpen ? "w-[320px]" : "w-[40px]"
        )}
      />
    </div>
  )
}
