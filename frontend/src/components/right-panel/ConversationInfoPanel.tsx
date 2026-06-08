/**
 * ConversationInfoPanel — 对话结论 + 文件追踪
 * 展示当前会话的 AI 生成结论 + 上传/生成的文件列表
 */
"use client"

import { useState, useMemo } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  FileText, Download, Trash2, Sparkles, Check, X, Pencil,
  FolderOpen, Paperclip, Image, Table, BarChart3, Map, File,
  Clock,
} from "lucide-react"
import { useChatStore } from "@/store/chatStore"
import { cn } from "@/lib/utils"
import type { SessionFile } from "@/types/chat"

interface ConversationInfoPanelProps {
  sessionId: string
  className?: string
  onConclusionChange?: () => void
}

const FILE_TYPE_ICONS: Record<string, React.ReactNode> = {
  'document': <FileText className="h-3.5 w-3.5 text-blue-500" />,
  'chart': <BarChart3 className="h-3.5 w-3.5 text-green-500" />,
  'map': <Map className="h-3.5 w-3.5 text-purple-500" />,
  'table': <Table className="h-3.5 w-3.5 text-orange-500" />,
  'image': <Image className="h-3.5 w-3.5 text-cyan-500" />,
}

function getFileType(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) return 'image'
  if (['csv', 'xlsx', 'xls'].includes(ext)) return 'table'
  if (['md', 'txt', 'docx', 'pdf'].includes(ext)) return 'document'
  return 'document'
}

function formatSize(bytes?: number): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

export function ConversationInfoPanel({ sessionId, className, onConclusionChange }: ConversationInfoPanelProps) {
  const {
    sessions, setSessionConclusion,
    addSessionFile, removeSessionFile, addMessageFile,
  } = useChatStore()

  const session = sessions.find(s => s.id === sessionId)
  const [editingConclusion, setEditingConclusion] = useState(false)
  const [editedText, setEditedText] = useState("")

  // Get all files from session and messages
  const allFiles = useMemo(() => {
    const sf = session?.files || []
    return sf
  }, [session?.files])

  const uploadedFiles = allFiles.filter(f => f.type === 'uploaded')
  const generatedFiles = allFiles.filter(f => f.type === 'generated')

  const handleEditConclusion = () => {
    setEditedText(session?.conclusion || '')
    setEditingConclusion(true)
  }

  const handleSaveConclusion = () => {
    if (editedText.trim()) {
      setSessionConclusion(sessionId, editedText.trim())
      onConclusionChange?.()
    }
    setEditingConclusion(false)
  }

  const handleRemoveFile = (fileId: string) => {
    removeSessionFile(sessionId, fileId)
  }

  return (
    <ScrollArea className={cn("h-full", className)}>
      <div className="p-3 space-y-4">
        {/* ── Conclusion Section ── */}
        <div>
          <h4 className="text-[11px] font-semibold flex items-center gap-1 mb-2">
            <Sparkles className="h-3 w-3 text-yellow-500" />
            对话结论
          </h4>

          {session?.conclusionGeneratedAt && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-2">
              <Clock className="h-2.5 w-2.5" />
              生成于 {new Date(session.conclusionGeneratedAt).toLocaleString('zh-CN')}
            </div>
          )}

          {editingConclusion ? (
            <div className="space-y-2">
              <Textarea
                value={editedText}
                onChange={e => setEditedText(e.target.value)}
                className="min-h-[80px] text-xs"
                placeholder="输入对话结论摘要..."
                autoFocus
              />
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditingConclusion(false)}>
                  <X className="h-3 w-3 mr-1" />取消
                </Button>
                <Button size="sm" className="h-7 text-xs" onClick={handleSaveConclusion}>
                  <Check className="h-3 w-3 mr-1" />保存
                </Button>
              </div>
            </div>
          ) : session?.conclusion ? (
            <div className="relative group p-2.5 rounded-lg border bg-muted/30">
              <p className="text-xs leading-relaxed">{session.conclusion}</p>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100"
                onClick={handleEditConclusion}
              >
                <Pencil className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground text-sm">
              <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-30" />
              暂无结论
              <div className="text-xs mt-1">对话结束后 AI 将自动生成</div>
              <Button variant="outline" size="sm" className="mt-2 h-7 text-xs" onClick={handleEditConclusion}>
                <Pencil className="h-3 w-3 mr-1" />手动添加
              </Button>
            </div>
          )}
        </div>

        <Separator />

        {/* ── Files Section ── */}
        <div>
          <h4 className="text-[11px] font-semibold flex items-center gap-1 mb-2">
            <FolderOpen className="h-3 w-3 text-blue-500" />
            对话文件 ({allFiles.length})
          </h4>

          {allFiles.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              <File className="h-8 w-8 mx-auto mb-2 opacity-30" />
              暂无文件
              <div className="text-xs mt-1">上传或由 AI 生成的文件将显示在此</div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Uploaded files */}
              {uploadedFiles.length > 0 && (
                <div>
                  <h5 className="text-[10px] text-muted-foreground mb-1.5 flex items-center gap-1">
                    <Paperclip className="h-2.5 w-2.5" />
                    上传文件 ({uploadedFiles.length})
                  </h5>
                  <div className="space-y-1">
                    {uploadedFiles.map(f => (
                      <FileItem key={f.id} file={f} onRemove={() => handleRemoveFile(f.id)} />
                    ))}
                  </div>
                </div>
              )}

              {/* Generated files */}
              {generatedFiles.length > 0 && (
                <div>
                  <h5 className="text-[10px] text-muted-foreground mb-1.5 flex items-center gap-1">
                    <Sparkles className="h-2.5 w-2.5" />
                    AI 生成文件 ({generatedFiles.length})
                  </h5>
                  <div className="space-y-1">
                    {generatedFiles.map(f => (
                      <FileItem key={f.id} file={f} onRemove={() => handleRemoveFile(f.id)} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </ScrollArea>
  )
}

function FileItem({ file, onRemove }: { file: SessionFile; onRemove: () => void }) {
  const iconMap = FILE_TYPE_ICONS
  const type = file.mimeType?.startsWith('image/') ? 'image' : getFileType(file.name)

  return (
    <div className="flex items-center gap-2 p-2 rounded-lg border hover:bg-accent transition-colors group">
      <div className="shrink-0">
        {iconMap[type] || iconMap['document']}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{file.name}</p>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {file.size !== undefined && <span>{formatSize(file.size)}</span>}
          <Badge variant="outline" className="text-[9px] px-1 h-3.5">
            {file.type === 'uploaded' ? '上传' : 'AI生成'}
          </Badge>
          <span>{new Date(file.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>
      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 shrink-0">
        <Button variant="ghost" size="icon" className="h-6 w-6">
          <Download className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={onRemove}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}
