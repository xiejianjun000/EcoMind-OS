import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { X } from "lucide-react"

interface SlidePanelProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

export function SlidePanel({ open, onClose, title, children }: SlidePanelProps) {
  return (
    <>
      {/* Backdrop */}
      {open && <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />}
      {/* Panel */}
      <div className={cn(
        "fixed top-0 right-0 h-full w-[340px] max-w-[85vw] z-50 bg-card border-l shadow-2xl transition-transform duration-300 flex flex-col",
        open ? "translate-x-0" : "translate-x-full"
      )}>
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
          <h3 className="font-semibold text-sm">{title}</h3>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-4">{children}</div>
        </ScrollArea>
      </div>
    </>
  )
}

/** Simple list item for panels */
export function PanelItem({ icon, title, desc, onClick }: { icon: string; title: string; desc?: string; onClick?: () => void }) {
  return (
    <div
      className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted cursor-pointer transition-colors", onClick && "cursor-pointer")}
      onClick={onClick}
    >
      <span className="text-xl shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{title}</p>
        {desc && <p className="text-xs text-muted-foreground truncate">{desc}</p>}
      </div>
    </div>
  )
}
