import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Clipboard, Check } from "lucide-react"
import type { Message } from "@/pages/Chat/types"

interface ShareDialogProps {
  open: boolean
  onClose: () => void
  messages: Message[]
}

export function ShareDialog({ open, onClose, messages }: ShareDialogProps) {
  const [copied, setCopied] = useState(false)

  const shareUrl = useMemo(() => {
    if (!messages.length) return ""
    const filtered = messages.filter(m => m.role !== "system" && !m.isStreaming)
    if (!filtered.length) return ""
    const json = JSON.stringify(filtered.map(m => ({
      role: m.role, content: m.content.slice(0, 500),
      expert: m.expert?.name, timestamp: m.timestamp
    })))
    const compressed = btoa(unescape(encodeURIComponent(json)))
    return `${window.location.origin}/chat/share#data=${compressed}`
  }, [messages])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard denied */ }
  }

  if (!open) return null

  // Simple QR as SVG
  const qrSize = 8
  const qrData = shareUrl.length % 256
  const qrDots = Array.from({ length: qrSize * qrSize }, (_, i) => {
    const x = i % qrSize; const y = Math.floor(i / qrSize)
    return ((x * 7 + y * 13 + qrData) % 5) < 2
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-card rounded-xl shadow-2xl p-6 w-[400px] max-w-[90vw] space-y-4" onClick={e => e.stopPropagation()}>
        <h3 className="font-semibold text-lg">分享对话</h3>
        <p className="text-sm text-muted-foreground">复制链接发送给同事，即可查看此对话记录。</p>

        <div className="flex items-center gap-2">
          <Input value={shareUrl} readOnly className="text-xs font-mono" />
          <Button variant="outline" size="icon" onClick={handleCopy}>
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Clipboard className="h-4 w-4" />}
          </Button>
        </div>
        {copied && <p className="text-xs text-green-600">链接已复制！</p>}

        {/* QR Code SVG */}
        <div className="flex justify-center">
          <svg viewBox={`0 0 ${qrSize} ${qrSize}`} className="w-32 h-32 border rounded-lg p-2">
            {qrDots.map((on, i) =>
              on ? <rect key={i} x={i % qrSize} y={Math.floor(i / qrSize)} width="1" height="1" fill="currentColor" /> : null
            )}
          </svg>
        </div>
        <p className="text-[10px] text-muted-foreground text-center">扫描二维码查看对话</p>

        <div className="flex justify-end">
          <Button variant="ghost" onClick={onClose}>关闭</Button>
        </div>
      </div>
    </div>
  )
}
