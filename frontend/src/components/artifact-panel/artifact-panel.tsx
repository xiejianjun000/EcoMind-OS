"use client"

import { cn } from "@/lib/utils"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import {
  Package,
  ListTodo,
  Bell,
  FileText,
  Image,
  Map,
  Table,
  X,
  Download,
  Trash2,
} from "lucide-react"

interface ArtifactPanelProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
}

export function ArtifactPanel({ open, onOpenChange, className }: ArtifactPanelProps) {
  if (!open) return null

  return (
    <div className={cn("h-full border-l bg-background flex flex-col", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="font-semibold">产物面板</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onOpenChange?.(false)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="artifacts" className="flex-1 flex flex-col">
        <div className="px-4 pt-2">
          <TabsList className="w-full">
            <TabsTrigger value="artifacts" className="flex-1 gap-1">
              <Package className="h-3 w-3" />
              产物
            </TabsTrigger>
            <TabsTrigger value="tasks" className="flex-1 gap-1">
              <ListTodo className="h-3 w-3" />
              任务
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex-1 gap-1">
              <Bell className="h-3 w-3" />
              通知
            </TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="flex-1">
          <TabsContent value="artifacts" className="mt-0 p-4">
            <ArtifactList />
          </TabsContent>

          <TabsContent value="tasks" className="mt-0 p-4">
            <TaskList />
          </TabsContent>

          <TabsContent value="notifications" className="mt-0 p-4">
            <NotificationList />
          </TabsContent>
        </ScrollArea>
      </Tabs>
    </div>
  )
}

interface Artifact {
  id: string
  name: string
  type: "document" | "image" | "map" | "table"
  size?: string
  updatedAt: string
}

const artifacts: Artifact[] = [
  { id: "1", name: "湘江流域分析报告.pdf", type: "document", size: "2.5MB", updatedAt: "刚刚" },
  { id: "2", name: "水质趋势图.png", type: "image", size: "1.2MB", updatedAt: "10分钟前" },
  { id: "3", name: "湖南省3D地图.html", type: "map", size: "3.5MB", updatedAt: "30分钟前" },
  { id: "4", name: "监测站点数据.xlsx", type: "table", size: "500KB", updatedAt: "1小时前" },
  { id: "5", name: "合规检查清单.docx", type: "document", size: "150KB", updatedAt: "2小时前" },
]

function ArtifactList() {
  const getIcon = (type: Artifact["type"]) => {
    switch (type) {
      case "document":
        return <FileText className="h-4 w-4 text-blue-500" />
      case "image":
        return <Image className="h-4 w-4 text-green-500" />
      case "map":
        return <Map className="h-4 w-4 text-purple-500" />
      case "table":
        return <Table className="h-4 w-4 text-orange-500" />
    }
  }

  return (
    <div className="space-y-2">
      <div className="text-sm text-muted-foreground mb-4">
        共 {artifacts.length} 个产物
      </div>
      {artifacts.map((artifact) => (
        <div
          key={artifact.id}
          className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors cursor-pointer group"
        >
          {getIcon(artifact.type)}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{artifact.name}</div>
            <div className="text-xs text-muted-foreground">
              {artifact.size} · {artifact.updatedAt}
            </div>
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <Download className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive">
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}

interface Task {
  id: string
  title: string
  status: "in_progress" | "completed" | "pending"
  progress?: number
}

const tasks: Task[] = [
  { id: "1", title: "生成周报", status: "in_progress", progress: 65 },
  { id: "2", title: "数据同步", status: "completed" },
  { id: "3", title: "模型推理", status: "pending" },
]

function TaskList() {
  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <div
          key={task.id}
          className="p-3 rounded-lg border"
        >
          <div className="flex items-center gap-2 mb-2">
            <Badge
              variant={
                task.status === "completed"
                  ? "success"
                  : task.status === "in_progress"
                  ? "default"
                  : "secondary"
              }
              className="text-xs"
            >
              {task.status === "completed"
                ? "已完成"
                : task.status === "in_progress"
                ? "进行中"
                : "待处理"}
            </Badge>
            <span className="text-sm font-medium">{task.title}</span>
          </div>
          {task.status === "in_progress" && task.progress !== undefined && (
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${task.progress}%` }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

interface Notification {
  id: string
  title: string
  description: string
  type: "approval" | "alert" | "info"
  time: string
}

const notifications: Notification[] = [
  {
    id: "1",
    title: "审批请求",
    description: "某企业排污许可申请需要您审批",
    type: "approval",
    time: "5分钟前",
  },
  {
    id: "2",
    title: "异常告警",
    description: "湘江流域某监测站点数据异常",
    type: "alert",
    time: "15分钟前",
  },
  {
    id: "3",
    title: "系统通知",
    description: "周报生成任务已完成",
    type: "info",
    time: "1小时前",
  },
]

function NotificationList() {
  const getIcon = (type: Notification["type"]) => {
    switch (type) {
      case "approval":
        return <FileText className="h-4 w-4 text-blue-500" />
      case "alert":
        return <Bell className="h-4 w-4 text-red-500" />
      case "info":
        return <Bell className="h-4 w-4 text-muted-foreground" />
    }
  }

  return (
    <div className="space-y-3">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className="p-3 rounded-lg border hover:bg-accent transition-colors cursor-pointer"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5">{getIcon(notification.type)}</div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">{notification.title}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {notification.description}
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                {notification.time}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
