import { Calendar as CalendarIcon, Clock } from "lucide-react"

export default function CalendarPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
        <CalendarIcon className="h-8 w-8 text-muted-foreground" />
      </div>
      <div>
        <h1 className="text-xl font-semibold">日历</h1>
        <p className="text-sm text-muted-foreground mt-1">环境监测任务调度 · 会议管理 · 执法排班</p>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg">
        <Clock className="h-3.5 w-3.5" />
        日历功能即将上线
      </div>
    </div>
  )
}
