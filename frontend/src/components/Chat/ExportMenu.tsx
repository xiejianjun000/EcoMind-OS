import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Share2, Download, Clipboard, Link2 } from "lucide-react"
import type { Message } from "@/pages/Chat/types"
import { ShareDialog } from "./ShareDialog"

interface ExportMenuProps {
  messages: Message[]
  disabled?: boolean
}

function formatToMarkdown(messages: Message[], expertName?: string): string {
  const now = new Date().toLocaleString("zh-CN")
  let md = `# EcoMind OS 对话记录\n> 导出时间: ${now}\n`
  if (expertName) md += `> 专家: ${expertName}\n`
  md += `\n---\n\n`
  for (const msg of messages) {
    if (msg.role === "system") continue
    const role = msg.role === "user" ? "用户" : (msg.expert?.name || "AI 助手")
    md += `**${role}** (${msg.timestamp}):\n\n${msg.content}\n\n`
    if (msg.envData?.aqi) {
      const aqi = msg.envData.aqi
      md += `> 📡 ${msg.envData.city} AQI: **${aqi.aqi}** ${aqi.level} | ${aqi.primaryPollutant}\n`
      md += `> PM2.5: ${aqi.pm25} | PM10: ${aqi.pm10} | O₃: ${aqi.o3} | NO₂: ${aqi.no2}\n`
      md += `> 🌡${aqi.temperature}°C 💧${aqi.humidity}% 💨${aqi.wind}\n\n`
    }
    md += `---\n\n`
  }
  md += `\n> 由 EcoMind OS 生态主控生成\n`
  return md
}

function formatToText(messages: Message[]): string {
  let text = "EcoMind OS 对话记录\n" + "=".repeat(40) + "\n\n"
  for (const msg of messages) {
    if (msg.role === "system") continue
    const role = msg.role === "user" ? "用户" : (msg.expert?.name || "AI 助手")
    text += `[${msg.timestamp}] ${role}:\n${msg.content}\n`
    if (msg.envData?.aqi) {
      text += `  📡 ${msg.envData.city} AQI: ${msg.envData.aqi.aqi} (${msg.envData.aqi.level})\n`
    }
    text += "\n" + "-".repeat(40) + "\n\n"
  }
  return text
}

export function ExportMenu({ messages, disabled }: ExportMenuProps) {
  const [showShare, setShowShare] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2000) }

  const handleExportMarkdown = () => {
    const expert = messages.find(m => m.expert)?.expert?.name
    const md = formatToMarkdown(messages, expert)
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    const ts = new Date().toISOString().slice(0, 16).replace("T", "-")
    a.href = url; a.download = `EcoMind-对话-${ts}.md`; a.click()
    URL.revokeObjectURL(url)
    showToast("Markdown 已下载")
  }

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(formatToText(messages))
      showToast("已复制到剪贴板")
    } catch { showToast("复制失败") }
  }

  const isEmpty = !messages.length || messages.every(m => m.role === "system")

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" disabled={disabled || isEmpty} title={isEmpty ? "暂无对话内容" : "导出/分享"}>
            <Share2 className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={handleExportMarkdown}>
            <Download className="h-4 w-4 mr-2" />导出 Markdown
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleCopyText}>
            <Clipboard className="h-4 w-4 mr-2" />复制全文
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowShare(true)}>
            <Link2 className="h-4 w-4 mr-2" />生成分享链接
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ShareDialog open={showShare} onClose={() => setShowShare(false)} messages={messages} />
      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-foreground text-background px-4 py-2 rounded-lg text-sm shadow-lg">
          {toast}
        </div>
      )}
    </>
  )
}
