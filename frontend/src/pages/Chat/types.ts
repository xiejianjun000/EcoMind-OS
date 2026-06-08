import type { CityAQI, StationInfo, WaterQuality } from "@/services/envDataService"

export interface EnvDataCard {
  type: 'aqi' | 'water' | 'stations'
  city: string
  aqi?: CityAQI
  waterQuality?: WaterQuality[]
  stations?: StationInfo[]
  /** 是否为县级市（数据来自所属地级市监测站） */
  isCounty?: boolean
}

// ─── Tool Call Types ───────────────────────────────────────────

export interface ToolCallResult {
  summary: string
  data?: any
  error?: string | null
  duration_ms: number
}

export interface ToolCallMessage {
  id: string
  type: 'tool_call'
  toolName: string
  toolLabel: string
  status: 'pending' | 'running' | 'success' | 'error' | 'pending_confirmation'
  params?: Record<string, any>
  result?: ToolCallResult
  requireHumanConfirm?: boolean
  auditId?: string
  timestamp: string
}

export interface Message {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  expert?: { id: string; name: string }
  timestamp: string
  isStreaming?: boolean
  envData?: EnvDataCard
  /** 关联的工具调用记录 */
  toolCalls?: ToolCallMessage[]
  /** 工具详情展开状态（UI内部状态，不持久化） */
  _toolDetailExpanded?: boolean
}
