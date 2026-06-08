"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  FileText,
  CheckSquare,
  Bell,
  PanelRightClose,
  PanelRightOpen,
  Eye,
  Activity,
  GitCompare,
  Wifi,
  WifiOff,
} from "lucide-react"
import { useTheme } from "@/providers/ThemeProvider"
import { useArtifactStore } from "@/store/artifactStore"
import { useExpertStore } from "@/store/expertStore"
import ArtifactList from "./ArtifactList"
import TaskList from "./TaskList"
import NotificationList from "./NotificationList"

interface ArtifactPanelProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
}

export function ArtifactPanel({ open, onOpenChange, className }: ArtifactPanelProps) {
  const { theme } = useTheme()
  const { panelTab, panelCollapsed, setPanelTab, togglePanel, unreadCount } = useArtifactStore()
  const { experts, connectors } = useExpertStore()
  const isDark = theme === "dark"

  // Count online experts
  const onlineExperts = experts.filter(e => e.status === 'online').length
  const connectedConnectors = connectors.filter(c => c.status === 'connected').length

  if (panelCollapsed || !open) {
    return (
      <div
        className="flex-shrink-0 h-full flex flex-col items-center py-4 border-l bg-sidebar"
        style={{ width: 40 }}
      >
        <button
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-accent mb-4 text-muted-foreground"
          onClick={() => onOpenChange?.(true) || togglePanel()}
          title="展开面板"
        >
          <PanelRightOpen className="h-4 w-4" />
        </button>
        <TabIcon icon={<FileText className="h-4 w-4" />} active={panelTab === 'artifacts'} onClick={() => { setPanelTab('artifacts'); togglePanel() }} />
        <TabIcon icon={<CheckSquare className="h-4 w-4" />} active={panelTab === 'tasks'} onClick={() => { setPanelTab('tasks'); togglePanel() }} />
        <TabIcon icon={<Bell className="h-4 w-4" />} active={panelTab === 'notifications'} onClick={() => { setPanelTab('notifications'); togglePanel() }} badge={unreadCount > 0 ? unreadCount : undefined} />
        <TabIcon icon={<Eye className="h-4 w-4" />} active={panelTab === 'preview'} onClick={() => { setPanelTab('preview'); togglePanel() }} />
        <TabIcon icon={<Activity className="h-4 w-4" />} active={panelTab === 'status'} onClick={() => { setPanelTab('status'); togglePanel() }} />
      </div>
    )
  }

  return (
    <aside
      className={cn("flex-shrink-0 h-full flex flex-col border-l bg-sidebar", className)}
      style={{ width: 320 }}
    >
      {/* Tab Header */}
      <div className="flex items-center justify-between px-2 py-2 flex-shrink-0 border-b">
        <Tabs value={panelTab} onValueChange={(v) => setPanelTab(v as any)} className="w-full">
          <TabsList className="h-8 p-0.5 bg-transparent">
            <TabsTrigger value="artifacts" className="h-7 text-[11px] px-2 gap-1">
              <FileText className="h-3 w-3" />
              产物
            </TabsTrigger>
            <TabsTrigger value="tasks" className="h-7 text-[11px] px-2 gap-1">
              <CheckSquare className="h-3 w-3" />
              任务
            </TabsTrigger>
            <TabsTrigger value="notifications" className="h-7 text-[11px] px-2 gap-1 relative">
              <Bell className="h-3 w-3" />
              通知
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-3.5 h-3.5 px-0.5 rounded-full bg-red-500 text-white text-[8px] flex items-center justify-center">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="preview" className="h-7 text-[11px] px-2 gap-1">
              <Eye className="h-3 w-3" />
              预览
            </TabsTrigger>
            <TabsTrigger value="status" className="h-7 text-[11px] px-2 gap-1">
              <Activity className="h-3 w-3" />
              状态
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 ml-1 flex-shrink-0"
          onClick={() => onOpenChange?.(false) || togglePanel()}
        >
          <PanelRightClose className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Tab Content */}
      <ScrollArea className="flex-1">
        {panelTab === 'artifacts' && <ArtifactList />}
        {panelTab === 'tasks' && <TaskList />}
        {panelTab === 'notifications' && <NotificationList />}
        {panelTab === 'preview' && <PreviewPanel />}
        {panelTab === 'status' && <StatusPanel onlineExperts={onlineExperts} totalExperts={experts.length} connectedConnectors={connectedConnectors} totalConnectors={connectors.length} />}
      </ScrollArea>
    </aside>
  )
}

// ============================================================
// Tab Icon (collapsed mode)
// ============================================================

function TabIcon({ icon, active, onClick, badge }: { icon: React.ReactNode; active: boolean; onClick: () => void; badge?: number }) {
  return (
    <button
      className={cn(
        "relative w-8 h-8 flex items-center justify-center rounded-lg mb-2 transition-colors",
        active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50"
      )}
      onClick={onClick}
    >
      {icon}
      {badge !== undefined && (
        <span className="absolute -top-0.5 -right-0.5 min-w-3.5 h-3.5 px-0.5 rounded-full bg-red-500 text-white text-[8px] flex items-center justify-center">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  )
}

// ============================================================
// Preview Panel (新增：文件预览)
// ============================================================

function PreviewPanel() {
  return (
    <div className="p-3 space-y-3">
      <div className="text-xs font-medium text-muted-foreground">文件预览</div>
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Eye className="h-8 w-8 text-muted-foreground/40 mb-2" />
        <p className="text-xs text-muted-foreground">暂无预览内容</p>
        <p className="text-[10px] text-muted-foreground/60 mt-1">
          当专家生成文件时，将在此处显示预览
        </p>
      </div>

      {/* Recent changes (placeholder) */}
      <div className="border-t pt-2">
        <div className="text-[10px] font-medium text-muted-foreground flex items-center gap-1 mb-2">
          <GitCompare className="h-3 w-3" />
          最近变更
        </div>
        <div className="text-[10px] text-muted-foreground/60 text-center py-3">
          暂无变更记录
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Status Panel (新增：Agent 存活检测)
// ============================================================

function StatusPanel({ onlineExperts, totalExperts, connectedConnectors, totalConnectors }: {
  onlineExperts: number
  totalExperts: number
  connectedConnectors: number
  totalConnectors: number
}) {
  const { experts, connectors } = useExpertStore()

  return (
    <div className="p-3 space-y-3">
      {/* Overview */}
      <div className="grid grid-cols-2 gap-2">
        <div className="p-2 rounded-lg border bg-accent/30 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Activity className="h-3 w-3 text-green-500" />
            <span className="text-xs font-medium">专家</span>
          </div>
          <div className="text-lg font-bold">
            <span className="text-green-500">{onlineExperts}</span>
            <span className="text-muted-foreground text-sm">/{totalExperts}</span>
          </div>
          <div className="text-[9px] text-muted-foreground">在线</div>
        </div>
        <div className="p-2 rounded-lg border bg-accent/30 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Wifi className="h-3 w-3 text-blue-500" />
            <span className="text-xs font-medium">连接器</span>
          </div>
          <div className="text-lg font-bold">
            <span className="text-blue-500">{connectedConnectors}</span>
            <span className="text-muted-foreground text-sm">/{totalConnectors}</span>
          </div>
          <div className="text-[9px] text-muted-foreground">已连接</div>
        </div>
      </div>

      {/* Expert Status List */}
      <div className="border-t pt-2">
        <div className="text-[10px] font-medium text-muted-foreground mb-2">专家状态</div>
        <div className="space-y-1">
          {experts.map((expert) => (
            <div key={expert.id} className="flex items-center gap-2 px-1 py-0.5">
              <div className={cn(
                "h-2 w-2 rounded-full flex-shrink-0",
                expert.status === 'online' ? "bg-green-500" :
                expert.status === 'busy' ? "bg-yellow-500" :
                expert.status === 'error' ? "bg-red-500" : "bg-gray-400"
              )} />
              <span className="text-[11px] flex-1 truncate">{expert.displayName}</span>
              <Badge variant="outline" className="text-[8px] h-3 px-1 font-mono">
                {expert.safetyLevel}
              </Badge>
            </div>
          ))}
        </div>
      </div>

      {/* Connector Status List */}
      <div className="border-t pt-2">
        <div className="text-[10px] font-medium text-muted-foreground mb-2">连接器状态</div>
        <div className="space-y-1">
          {connectors.map((conn) => (
            <div key={conn.id} className="flex items-center gap-2 px-1 py-0.5">
              {conn.status === 'connected' ? (
                <Wifi className="h-3 w-3 text-green-500 flex-shrink-0" />
              ) : (
                <WifiOff className="h-3 w-3 text-red-500 flex-shrink-0" />
              )}
              <span className="text-[11px] flex-1 truncate">{conn.name}</span>
              <span className={cn(
                "text-[9px]",
                conn.status === 'connected' ? "text-green-500" : "text-red-500"
              )}>
                {conn.status === 'connected' ? '已连接' : '断开'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
