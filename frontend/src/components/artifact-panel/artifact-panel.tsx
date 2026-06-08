/**
 * ArtifactPanel — 增强型右侧上下文面板
 *
 * Tabs: Agent画像 | 记忆 | 日记 | 结论 | 产物 | 文件变更 | 专家变更 | 文件 | 预览
 * Integrated: AgentProfilePanel, MemoryPanel, DiaryPanel, ConversationInfoPanel, ChangeLogPanel
 */
"use client"

import { useState, useMemo } from "react"
import { cn } from "@/lib/utils"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { FileViewer, type ViewerFile } from "@/components/Chat/FileViewer/FileViewer"
import {
  Package, ListTodo, Bell, FileText, Image, Map, Table,
  BarChart3, FileSpreadsheet, X, Download, Trash2,
  CheckCircle, AlertTriangle, Loader2, GitBranch,
  FolderOpen, Globe, Monitor, Code, ArrowLeft,
  Bot, Brain, BookOpen, Sparkles, History,
} from "lucide-react"
import { useArtifactStore } from "@/store"
import { useChatStore } from "@/store/chatStore"
import { useExpertStore } from "@/store/expertStore"
import { AgentProfilePanel } from "@/components/right-panel/AgentProfilePanel"
import { MemoryPanel } from "@/components/right-panel/MemoryPanel"
import { DiaryPanel } from "@/components/right-panel/DiaryPanel"
import { ConversationInfoPanel } from "@/components/right-panel/ConversationInfoPanel"
import { ChangeLogPanel } from "@/components/right-panel/ChangeLogPanel"
import type { ArtifactType, TaskStatus, NotificationSeverity } from "@/types/artifact"

// ─── Icon maps ───

const ARTIFACT_ICONS: Record<ArtifactType, React.ReactNode> = {
  document: <FileText className="h-4 w-4 text-blue-500" />,
  chart: <BarChart3 className="h-4 w-4 text-green-500" />,
  map: <Map className="h-4 w-4 text-purple-500" />,
  table: <Table className="h-4 w-4 text-orange-500" />,
  image: <Image className="h-4 w-4 text-cyan-500" />,
  video: <Image className="h-4 w-4 text-pink-500" />,
  report: <FileSpreadsheet className="h-4 w-4 text-red-500" />,
}

const TASK_STATUS_BADGE: Record<TaskStatus, { variant: "success" | "default" | "secondary" | "destructive"; label: string }> = {
  pending: { variant: "secondary", label: "等待中" },
  running: { variant: "default", label: "执行中" },
  completed: { variant: "success", label: "已完成" },
  failed: { variant: "destructive", label: "失败" },
  cancelled: { variant: "secondary", label: "已取消" },
}

const NOTIFICATION_SEVERITY_ICONS: Record<NotificationSeverity, React.ReactNode> = {
  info: <Bell className="h-4 w-4 text-blue-500" />,
  warning: <AlertTriangle className="h-4 w-4 text-orange-500" />,
  error: <AlertTriangle className="h-4 w-4 text-red-500" />,
  success: <CheckCircle className="h-4 w-4 text-green-500" />,
}

// ─── View types ───

type PanelTab = "agent" | "memory" | "diary" | "conclusion" | "artifacts" | "changes" | "expert-changes" | "files" | "preview"

// ─── Real data from chatStore — no more mocks ───

// ─── Props ───

interface ArtifactPanelProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
}

// ─── Component ───

export function ArtifactPanel({ open, onOpenChange, className }: ArtifactPanelProps) {
  const {
    artifacts, tasks, notifications, unreadCount,
    removeArtifact, removeTask, removeNotification,
    markNotificationRead, markAllNotificationsRead,
  } = useArtifactStore()

  const { currentSessionId, addChangeLog } = useChatStore()
  const { activeExpertId } = useExpertStore()

  const [panelTab, setPanelTab] = useState<PanelTab>("agent")
  const [panelView, setPanelView] = useState<"main" | "files">("main")
  const [previewUrl, setPreviewUrl] = useState("")
  const [viewerFiles, setViewerFiles] = useState<ViewerFile[]>([])
  const [activeViewerFileId, setActiveViewerFileId] = useState<string>("")

  // Trigger change log callbacks
  const handleMemoryChange = () => {
    if (currentSessionId && activeExpertId) {
      addChangeLog(currentSessionId, {
        id: `cl-${Date.now()}`,
        timestamp: new Date().toISOString(),
        agentId: activeExpertId,
        agentName: activeExpertId,
        changeType: 'memory_updated',
        description: '记忆内容已通过右侧面板手动编辑',
      })
    }
  }

  const handleDiaryChange = () => {
    if (currentSessionId && activeExpertId) {
      addChangeLog(currentSessionId, {
        id: `cl-${Date.now()}`,
        timestamp: new Date().toISOString(),
        agentId: activeExpertId,
        agentName: activeExpertId,
        changeType: 'diary_added',
        description: '新增日记条目',
      })
    }
  }

  const handleConclusionChange = () => {
    if (currentSessionId && activeExpertId) {
      addChangeLog(currentSessionId, {
        id: `cl-${Date.now()}`,
        timestamp: new Date().toISOString(),
        agentId: activeExpertId,
        agentName: activeExpertId,
        changeType: 'conclusion_generated',
        description: '对话结论已更新',
      })
    }
  }

  if (!open) return null

  const runningCount = tasks.filter(t => t.status === "running").length
  const pendingNotifCount = unreadCount

  // ── Convert artifacts to viewer files ──
  const handleOpenFile = (artifact: typeof artifacts[0]) => {
    const existing = viewerFiles.find(f => f.id === artifact.id)
    if (existing) {
      setActiveViewerFileId(artifact.id)
      setPanelView("files")
      return
    }
    const newFile: ViewerFile = {
      id: artifact.id,
      name: artifact.name,
      content: (artifact as any).content || `# ${artifact.name}\n\n${artifact.type} 类型文件`,
      type: artifact.type === "chart" || artifact.type === "report" ? "markdown" :
            artifact.type === "table" ? "code" :
            artifact.type === "image" ? "image" : "text",
      language: artifact.type === "table" ? "json" : undefined,
      url: artifact.previewUrl,
      size: artifact.size,
    }
    setViewerFiles(prev => [...prev, newFile])
    setActiveViewerFileId(artifact.id)
    setPanelView("files")
  }

  const handleCloseViewerFile = (fileId: string) => {
    setViewerFiles(prev => prev.filter(f => f.id !== fileId))
    if (activeViewerFileId === fileId) {
      const remaining = viewerFiles.filter(f => f.id !== fileId)
      setActiveViewerFileId(remaining[0]?.id || "")
    }
  }

  const handlePinViewerFile = (fileId: string) => {
    setViewerFiles(prev => prev.map(f =>
      f.id === fileId ? { ...f, pinned: !f.pinned } : f
    ))
  }

  // ── Tab definitions ──
  const tabDefs: { id: PanelTab; icon: React.ReactNode; label: string; badge?: number }[] = [
    { id: "agent", icon: <Bot className="h-3 w-3" />, label: "专家" },
    { id: "memory", icon: <Brain className="h-3 w-3" />, label: "记忆" },
    { id: "diary", icon: <BookOpen className="h-3 w-3" />, label: "日记" },
    { id: "conclusion", icon: <Sparkles className="h-3 w-3" />, label: "结论" },
    { id: "artifacts", icon: <Package className="h-3 w-3" />, label: "产物", badge: artifacts.length },
    { id: "changes", icon: <GitBranch className="h-3 w-3" />, label: "文件变更" },
    { id: "expert-changes", icon: <History className="h-3 w-3" />, label: "专家变更" },
    { id: "files", icon: <FolderOpen className="h-3 w-3" />, label: "文件" },
  ]

  const activeAgentId = activeExpertId || 'ecomind'

  // ── Render ──

  return (
    <div className={cn("h-full border-l bg-sidebar flex flex-col", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <h2 className="font-semibold text-sm flex items-center gap-1.5">
          {panelView === "files" && activeViewerFileId ? (
            <>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setPanelView("main")}>
                <ArrowLeft className="h-3.5 w-3.5" />
              </Button>
              文件查看
            </>
          ) : (
            <>
              <Package className="h-4 w-4 text-primary" />
              {tabDefs.find(t => t.id === panelTab)?.label || "面板"}
            </>
          )}
        </h2>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onOpenChange?.(false)}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Tab Bar — scrollable for many tabs */}
      {panelView !== "files" && (
        <div className="px-2 pt-2 pb-1 shrink-0 overflow-x-auto">
          <Tabs value={panelTab} onValueChange={(v) => setPanelTab(v as PanelTab)}>
            <TabsList className="w-full h-8 flex-nowrap">
              {tabDefs.map(tab => (
                <TabsTrigger key={tab.id} value={tab.id} className="flex-1 gap-1 text-xs px-1.5">
                  {tab.icon}
                  <span className="hidden xl:inline">{tab.label}</span>
                  {tab.badge ? (
                    <Badge variant="secondary" className="text-[9px] px-1 h-3.5 ml-0.5">{tab.badge}</Badge>
                  ) : null}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      )}

      {/* Content */}
      {panelView === "files" && viewerFiles.length > 0 ? (
        <FileViewer
          files={viewerFiles}
          activeFileId={activeViewerFileId}
          onSelectFile={setActiveViewerFileId}
          onCloseFile={handleCloseViewerFile}
          onPinFile={handlePinViewerFile}
          className="flex-1"
        />
      ) : (
        <>
          {/* ── Agent Profile ── */}
          {panelTab === "agent" && (
            <AgentProfilePanel agentId={activeAgentId} className="flex-1" />
          )}

          {/* ── Memory ── */}
          {panelTab === "memory" && (
            <MemoryPanel agentId={activeAgentId} className="flex-1" onMemoryChange={handleMemoryChange} />
          )}

          {/* ── Diary ── */}
          {panelTab === "diary" && (
            <DiaryPanel agentId={activeAgentId} className="flex-1" onDiaryChange={handleDiaryChange} />
          )}

          {/* ── Conclusion + Files ── */}
          {panelTab === "conclusion" && currentSessionId && (
            <ConversationInfoPanel sessionId={currentSessionId} className="flex-1" onConclusionChange={handleConclusionChange} />
          )}
          {panelTab === "conclusion" && !currentSessionId && (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              请先开始一个对话会话
            </div>
          )}

          {/* ── Artifacts View (original) ── */}
          {panelTab === "artifacts" && (
            <ScrollArea className="flex-1">
              <div className="p-3">
                {/* Tasks sub-section */}
                {tasks.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                      <ListTodo className="h-3 w-3" />
                      任务
                      {runningCount > 0 && <Badge variant="default" className="text-[10px] px-1 h-4">{runningCount}</Badge>}
                    </h3>
                    <div className="space-y-2">
                      {tasks.map((task) => {
                        const badge = TASK_STATUS_BADGE[task.status]
                        return (
                          <div key={task.id} className="p-2.5 rounded-lg border hover:bg-accent transition-colors">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-medium">{task.name}</span>
                              <Badge variant={badge.variant} className="text-[10px] px-1.5 h-4">
                                {task.status === "running" && <Loader2 className="h-2.5 w-2.5 mr-0.5 animate-spin inline" />}
                                {badge.label}
                              </Badge>
                            </div>
                            {(task.status === "running" || task.status === "completed") && (
                              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className={cn("h-full transition-all", task.status === "completed" ? "bg-green-500" : "bg-primary")}
                                  style={{ width: `${task.progress}%` }} />
                              </div>
                            )}
                            {task.errorMessage && <div className="text-[10px] text-destructive mt-1">{task.errorMessage}</div>}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Artifacts sub-section */}
                <h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                  <Package className="h-3 w-3" />
                  产出物
                  {artifacts.length > 0 && <Badge variant="secondary" className="text-[10px] px-1 h-4">{artifacts.length}</Badge>}
                </h3>
                {artifacts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    暂无产出物
                    <div className="text-xs mt-1">对话中生成的文件将显示在这里</div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {artifacts.map((item) => (
                      <div key={item.id}
                        className="flex items-center gap-2.5 p-2.5 rounded-lg border border-transparent hover:border-gray-200 dark:border-gray-800 hover:bg-accent transition-all cursor-pointer group"
                        onClick={() => handleOpenFile(item)}>
                        <div className="flex-shrink-0">{ARTIFACT_ICONS[item.type]}</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate">{item.name}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {item.size ? `${(item.size / 1024).toFixed(1)} KB · ` : ""}
                            {new Date(item.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </div>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="ghost" size="icon" className="h-6 w-6"><Download className="h-3 w-3" /></Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive"
                            onClick={(e) => { e.stopPropagation(); removeArtifact(item.id) }}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Notifications sub-section */}
                {notifications.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                      <Bell className="h-3 w-3" />
                      通知
                      {pendingNotifCount > 0 && <Badge variant="destructive" className="text-[10px] px-1 h-4">{pendingNotifCount}</Badge>}
                    </h3>
                    <div className="space-y-1.5">
                      {pendingNotifCount > 0 && (
                        <Button variant="ghost" size="sm" className="w-full text-xs mb-2" onClick={markAllNotificationsRead}>
                          全部标为已读 ({pendingNotifCount})
                        </Button>
                      )}
                      {notifications.map((item) => (
                        <div key={item.id}
                          className={cn("p-2.5 rounded-lg border cursor-pointer transition-colors",
                            item.read ? "hover:bg-accent" : "bg-primary/5 border-primary/20")}
                          onClick={() => markNotificationRead(item.id)}>
                          <div className="flex items-start gap-2">
                            <div className="mt-0.5 flex-shrink-0">{NOTIFICATION_SEVERITY_ICONS[item.severity]}</div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium">{item.title}</div>
                              <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{item.message}</div>
                              <div className="text-[10px] text-muted-foreground mt-1">
                                {new Date(item.timestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}

          {/* ── File Changes View ── */}
          {panelTab === "changes" && (
            <ScrollArea className="flex-1">
              <div className="p-3">
                <h3 className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1">
                  <GitBranch className="h-3 w-3" />
                  文件变更
                </h3>
                {(() => {
                  const sessions = useChatStore.getState().sessions
                  const currentSession = sessions.find(s => s.id === currentSessionId)
                  const changeLogs = currentSession?.changeLog || []
                  return changeLogs.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      <GitBranch className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      暂无变更
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {changeLogs.map((change) => (
                        <div key={change.id} className="p-2.5 rounded-lg border hover:bg-accent transition-colors">
                          <div className="flex items-center gap-2 mb-1.5">
                            <Code className="h-3.5 w-3.5 text-blue-500" />
                            <span className="text-xs font-medium truncate">
                              {change.changeType === 'skill_added' ? '技能变更' :
                               change.changeType === 'memory_added' ? '记忆变更' :
                               change.changeType === 'conclusion_generated' ? '对话总结' :
                               change.changeType === 'setting_changed' ? '配置变更' :
                               change.changeType === 'memory_updated' ? '记忆更新' :
                               '变更记录'}
                            </span>
                            <span className="text-[10px] text-muted-foreground ml-auto">
                              {new Date(change.timestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          <pre className="text-[10px] font-mono bg-muted rounded p-2 overflow-x-auto whitespace-pre-wrap leading-relaxed text-muted-foreground">
                            {change.description}
                            {change.after ? `\n→ ${change.after}` : ""}
                          </pre>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            </ScrollArea>
          )}

          {/* ── Expert Change Log ── */}
          {panelTab === "expert-changes" && (
            <ChangeLogPanel sessionId={currentSessionId || undefined} agentId={activeAgentId} className="flex-1" />
          )}

          {/* ── Files View (tree) ── */}
          {panelTab === "files" && viewerFiles.length === 0 && (
            <ScrollArea className="flex-1">
              <div className="p-3">
                <h3 className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1">
                  <FolderOpen className="h-3 w-3" />
                  全部文件
                </h3>
                {(() => {
                  const sessions = useChatStore.getState().sessions
                  const currentSession = sessions.find(s => s.id === currentSessionId)
                  const sessionFiles = currentSession?.files || []
                  return sessionFiles.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      <FolderOpen className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      暂无文件
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {sessionFiles.map((file) => (
                        <button
                          key={file.id}
                          className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-xs hover:bg-accent transition-colors"
                          onClick={() => {
                            const newFile: ViewerFile = {
                              id: file.id,
                              name: file.name,
                              content: `# ${file.name}\n\n类型: ${file.type}\n创建: ${file.createdAt}`,
                              type: file.name.endsWith('.md') ? "markdown" : file.name.endsWith('.json') ? "code" : "text",
                              language: file.name.endsWith('.json') ? "json" : undefined,
                            }
                            setViewerFiles(prev => [...prev.filter(f => f.id !== file.id), newFile])
                            setActiveViewerFileId(file.id)
                            setPanelView("files")
                          }}
                        >
                          {file.type === 'uploaded' ? <FileText className="h-3.5 w-3.5 text-blue-500" /> : <Sparkles className="h-3.5 w-3.5 text-green-500" />}
                          <span className="flex-1 text-left truncate">{file.name}</span>
                          <span className="text-[10px] text-muted-foreground flex-shrink-0">
                            {file.type === 'uploaded' ? '上传' : '生成'}
                          </span>
                        </button>
                      ))}
                    </div>
                  )
                })()}
                <div className="text-center py-4 text-muted-foreground text-xs">
                  会话中的文件和产物
                </div>
              </div>
            </ScrollArea>
          )}

          {/* ── Preview View ── */}
          {panelTab === "preview" && (
            <ScrollArea className="flex-1">
              <div className="p-3">
                <h3 className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1">
                  <Globe className="h-3 w-3" />
                  URL 预览
                </h3>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={previewUrl}
                    onChange={(e) => setPreviewUrl(e.target.value)}
                    placeholder="输入 URL..."
                    className="flex-1 h-8 text-xs border rounded px-2 bg-background"
                    onKeyDown={(e) => e.key === 'Enter' && setPreviewUrl(e.currentTarget.value)}
                  />
                  <Button size="sm" variant="secondary" className="h-8 text-xs" onClick={() => {
                    if (previewUrl) {
                      const file: ViewerFile = { id: `preview-${Date.now()}`, name: "预览", content: previewUrl, type: "text", url: previewUrl }
                      setViewerFiles(prev => [...prev, file])
                      setActiveViewerFileId(file.id)
                      setPanelView("files")
                    }
                  }}>
                    <Monitor className="h-3 w-3 mr-1" />打开
                  </Button>
                </div>
                {!previewUrl && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    <Globe className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    输入网页地址进行预览
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </>
      )}
    </div>
  )
}

