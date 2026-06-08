/**
 * EcoMind OS Tool Service — 工具调用客户端
 *
 * 提供 executeTool / confirmTool / listTools 等前端调用接口。
 * 与后端 POST /api/tools/execute 对接。
 */
import type { ToolCallResult } from "@/pages/Chat/types"

const TOOLS_BASE = "/api/tools"

export interface ToolExecuteRequest {
  tool_name: string
  tool_params: Record<string, any>
  expert_id?: string
  safety_level?: string
  user_id?: string
}

export interface ToolExecuteResponse {
  tool_name: string
  status: "success" | "error" | "pending_confirmation"
  data?: any
  summary: string
  error?: string | null
  duration_ms: number
  require_human_confirm?: boolean
  audit_id?: string | null
}

/** 执行工具调用 */
export async function executeTool(req: ToolExecuteRequest): Promise<ToolExecuteResponse> {
  const res = await fetch(`${TOOLS_BASE}/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as any).detail || `工具调用失败: HTTP ${res.status}`)
  }
  return res.json()
}

/** 人工确认 / 拒绝 L3 操作 */
export async function confirmTool(auditId: string, confirmed: boolean): Promise<void> {
  const params = new URLSearchParams({ audit_id: auditId, confirmed: String(confirmed) })
  const res = await fetch(`${TOOLS_BASE}/confirm?${params}`, { method: "POST" })
  if (!res.ok) throw new Error(`确认失败: HTTP ${res.status}`)
}

/** 获取所有可用工具清单 */
export async function listTools(): Promise<Array<{
  name: string; description: string; safety_level: string; color: string
}>> {
  const res = await fetch(`${TOOLS_BASE}/list`)
  const data = await res.json()
  return data.tools || []
}

// ─── 前端友好的工具显示名 ──────────────────────────────────────

export const TOOL_LABELS: Record<string, string> = {
  env_query: "环境数据查询",
  regulation_search: "法规检索",
  report_generate: "报告生成",
  case_search: "案例检索",
  map_visualize: "地图可视化",
  alert_check: "告警查询",
  document_parse: "文档解析",
  compliance_check: "合规校验",
  data_analyze: "数据分析",
  dispatch_expert: "专家调度",
  knowledge_query: "知识库查询",
  skill_execute: "技能执行",
  // 代码开发工具
  code_read: "代码阅读",
  code_edit: "代码编辑",
  code_write: "代码写入",
  shell_exec: "Shell 执行",
  git_status: "Git 状态",
  git_commit: "Git 提交",
  // 多模态分析
  image_analyze: "图片分析",
  video_analyze: "视频分析",
  voice_transcribe: "语音转写",
  document_ocr: "文档OCR",
}

export const TOOL_ICONS: Record<string, string> = {
  env_query: "📡",
  regulation_search: "⚖️",
  report_generate: "📄",
  case_search: "📁",
  map_visualize: "🗺️",
  alert_check: "🚨",
  document_parse: "📎",
  compliance_check: "✅",
  data_analyze: "📊",
  dispatch_expert: "👥",
  knowledge_query: "📚",
  skill_execute: "🔧",
  // 代码开发工具
  code_read: "📖",
  code_edit: "✏️",
  code_write: "📝",
  shell_exec: "💻",
  git_status: "🔍",
  git_commit: "📦",
  // 多模态分析
  image_analyze: "🖼️",
  video_analyze: "🎬",
  voice_transcribe: "🎙️",
  document_ocr: "📄",
}

export function getToolLabel(toolName: string): string {
  return TOOL_LABELS[toolName] || toolName
}

export function getToolIcon(toolName: string): string {
  return TOOL_ICONS[toolName] || "🔧"
}

// ─── Tool Call → 结果摘要生成 ─────────────────────────────────

export function summarizeToolResult(toolName: string, data: any): string {
  switch (toolName) {
    case "env_query": {
      const d = data?.data || data
      if (d?.aqi) {
        const parts = [`${d.city || "—"} AQI ${d.aqi}（${d.level || "—"}）`]
        if (d.primary_pollutant) parts.push(`首要污染物 ${d.primary_pollutant}`)
        if (d.pm25 != null) parts.push(`PM2.5 ${d.pm25}`)
        if (d.pm10 != null) parts.push(`PM10 ${d.pm10}`)
        if (d.o3 != null) parts.push(`O₃ ${d.o3}`)
        if (d.no2 != null) parts.push(`NO₂ ${d.no2}`)
        if (d.so2 != null) parts.push(`SO₂ ${d.so2}`)
        if (d.co != null) parts.push(`CO ${d.co}`)
        return parts.join("，")
      }
      if (d?.cities && Array.isArray(d.cities)) {
        return `${d.cities.length}个城市数据：${d.cities.map((c: any) => `${c.city||""}AQI${c.aqi||"—"}`).join("、")}`
      }
      return `${data?.city || d?.city || "—"} 环境数据获取完成`
    }
    case "regulation_search":
      return `找到 ${data?.results_count || 0} 条匹配法规`
    case "report_generate":
      return `报告已生成：${data?.title || "—"}（ID: ${data?.report_id || "—"}）`
    case "alert_check":
      return `当前活跃告警 ${data?.count ?? 0} 条`
    case "dispatch_expert":
      return `已调度专家 ${data?.expert_id || "—"}（子会话: ${data?.sub_session_id || "—"}）`
    case "code_read":
      return data?.exists
        ? `读取 ${data.file_path}（${data.lines} 行${data.truncated ? "，已截断" : ""}）`
        : `文件 ${data?.file_path || "—"} 不存在`
    case "code_edit":
      return data?.status === "diff_generated"
        ? `生成 diff 预览：${data.file_path}`
        : `编辑失败：${data?.reason || "未知错误"}`
    case "code_write":
      return data?.status === "preview"
        ? `新文件预览：${data.file_path}（${data.content_lines} 行）`
        : `${data?.reason || "写入预览"}`
    case "shell_exec":
      return data?.status === "completed"
        ? `命令执行完成（exit ${data.exit_code}）`
        : `${data?.reason || "命令已执行"}`
    case "git_status":
      return `当前分支：${data?.branch || "—"}，${data?.status || "clean"}`
    case "git_commit":
      return data?.status === "preview"
        ? `提交预览：${data.branch_name} — "${data.commit_message}"`
        : data?.status === "no_changes"
          ? "没有待提交的变更"
          : `${data?.reason || "提交预览"}`
    case "image_analyze":
      return data?.dimensions
        ? `图片分析完成：${data.dimensions.width}x${data.dimensions.height}${data.environment_analysis ? `，植被 ${data.environment_analysis.vegetation_pct}%` : ""}`
        : "图片分析完成"
    case "video_analyze":
      return data?.metadata
        ? `视频分析：${data.metadata.duration_seconds}秒，${data.frames_extracted || 0}帧提取`
        : "视频分析完成"
    case "voice_transcribe":
      if (data?.transcription)
        return `语音转写完成：${data.transcription_length}字符`
      return data?.method === "ffmpeg_analysis"
        ? "音频特征已提取（需安装 Whisper 进行完整转写）"
        : "语音处理完成"
    case "document_ocr":
      return data?.ocr_text
        ? `OCR 完成：识别 ${data.ocr_text_length} 字符`
        : "OCR 处理完成"
    default:
      return data?.summary || `${toolName} 执行完成`
  }
}
