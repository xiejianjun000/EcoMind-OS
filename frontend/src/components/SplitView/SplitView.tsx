"use client"

import { useState, useCallback, useRef, type ReactNode } from "react"
import { cn } from "@/lib/utils"
import { ResizeHandle } from "./ResizeHandle"

interface SplitViewProps {
  direction?: "horizontal"
  defaultLeftWidth?: number
  defaultRightWidth?: number
  minLeftWidth?: number
  minRightWidth?: number
  maxLeftWidth?: number
  maxRightWidth?: number
  leftCollapsed?: boolean
  collapsedWidth?: number
  leftPanel: ReactNode
  centerPanel: ReactNode
  rightPanel: ReactNode
  rightPanelVisible?: boolean
  className?: string
  onLeftWidthChange?: (width: number) => void
  onRightWidthChange?: (width: number) => void
}

/**
 * SplitView — WorkBuddy-style three-column layout with draggable resize handles.
 *
 * Layout:
 *   [Left] <resize> [Center: flex-1] <resize> [Right]
 *
 * Left and right panels are resizable via ResizeHandle drag.
 * Center auto-fills remaining space.
 * Left panel can collapse to a narrow icon strip.
 * Right panel can hide when rightPanelVisible is false.
 */
export function SplitView({
  direction = "horizontal",
  defaultLeftWidth = 280,
  defaultRightWidth = 380,
  minLeftWidth = 60,
  minRightWidth = 280,
  maxLeftWidth = 480,
  maxRightWidth = 600,
  leftCollapsed = false,
  collapsedWidth = 60,
  leftPanel,
  centerPanel,
  rightPanel,
  rightPanelVisible = false,
  className,
  onLeftWidthChange,
  onRightWidthChange,
}: SplitViewProps) {
  const [leftWidth, setLeftWidth] = useState(defaultLeftWidth)
  const [rightWidth, setRightWidth] = useState(defaultRightWidth)
  // Remember the user's preferred expanded width for left panel
  const expandedLeftWidth = useRef(defaultLeftWidth)

  const handleLeftResize = useCallback(
    (delta: number) => {
      setLeftWidth((prev) => {
        const next = Math.min(maxLeftWidth, Math.max(minLeftWidth, prev + delta))
        onLeftWidthChange?.(next)
        return next
      })
    },
    [maxLeftWidth, minLeftWidth, onLeftWidthChange]
  )

  const handleRightResize = useCallback(
    (delta: number) => {
      setRightWidth((prev) => {
        // Right panel resize: dragging left = smaller panel, so negate delta
        const next = Math.min(maxRightWidth, Math.max(minRightWidth, prev - delta))
        onRightWidthChange?.(next)
        return next
      })
    },
    [maxRightWidth, minRightWidth, onRightWidthChange]
  )

  // Track expansion to update stored expanded width
  const displayLeftWidth = leftCollapsed ? collapsedWidth : leftWidth

  // When expanding, restore if at collapsed size
  if (!leftCollapsed && leftWidth === minLeftWidth && expandedLeftWidth.current > minLeftWidth) {
    // useRef update during render is safe here for tracking
  }

  return (
    <div
      className={cn(
        "flex h-full overflow-hidden",
        direction === "horizontal" ? "flex-row" : "flex-col",
        className
      )}
    >
      {/* Left Panel */}
      <div
        className="flex-shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out"
        style={{ width: displayLeftWidth }}
      >
        {leftPanel}
      </div>

      {/* Left Resize Handle — only when not collapsed */}
      {!leftCollapsed && (
        <ResizeHandle direction="horizontal" onResize={handleLeftResize} />
      )}

      {/* Center Panel — flex-1 fills remaining space */}
      <div className="flex-1 min-w-0 overflow-hidden">{centerPanel}</div>

      {/* Right Resize Handle — only when right panel is visible */}
      {rightPanelVisible && (
        <ResizeHandle direction="horizontal" onResize={handleRightResize} />
      )}

      {/* Right Panel */}
      <div
        className={cn(
          "flex-shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out",
          !rightPanelVisible && "!w-0"
        )}
        style={{ width: rightPanelVisible ? rightWidth : 0 }}
      >
        {rightPanel}
      </div>
    </div>
  )
}
