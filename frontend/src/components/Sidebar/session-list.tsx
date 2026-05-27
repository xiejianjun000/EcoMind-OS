"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { ChevronDown, ChevronRight, CheckCircle2, Circle } from "lucide-react"

interface Session {
  id: string
  title: string
  updatedAt: string
  completed?: boolean
}

interface Workspace {
  id: string
  name: string
  sessions: Session[]
}

const workspaces: Workspace[] = [
  {
    id: "ecomind",
    name: "EcoMind OS",
    sessions: [
      { id: "1", title: "没理解我的需求...", updatedAt: "刚刚", completed: true },
      { id: "2", title: "湘江流域水质分析", updatedAt: "10分钟前" },
      { id: "3", title: "排污许可预检", updatedAt: "1小时前" },
    ],
  },
  {
    id: "vi",
    name: "VI 项目",
    sessions: [
      { id: "4", title: "品牌设计讨论", updatedAt: "昨天" },
    ],
  },
]

export function SessionList() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    ecomind: true,
    vi: false,
  })

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="space-y-2">
      {workspaces.map((workspace) => (
        <div key={workspace.id}>
          <button
            onClick={() => toggleExpanded(workspace.id)}
            className="flex items-center gap-2 w-full px-2 py-1.5 text-sm font-medium hover:bg-accent rounded-md transition-colors"
          >
            {expanded[workspace.id] ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="flex-1 text-left truncate">{workspace.name}</span>
            <span className="text-xs text-muted-foreground">
              {workspace.sessions.length}
            </span>
          </button>
          {expanded[workspace.id] && (
            <div className="ml-4 mt-1 space-y-1">
              {workspace.sessions.map((session) => (
                <SessionItem key={session.id} session={session} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

interface SessionItemProps {
  session: Session
}

function SessionItem({ session }: SessionItemProps) {
  return (
    <button className="flex items-center gap-2 w-full p-2 rounded-md hover:bg-accent transition-colors text-left group">
      {session.completed ? (
        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
      ) : (
        <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm truncate group-hover:text-foreground">
          {session.title}
        </div>
        <div className="text-xs text-muted-foreground">{session.updatedAt}</div>
      </div>
    </button>
  )
}
