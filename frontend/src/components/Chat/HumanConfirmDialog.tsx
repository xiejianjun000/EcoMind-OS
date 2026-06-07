/**
 * HumanConfirmDialog — L3 人工确认对话框
 *
 * 当 Agent 请求执行 L3 级别敏感操作时弹出，
 * 展示操作详情，等待用户确认或拒绝。
 */
"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ShieldAlert, AlertTriangle } from "lucide-react"
import { getToolLabel, getToolIcon } from "@/services/toolService"

interface HumanConfirmDialogProps {
  open: boolean
  toolName: string
  toolParams?: Record<string, any>
  auditId?: string
  onConfirm: () => void
  onReject: () => void
}

export function HumanConfirmDialog({
  open,
  toolName,
  toolParams,
  auditId,
  onConfirm,
  onReject,
}: HumanConfirmDialogProps) {
  const icon = getToolIcon(toolName)
  const label = getToolLabel(toolName)

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
              <ShieldAlert className="h-4 w-4 text-amber-600" />
            </div>
            <DialogTitle className="text-base">操作确认</DialogTitle>
          </div>
          <DialogDescription className="pt-2">
            <Badge variant="destructive" className="mb-2">L3 · 执法督察级</Badge>
            <p className="text-sm mt-2">
              AI 助手请求执行以下敏感操作，根据 L3 安全策略需要您的人工确认：
            </p>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
            <span className="text-lg">{icon}</span>
            <div>
              <div className="font-medium text-sm">{label}</div>
              <div className="text-xs text-muted-foreground">工具名称: {toolName}</div>
            </div>
          </div>

          {toolParams && Object.keys(toolParams).length > 0 && (
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-foreground">操作参数</div>
              <div className="p-2 rounded bg-muted/50 text-xs font-mono max-h-32 overflow-y-auto">
                {JSON.stringify(toolParams, null, 2)}
              </div>
            </div>
          )}

          {auditId && (
            <div className="text-[10px] text-muted-foreground">
              审计ID: {auditId}
            </div>
          )}

          <div className="flex items-center gap-2 p-2 rounded bg-amber-50 dark:bg-amber-950 text-xs text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-3 w-3 flex-shrink-0" />
            <span>此操作将被记录到审计日志中。确认即表示您已审核并批准此操作。</span>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onReject}>
            拒绝
          </Button>
          <Button variant="default" onClick={onConfirm} className="bg-amber-600 hover:bg-amber-700">
            确认执行
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
