"use client"

import { useCallback, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"

interface ResizeHandleProps {
  direction: "horizontal" | "vertical"
  onResize: (delta: number) => void
  className?: string
  disabled?: boolean
}

/**
 * ResizeHandle — draggable divider between two SplitView panes.
 * Horizontal (for vertical splits between side panel | content): ew-resize cursor, 4px width.
 * Vertical (for horizontal splits): ns-resize cursor, 4px height.
 */
export function ResizeHandle({ direction, onResize, className, disabled }: ResizeHandleProps) {
  const isDragging = useRef(false)
  const startPos = useRef(0)

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return
      e.preventDefault()
      isDragging.current = true
      startPos.current = direction === "horizontal" ? e.clientX : e.clientY
      document.body.style.cursor = direction === "horizontal" ? "col-resize" : "row-resize"
      document.body.style.userSelect = "none"
    },
    [direction, disabled]
  )

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      const currentPos = direction === "horizontal" ? e.clientX : e.clientY
      const delta = currentPos - startPos.current
      startPos.current = currentPos
      onResize(delta)
    }

    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false
        document.body.style.cursor = ""
        document.body.style.userSelect = ""
      }
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [direction, onResize])

  return (
    <div
      className={cn(
        "group relative flex-shrink-0 z-10",
        direction === "horizontal"
          ? "w-1.5 -mx-[3px] cursor-col-resize hover:bg-primary/20 active:bg-primary/30 transition-colors"
          : "h-1.5 -my-[3px] cursor-row-resize hover:bg-primary/20 active:bg-primary/30 transition-colors",
        className
      )}
      onMouseDown={handleMouseDown}
    >
      {/* Visible center line on hover */}
      <div
        className={cn(
          "absolute bg-primary/0 group-hover:bg-primary/30 group-active:bg-primary/50 transition-all rounded-full",
          direction === "horizontal"
            ? "inset-y-0 left-1/2 w-[3px] -translate-x-1/2"
            : "inset-x-0 top-1/2 h-[3px] -translate-y-1/2"
        )}
      />
    </div>
  )
}
