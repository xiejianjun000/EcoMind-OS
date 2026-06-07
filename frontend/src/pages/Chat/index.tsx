"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useParams, useNavigate, useOutletContext } from "react-router-dom"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Send,
  Sparkles,
  Wrench,
  Plug,
  BookOpen,
  Search,
  ThumbsUp,
  Clipboard,
  Volume2,
  MoreHorizontal,
  Zap,
  ZapOff,
  Monitor,
  Map,
  Globe,
  Paperclip,
  Folder,
  Users,
  Check,
} from "lucide-react"
import { chatStream, isApiKeyConfigured } from "@/services/deepseek"
import { getCityAQI, getCityStations, getCityWaterQuality, getCityCoordinates, getAllCities, resolveCity, type CityAQI } from "@/services/envDataService"
import { getKnowledgeSummary, searchKnowledgeFiles, readKnowledgeFile } from "@/services/knowledgeService"
import { getToolLabel, getToolIcon, summarizeToolResult, listTools } from "@/services/toolService"
import ChatMapEmbed from "@/components/ChatMap/ChatMapEmbed"
import ForecastChart from "@/components/Chat/ForecastChart"
import MarkdownRenderer from "@/components/Chat/MarkdownRenderer"
import { ExportMenu } from "@/components/Chat/ExportMenu"
import { VoiceInputButton, speakText, stopSpeaking } from "@/components/Chat/VoiceInputButton"
import { SlidePanel, PanelItem } from "@/components/Chat/SlidePanel"
import { ChatTopBar } from "@/components/ChatTopBar/ChatTopBar"
import { ModelStatusBadge } from "@/components/Chat/ModelStatusBadge"
import { ToolCallMessage } from "@/components/Chat/ToolCallMessage"
import { HumanConfirmDialog } from "@/components/Chat/HumanConfirmDialog"
import { AgentStatusBar } from "@/components/AgentStatus/AgentStatusBar"
import { useChatStore } from "@/store/chatStore"
import { useArtifactStore } from "@/store/artifactStore"
import { useExpertStore } from "@/store/expertStore"
import type { Message, EnvDataCard, ToolCallMessage as ToolCallMsg } from "./types"
import type { SessionFile, ChangeLogEntry, ChatMessage } from "@/types/chat"

const EXPERT_MAP: Record<string, { id: string; name: string }> = {
  ecomind: { id: "ecomind", name: "助手" },
  "env-monitoring": { id: "env-monitoring", name: "环境监测专家" },
  enforcement: { id: "enforcement", name: "执法监察专家" },
  eia: { id: "eia", name: "环评审批专家" },
  permit: { id: "permit", name: "排污许可专家" },
  biodiversity: { id: "biodiversity", name: "生物多样性专家" },
  carbon: { id: "carbon", name: "碳排放专家" },
  emergency: { id: "emergency", name: "应急管理专家" },
  restoration: { id: "restoration", name: "生态修复专家" },
  inspection: { id: "inspection", name: "生态督察专家" },
  public: { id: "public", name: "公众服务专家" },
  water: { id: "water", name: "水资源专家" },
}

const WORKSPACES = ["生态环境监测", "执法监察", "环评项目", "应急管理"]

export default function ChatPage() {
  const params = useParams()
  const navigate = useNavigate()
  const chatStore = useChatStore()
  const { addArtifact, addTask, updateTaskProgress, completeTask, addNotification } = useArtifactStore()
  const { experts } = useExpertStore()
  // ChatLayout Outlet context — sidebar/panel state from WorkBuddy layout
  const outletCtx = useOutletContext<{ sidebarOpen: boolean; toggleSidebar: () => void; artifactPanelOpen: boolean; toggleArtifactPanel: () => void; isChatRoute: boolean; onOpenSettings: () => void }>()
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState("")
  const [selectedExpert, setSelectedExpert] = useState("ecomind")
  const [isLoading, setIsLoading] = useState(false)
  const [apiStatus, setApiStatus] = useState(isApiKeyConfigured())
  const [lastError, setLastError] = useState<string | null>(null)
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [activePanel, setActivePanel] = useState<string | null>(null)
  const [attachedFiles, setAttachedFiles] = useState<Array<{ file: File; status: 'idle' | 'uploading' | 'done' | 'error'; serverPath?: string }>>([])
  const [uploadedFilePaths, setUploadedFilePaths] = useState<Record<string, string>>({})
  const [workspace, setWorkspace] = useState("生态环境监测")
  const [toolCalls, setToolCalls] = useState<ToolCallMsg[]>([])
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean; toolName: string; params?: Record<string, any>; auditId?: string;
    onConfirm: () => void; onReject: () => void;
  }>({ open: false, toolName: '', onConfirm: () => {}, onReject: () => {} })
  const [panelDataLoading, setPanelDataLoading] = useState(false)
  const [toolsList, setToolsList] = useState<Array<{ name: string; description: string; safety_level: string; color: string }>>([])
  const [skillsList, setSkillsList] = useState<Array<{ id: string; name: string; description: string; category: string }>>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const toolTaskMap = useRef<Record<string, string>>({})
  const abortRef = useRef<(() => void) | null>(null)
  const lastUserMessageRef = useRef<string>("")
  const activeSessionIdRef = useRef<string | null>(null)
  const knowledgeSummaryRef = useRef<string>("")

  // Handle session switching via URL params
  useEffect(() => {
    const sid = params.sessionId || null
    // Only switch if sessionId actually changed
    if (sid === activeSessionIdRef.current) return

    activeSessionIdRef.current = sid
    if (sid) {
      chatStore.setCurrentSession(sid)
      const session = chatStore.sessions[sid]
      // 恢复专家选择
      if (session?.expertId) {
        setSelectedExpert(session.expertId)
      }
      const stored = chatStore.messages[sid]
      if (stored && stored.length > 0) {
        setMessages(stored.map((m: ChatMessage) => ({
          id: m.id, role: m.role as "user" | "assistant", content: m.content,
          timestamp: m.timestamp || new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
          expert: m.expert ? { id: m.expert.id, name: m.expert.name } : undefined,
          isStreaming: false,
        })))
      } else {
        setMessages([])
        setToolCalls([])
      }
    }
  }, [params.sessionId])
  const _chunkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const _chunkBufferRef = useRef<string>('')

  // cleanup pending setTimeout
  useEffect(() => {
    return () => {
      if (_chunkTimerRef.current) {
        clearTimeout(_chunkTimerRef.current)
        _chunkTimerRef.current = null
      }
    }
  }, [])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => { scrollToBottom() }, [messages, scrollToBottom])

  // messages sync: persist to chatStore on every change

  // 💾 消息变化时同步写入 chatStore（持久化到 localStorage）
  useEffect(() => {
    const sid = activeSessionIdRef.current
    if (!sid || messages.length === 0) return
    const existing = chatStore.messages[sid]
    if (existing && existing.length === messages.length) {
      const lastExisting = existing[existing.length - 1]
      const lastLocal = messages[messages.length - 1]
      if (lastExisting?.content === lastLocal.content && !!lastExisting.isStreaming === !!lastLocal.isStreaming) return
    }
    const chatMsgs: ChatMessage[] = messages.map(m => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
      expert: m.expert ? { id: m.expert.id, name: m.expert.name } : undefined,
      isStreaming: !!m.isStreaming,
    }))
    chatStore.setSessionMessages(sid, chatMsgs)
  }, [messages])

  // 📚 预加载资料库摘要
  useEffect(() => {
    getKnowledgeSummary().then(summary => {
      knowledgeSummaryRef.current = summary
    }).catch(() => {})
  }, [])

  // Periodic API status check
  useEffect(() => {
    const interval = setInterval(() => setApiStatus(isApiKeyConfigured()), 3000)
    return () => clearInterval(interval)
  }, [])

  // 面板数据：打开时从后端获取最新工具/技能清单
  useEffect(() => {
    if (activePanel === 'tools' && toolsList.length === 0) {
      setPanelDataLoading(true)
      listTools().then(setToolsList).catch(() => {}).finally(() => setPanelDataLoading(false))
    }
    if (activePanel === 'skills' && skillsList.length === 0) {
      setPanelDataLoading(true)
      fetch('/api/skills/list').then(r => r.json()).then(d => {
        setSkillsList(d.skills || d.installed || [])
      }).catch(() => {}).finally(() => setPanelDataLoading(false))
    }
  }, [activePanel])

  // Network status monitor
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Search keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setIsSearchOpen(true)
      }
      if (e.key === 'Escape' && isSearchOpen) {
        setIsSearchOpen(false)
        setSearchQuery("")
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isSearchOpen])

  // Filter messages by search query
  const filteredMessages = searchQuery.trim()
    ? messages.filter(m =>
        m.role !== "system" &&
        m.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : messages

  const handleSend = async (retryContent?: string) => {
    const content = (retryContent || inputValue).trim()
    if (!content || isLoading) return

    setLastError(null)
    if (!retryContent) {
      setInputValue("")
    }
    lastUserMessageRef.current = content

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
      timestamp: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
    }

    const assistantId = (Date.now() + 1).toString()
    const expert = EXPERT_MAP[selectedExpert] || EXPERT_MAP.ecomind

    // Detect city names in user query for real data injection
    const detectedCities = detectCities(userMsg.content)

    const assistantMsg: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      expert,
      timestamp: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
      isStreaming: true,
    }

    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setInputValue("")
    setIsLoading(true)
    // 安全兜底：120 秒后强制清除 loading，防止 SSE 连接异常时永久"思考中"
    const safetyTimer = setTimeout(() => {
      console.warn('[Chat] 安全兜底：120秒未收到 onDone/onError，强制清除 loading')
      setIsLoading(false)
      setLastError('响应超时（SSE 连接可能断开），请刷新页面重试')
    }, 120_000)
    if (attachedFiles.length > 0) {
      setAttachedFiles([])
    }

    // 🔗 联动：确保会话存在于 chatStore 中
    let sessionId = activeSessionIdRef.current
    if (!sessionId) {
      const title = content.length > 20 ? content.slice(0, 20) + '...' : content
      sessionId = chatStore.createSession({ title, expertId: selectedExpert, expertName: expert.name })
      activeSessionIdRef.current = sessionId
      // 不要把 navigate 放在这里 —— 会导致组件重挂载、流式连接断开
      // URL 更新延迟到 onDone 回调中
    } else {
      // 更新已有会话的元数据
      const title = content.length > 20 ? content.slice(0, 20) + '...' : content
      chatStore.syncSessionMeta(sessionId, {
        title: messages.length === 0 ? title : undefined,
        expertId: selectedExpert,
        expertName: expert.name,
      })
    }

    // 📚 资料库上下文（仅在 ecomind 主控时加载）\n    const knowledgeSummary = selectedExpert === 'ecomind' ? knowledgeSummaryRef.current : ''\n    let knowledgeFiles: Array<{ name: string; content: string; path: string }> = []

    // 🔥 先抓取真实环境数据（await 完成后再启动 LLM，确保 envContext 可用）
    // 显示"正在获取数据"的提示
    setMessages((prev) =>
      prev.map((m) =>
        m.id === assistantId
          ? { ...m, content: "🔍 正在获取环境监测数据..." }
          : m
      )
    )

    let envContext: import('@/services/deepseek').EnvContext | undefined
    if (detectedCities.length > 0) {
      const detected = detectedCities[0]
      const envData = await fetchRealData(assistantId, detected.city, detected.displayCity, detected.isCounty)
      if (envData) {
        envContext = {
          city: envData.city,
          aqi: envData.aqi?.aqi,
          level: envData.aqi?.level,
          pm25: envData.aqi?.pm25,
          pm10: envData.aqi?.pm10,
          o3: envData.aqi?.o3,
          no2: envData.aqi?.no2,
          so2: envData.aqi?.so2,
          co: envData.aqi?.co,
          primaryPollutant: envData.aqi?.primaryPollutant,
          temperature: envData.aqi?.temperature,
          humidity: envData.aqi?.humidity,
          wind: envData.aqi?.wind,
          updateTime: envData.aqi?.updateTime,
          knowledgeSummary,
          knowledgeFiles: knowledgeFiles.length > 0 ? knowledgeFiles : undefined,
        }
      } else {
        // 即使没有环境数据，也注入资料库上下文
        if (knowledgeSummary || knowledgeFiles.length > 0) {
          envContext = {
            knowledgeSummary,
            knowledgeFiles: knowledgeFiles.length > 0 ? knowledgeFiles : undefined,
          }
        }
      }
    }

    // 清除数据加载提示，准备开始 LLM 流式输出
    setMessages((prev) =>
      prev.map((m) =>
        m.id === assistantId && m.content === "🔍 正在获取环境监测数据..."
          ? { ...m, content: "" }
          : m
      )
    )

    // Build clean conversation history (不含系统指令前缀)
    const history = messages.slice(-20).map(m => ({
      role: (m.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
      content: m.content
    }))

    // Real DeepSeek API streaming — 支持工具调用 + Agentic Loop
    // 📎 如果用户上传了文件，把文件路径注入到 userMessage 中让 LLM 知道
    let enhancedUserMessage = userMsg.content
    if (attachedFiles.length > 0) {
      const stillUploading = attachedFiles.some(f => f.status === 'uploading')
      if (stillUploading) {
        options.onChunk?.call(null, '\n\n⏳ 等待文件上传完成...\n')
        await new Promise<void>((resolve) => {
          const check = setInterval(() => {
            const allDone = setAttachedFiles(prev => {
              const hasUploading = prev.some(f => f.status === 'uploading')
              if (!hasUploading) {
                clearInterval(check)
                resolve()
              }
              return prev
            })
          }, 300)
        })
      }

      const fileInfos = attachedFiles.map((f, i) => {
        const serverPath = f.serverPath || ''
        const statusIcon = f.status === 'done' ? '✅' : f.status === 'error' ? '❌' : '⏳'
        return `[已上传文件${i + 1}: ${f.file.name} (${(f.file.size / 1024).toFixed(1)}KB) ${statusIcon} | 服务器路径: ${serverPath || '上传失败，请重试'}]`
      }).join('\n')

      const validFiles = attachedFiles.filter(f => f.status === 'done' && f.serverPath)
      if (validFiles.length > 0) {
        enhancedUserMessage = `${userMsg.content}\n\n${fileInfos}\n\n请使用 document_ocr（文档/PDF）、image_analyze（图片）或 voice_transcribe（音频）工具分析上述文件。`
      } else {
        enhancedUserMessage = `${userMsg.content}\n\n${fileInfos}\n\n⚠️ 文件上传未成功，请用户重新上传文件后再分析。`
      }
    }

    console.log('[Chat] 📎 发送消息, 附件数:', attachedFiles.length, '状态:', attachedFiles.map(f => `${f.file.name}:${f.status}`), '增强消息长度:', enhancedUserMessage.length)
    if (attachedFiles.length > 0) {
      console.log('[Chat] 📎 增强消息预览:', enhancedUserMessage.substring(0, 500))
    }

    const abort = chatStream(
      enhancedUserMessage,
      {
      expertId: selectedExpert,
      expertName: expert.name,
      conversationHistory: history,
      envContext,
      onChunk: (text) => {
        if (!_chunkTimerRef.current) {
          _chunkTimerRef.current = setTimeout(() => {
            _chunkTimerRef.current = null
            const batch = _chunkBufferRef.current
            _chunkBufferRef.current = ''
            if (batch) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: m.content + batch } : m
                )
              )
            }
          }, 80)  // 80ms 刷新间隔，模拟自然阅读节奏
        }
        _chunkBufferRef.current += text
      },
      onToolCall: (toolName, params, callId) => {
        const tcMsg: ToolCallMsg = {
          id: callId, type: 'tool_call',
          toolName, toolLabel: getToolLabel(toolName),
          status: 'running', params,
          timestamp: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
        }

        const taskId = addTask({
          name: `${getToolLabel(toolName)} 调用中...`,
          description: JSON.stringify(params).slice(0, 80),
          status: 'running',
          progress: 10,
          expertId: selectedExpert,
          expertName: EXPERT_MAP[selectedExpert]?.name,
          sessionId: activeSessionIdRef.current,
        })
        toolTaskMap.current[callId] = taskId

        setToolCalls(prev => {
          if (prev.some(tc => tc.toolName === toolName && tc.status === 'running')) return prev
          return [...prev, tcMsg]
        })
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? {
                ...m,
                toolCalls: (() => {
                  const existing = m.toolCalls || []
                  if (existing.some(tc => tc.toolName === toolName && tc.status === 'running')) return existing
                  return [...existing, tcMsg]
                })(),
              }
            : m
        ))
      },
      onToolResult: (toolName, summary, callId) => {
        const update = (tc: ToolCallMsg) =>
          tc.id === callId
            ? { ...tc, status: 'success' as const, result: { summary, duration_ms: 0 } }
            : tc
        setToolCalls(prev => prev.map(update))
        setMessages(prev => prev.map(m =>
          m.id === assistantId && m.toolCalls
            ? { ...m, toolCalls: m.toolCalls.map(update) }
            : m
        ))

        const taskId = toolTaskMap.current[callId]
        if (taskId) {
          completeTask(taskId)
          delete toolTaskMap.current[callId]
        }

        const artifactTypeMap: Record<string, { type: 'chart' | 'document' | 'table' | 'map' | 'report'; name: string }> = {
          env_query: { type: 'chart', name: `环境数据 · ${summary.slice(0, 20)}` },
          water_quality: { type: 'table', name: `水质数据 · ${summary.slice(0, 20)}` },
          search_regulation: { type: 'document', name: `法规检索 · ${summary.slice(0, 20)}` },
          search_knowledge: { type: 'document', name: `知识库 · ${summary.slice(0, 20)}` },
          forecast: { type: 'chart', name: `趋势预测 · ${summary.slice(0, 20)}` },
          map_query: { type: 'map', name: `地图分析 · ${summary.slice(0, 20)}` },
          report_generate: { type: 'report', name: `${summary.slice(0, 25) || '报告'}` },
          data_analyze: { type: 'chart', name: `数据分析 · ${summary.slice(0, 20)}` },
        }
        const artCfg = artifactTypeMap[toolName]
        if (artCfg) {
          addArtifact({
            name: artCfg.name,
            type: artCfg.type,
            sessionId: activeSessionIdRef.current,
            messageId: assistantId,
          })
        }

        addNotification({
          type: 'task',
          severity: 'success',
          title: `${getToolLabel(toolName)} 执行完成`,
          message: summary.slice(0, 100),
        })

        // 🆕 追踪专家变更
        const sid = activeSessionIdRef.current
        if (sid && ['skill_execute', 'memory_add', 'dispatch_expert'].includes(toolName)) {
          chatStore.addChangeLog(sid, {
            id: `cl-${Date.now()}`,
            timestamp: new Date().toISOString(),
            agentId: selectedExpert,
            agentName: expert.name,
            changeType: toolName === 'skill_execute' ? 'skill_added' :
                        toolName === 'memory_add' ? 'memory_added' : 'setting_changed',
            description: `工具 ${getToolLabel(toolName)} 执行完成: ${summary}`,
          })
        }
      },
      // 🎯 专家消息：将专家分析结果渲染为独立对话气泡
      onExpertMessage: (expertId, expertName, content, toolsUsed, duration) => {
        const expertLabel = EXPERT_MAP[expertId]?.name || expertName
        const expertIcon = EXPERT_MAP[expertId]?.icon || '🤖'
        const expertMsgId = `expert-${expertId}-${Date.now()}`
        setMessages(prev => [...prev, {
          id: expertMsgId,
          type: 'assistant' as const,
          role: 'assistant' as const,
          content: `**${expertIcon} ${expertLabel}**（耗时 ${(duration/1000).toFixed(1)}s，使用 ${toolsUsed.length} 个工具）\n\n${content}`,
          timestamp: new Date().toISOString(),
          expertId,
          expertName: expertLabel,
        }])
      },
      onDone: (fullContent) => {
        clearTimeout(safetyTimer)
        // 清理所有运行中的工具调用状态
        setToolCalls(prev => prev.map(tc =>
          tc.status === 'running' ? { ...tc, status: 'success' as const } : tc
        ))
        // Flush any remaining chunk buffer FIRST before clearing
        if (_chunkTimerRef.current) { clearTimeout(_chunkTimerRef.current); _chunkTimerRef.current = null }
        const pendingChunk = _chunkBufferRef.current
        _chunkBufferRef.current = ''

        // Apply pending chunk if any, then use finalContent as authoritative
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== assistantId) return m
            const withChunk = pendingChunk ? m.content + pendingChunk : m.content
            const final = fullContent || withChunk
            return { ...m, content: final || '(empty)', isStreaming: false }
          })
        )
        setIsLoading(false)
        abortRef.current = null

        addNotification({ type: 'system', severity: 'success', title: `${EXPERT_MAP[selectedExpert]?.name || 'EcoMind'} 回复完成`, message: fullContent?.slice(0, 80) || '已生成回复' })
      },
      onError: (err) => {
        clearTimeout(safetyTimer)
        console.error("[DeepSeek]", err.message)
        const isNetworkError = err.message.includes('Failed to fetch') || !navigator.onLine
        const errMsg = isNetworkError
          ? "⚠️ 网络连接失败，请检查网络后重试"
          : `⚠️ API 调用失败: ${err.message}\n\n请检查 Settings → 模型配置 中的 API Key 是否正确。`
        setLastError(errMsg)
        setMessages((prev) => {
          const updated = prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: errMsg, isStreaming: false }
              : m
          )
          // 🔗 同步消息数量到 chatStore（即使出错也更新）
          const sid = activeSessionIdRef.current
          if (sid) {
            chatStore.syncSessionMeta(sid, { messageCount: updated.length })
          }
          return updated
        })
        setIsLoading(false)
        abortRef.current = null

        addNotification({
          type: 'system',
          severity: 'error',
          title: '对话出错',
          message: err.message.slice(0, 100),
        })
      },
    })
    abortRef.current = abort
  }

  /** Detect city names in text (支持14市州 + 18个县级市自动映射) */
  const detectCities = (text: string): { city: string; displayCity: string; isCounty: boolean }[] => {
    const result = resolveCity(text)
    return result ? [result] : []
  }

  /** Fetch real environmental data, attach to message, and return the envData card */
  const fetchRealData = async (messageId: string, city: string, displayCity: string, isCounty = false): Promise<EnvDataCard | null> => {
    console.log(`[Chat] 🔍 开始抓取环境数据: city=${city}, display=${displayCity}, isCounty=${isCounty}`)
    try {
      const [aqi, water, stations] = await Promise.all([
        getCityAQI(city).catch((e) => { console.warn('[Chat] getCityAQI失败:', e); return null; }),
        Promise.resolve(getCityWaterQuality(city)),
        Promise.resolve(getCityStations(city)),
      ])

      console.log(`[Chat] 📊 AQI结果:`, aqi ? `AQI=${aqi.aqi}, PM2.5=${aqi.pm25}, 城市=${aqi.city}` : 'null')

      if (aqi && aqi.aqi > 0) {
        // 县级市使用自身坐标定位地图（数据仍来自地级市监测站）
        if (isCounty) {
          const coords = getCityCoordinates(displayCity)
          if (coords) { aqi.lat = coords.lat; aqi.lng = coords.lng }
          console.log(`[Chat] 📍 县级市坐标: ${displayCity} → (${aqi.lat}, ${aqi.lng})`)
        }
        const card: EnvDataCard = { type: 'aqi', city: displayCity, aqi, waterQuality: water, stations, isCounty }
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, envData: card }
              : m
          )
        )
        console.log(`[Chat] ✅ envData 卡片已附加到消息 ${messageId}`)
        return card
      } else {
        console.warn(`[Chat] ⚠️ AQI无效或为0，不显示卡片 (aqi=${aqi?.aqi})`)
        return null
      }
    } catch (e) {
      console.warn('[Chat] Failed to fetch env data:', e)
      return null
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // 中文输入法组合输入中不发送（避免 IME Enter 误触发）
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const sid = activeSessionIdRef.current

    for (const file of files) {
      const fileKey = `${file.name}-${Date.now()}`

      setAttachedFiles((prev) => [...prev, { file, status: 'uploading' }])

      if (sid) {
        chatStore.addSessionFile(sid, {
          id: fileKey,
          name: file.name,
          type: 'uploaded',
          size: file.size,
          mimeType: file.type,
          createdAt: new Date().toISOString(),
        })
      }

      try {
        const formData = new FormData()
        formData.append('file', file)
        if (sid) formData.append('session_id', sid)

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })

        if (res.ok) {
          const data = await res.json()
          setUploadedFilePaths(prev => ({ ...prev, [fileKey]: data.file_path }))
          setAttachedFiles((prev) =>
            prev.map(item =>
              item.file.name === file.name && item.status === 'uploading'
                ? { ...item, status: 'done' as const, serverPath: data.file_path }
                : item
            )
          )
          console.log(`✅ 文件上传成功: ${file.name} → ${data.file_path}`)
        } else {
          setAttachedFiles((prev) =>
            prev.map(item =>
              item.file.name === file.name && item.status === 'uploading'
                ? { ...item, status: 'error' as const }
                : item
            )
          )
          console.error(`❌ 文件上传失败: ${file.name} → HTTP ${res.status}`)
        }
      } catch (err) {
        setAttachedFiles((prev) =>
          prev.map(item =>
            item.file.name === file.name && item.status === 'uploading'
              ? { ...item, status: 'error' as const }
              : item
          )
        )
        console.error(`❌ 文件上传异常: ${file.name}`, err)
      }
    }

    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleStopStreaming = () => {
    if (abortRef.current) {
      abortRef.current()
      abortRef.current = null
      setIsLoading(false)
      setMessages((prev) =>
        prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m))
      )
    }
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full">
        {/* ChatTopBar — WorkBuddy-style header with sidebar toggle, search, history, panel toggle */}
        <ChatTopBar
          title={messages.length > 0 ? "助手" : undefined}
          sidebarCollapsed={!outletCtx.sidebarOpen}
          onToggleSidebar={outletCtx.toggleSidebar}
          onNewChat={() => {
            const sessionId = chatStore.createSession({ title: "新会话", expertId: "ecomind", expertName: "助手" })
            navigate(`/chat/${sessionId}`)
          }}
          onShare={() => {
            const text = messages.map(m => `[${m.role === "user" ? "我" : m.expert?.name || "AI"}] ${m.content}`).join("\n\n")
            navigator.clipboard.writeText(text).then(() => alert("对话已复制到剪贴板"))
          }}
          panelVisible={outletCtx.artifactPanelOpen}
          onTogglePanel={outletCtx.toggleArtifactPanel}
          messages={messages.map(m => ({ id: m.id, content: m.content, role: m.role as "user" | "assistant" }))}
          onScrollToMessage={(messageId) => {
            const el = document.getElementById(`msg-${messageId}`)
            el?.scrollIntoView({ behavior: "smooth", block: "center" })
          }}
        />

        {/* Agent Status Bar — 12 Agent 实时心跳状态 */}
        <div className="px-3 py-1.5 border-b bg-muted/20 flex items-center gap-3 overflow-x-auto">
          <AgentStatusBar compact maxVisible={12} />
        </div>

        {/* Search Bar */}
        {isSearchOpen && (
          <div className="px-4 py-2 border-b bg-muted/30 flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索消息..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              autoFocus
            />
            {searchQuery && (
              <span className="text-xs text-muted-foreground shrink-0">
                {filteredMessages.filter(m => m.role !== "system").length} 条匹配
              </span>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => { setIsSearchOpen(false); setSearchQuery("") }}
            >
              <span className="text-xs">✕</span>
            </Button>
          </div>
        )}

        {/* Welcome — Communication App Links (WorkBuddy pattern) */}
        {!isSearchOpen && messages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #52c41a, #237804)" }}>
                <Sparkles className="h-8 w-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold mb-2">EcoMind OS</h1>
              <p className="text-muted-foreground text-sm">生态环境智能协作平台</p>
            </div>

            {/* Communication Apps — WorkBuddy claw-welcome-header pattern */}
            <div className="max-w-lg w-full">
              <p className="text-xs font-semibold text-muted-foreground text-center mb-4 uppercase tracking-wider">
                连接生态数据源
              </p>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { icon: <Monitor className="h-5 w-5" />, label: "监测站点", desc: "环境监测", color: "#1677ff" },
                  { icon: <Plug className="h-5 w-5" />, label: "IoT 传感器", desc: "实时数据", color: "#52c41a" },
                  { icon: <Map className="h-5 w-5" />, label: "卫星遥感", desc: "GIS 数据", color: "#722ed1" },
                  { icon: <Globe className="h-5 w-5" />, label: "数据平台", desc: "开放API", color: "#fa8c16" },
                ].map((item) => (
                  <button
                    key={item.label}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-primary/40 hover:bg-accent transition-all cursor-pointer"
                    title={`连接到${item.label}`}
                  >
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
                      style={{ background: item.color }}>
                      {item.icon}
                    </div>
                    <span className="text-xs font-medium">{item.label}</span>
                    <span className="text-[10px] text-muted-foreground">{item.desc}</span>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground text-center mt-4">
                输入问题或指令开始与 EcoMind 对话，或从左侧选择专家
              </p>
            </div>
          </div>
        )}

        {/* Messages */}
        {!(messages.length === 0 && !isSearchOpen) && (
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-6">
            {isSearchOpen && searchQuery && filteredMessages.filter(m => m.role !== "system").length === 0 ? (
              <div className="text-center text-muted-foreground py-12">
                <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">未找到包含 "{searchQuery}" 的消息</p>
              </div>
            ) : (
              (isSearchOpen && searchQuery ? filteredMessages : messages).map((message) => (
                <MessageBubble key={message.id} message={message} searchQuery={isSearchOpen ? searchQuery : ""} />
              ))
            )}
            {isLoading && (
              <div className="flex items-start gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">EM</AvatarFallback>
                </Avatar>
                <div className="bg-muted rounded-lg px-4 py-3">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <span>思考中</span>
                    <div className="flex items-center gap-1">
                      <div className="h-1.5 w-1.5 rounded-full bg-current animate-bounce" />
                      <div className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:0.2s]" />
                      <div className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:0.4s]" />
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
        )}

        <Separator />

        {/* Input Area */}
        <div className="px-4 pb-4 pt-2">
          {messages.length > 0 && (
          <div className="flex items-center gap-2">
            {/* Expert Selector — 内联切换，即时生效 */}
            <Select
              value={selectedExpert}
              onValueChange={(expertId) => {
                setSelectedExpert(expertId)
                setMessages([])
                setToolCalls([])
                abortRef.current?.()
                setIsLoading(false)
                // 创建新会话
                const e = EXPERT_MAP[expertId]
                const sid = chatStore.createSession({
                  title: `与 ${e?.name || expertId} 的对话`,
                  expertId: expertId,
                  expertName: e?.name || expertId,
                })
                activeSessionIdRef.current = sid
                navigate(`/chat/${sid}`, { replace: true })
              }}
            >
              <SelectTrigger className="w-[220px] h-8 gap-2 font-normal text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(EXPERT_MAP).map(([id, info]) => (
                  <SelectItem key={id} value={id}>
                    <span className="flex items-center gap-2">
                      <span
                        className="inline-block w-3 h-3 rounded-full"
                        style={{ backgroundColor: (experts.find(e2 => e2.id === id) || {} as any).color || '#52c41a' }}
                      />
                      {info.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Quick Actions */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant={activePanel === 'skills' ? 'secondary' : 'outline'} size="icon" onClick={() => setActivePanel(activePanel === 'skills' ? null : 'skills')}>
                  <Sparkles className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>技能</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant={activePanel === 'tools' ? 'secondary' : 'outline'} size="icon" onClick={() => setActivePanel(activePanel === 'tools' ? null : 'tools')}>
                  <Wrench className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>工具</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant={activePanel === 'connectors' ? 'secondary' : 'outline'} size="icon" onClick={() => setActivePanel(activePanel === 'connectors' ? null : 'connectors')}>
                  <Plug className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>连接器</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant={activePanel === 'knowledge' ? 'secondary' : 'outline'} size="icon" onClick={() => setActivePanel(activePanel === 'knowledge' ? null : 'knowledge')}>
                  <BookOpen className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>资料库</TooltipContent>
            </Tooltip>

            {/* Workspace Selector */}
            <WorkspaceSelector workspace={workspace} onWorkspaceChange={setWorkspace} />
            <ModelStatusBadge onOpenSettings={outletCtx.onOpenSettings} />
          </div>
          )}

          <div className="mt-3 flex items-end gap-2">
            <Textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="请输入指令或问题...（Enter 发送，Shift+Enter 换行）"
              className="min-h-[60px] resize-none flex-1"
              rows={1}
              disabled={isLoading}
            />
            {/* File upload */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={() => fileInputRef.current?.click()} disabled={isLoading}>
                  <Paperclip className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>上传文件</TooltipContent>
            </Tooltip>
            {/* Voice input */}
            <VoiceInputButton
              onResult={(text) => setInputValue((prev) => prev + text)}
              disabled={isLoading}
            />
            {isLoading ? (
              <Button variant="destructive" onClick={handleStopStreaming}>
                停止
              </Button>
            ) : lastError ? (
              <Button onClick={() => handleSend(lastUserMessageRef.current)} variant="secondary">
                <Send className="h-4 w-4 mr-2" />
                重试
              </Button>
            ) : (
              <Button onClick={() => handleSend()} disabled={!inputValue.trim() || !isOnline || attachedFiles.some(f => f.status === 'uploading')}>
                <Send className="h-4 w-4 mr-2" />
                发送
              </Button>
            )}
          </div>

          {/* Attached files preview */}
          {attachedFiles.length > 0 && (
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              {attachedFiles.map((item, i) => (
                <Badge key={i} variant={item.status === 'done' ? 'default' : item.status === 'error' ? 'destructive' : 'secondary'} className="gap-1 pr-1 text-[11px]">
                  <Paperclip className="h-3 w-3" />
                  {item.file.name.length > 20 ? item.file.name.slice(0, 20) + "..." : item.file.name}
                  {item.status === 'uploading' && <span className="ml-1 animate-spin">⏳</span>}
                  {item.status === 'done' && <span className="ml-1 text-green-500">✅</span>}
                  {item.status === 'error' && <span className="ml-1">❌</span>}
                  <button
                    className="ml-1 hover:text-destructive"
                    onClick={() => setAttachedFiles((prev) => prev.filter((_, j) => j !== i))}
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          )}

          {/* Network offline warning */}
          {!isOnline && (
            <div className="mt-1.5 text-xs text-red-500 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 inline-block" />
              网络已断开
            </div>
          )}
        </div>
      </div>

      {/* Skills Panel */}
      <SlidePanel open={activePanel === 'skills'} onClose={() => setActivePanel(null)} title="🧠 技能面板">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground mb-3">助手可调用以下专家技能：</p>
          {panelDataLoading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">⏳ 加载中...</div>
          ) : skillsList.length > 0 ? (
            skillsList.map((s, i) => <PanelItem key={i} icon="🔧" title={s.name || s.id} desc={s.description || ''} />)
          ) : (
            [
              { icon: "📊", title: "环境监测分析", desc: "AQI、水质、噪声实时数据解读" },
              { icon: "🚔", title: "执法案件辅助", desc: "违法事实认定、法律适用建议" },
              { icon: "📋", title: "环评报告审查", desc: "环评文件技术评估要点" },
              { icon: "🏭", title: "碳排放核算", desc: "企业碳足迹计算与核查" },
              { icon: "🚨", title: "应急响应建议", desc: "突发环境事件处置方案" },
              { icon: "💧", title: "水环境治理", desc: "流域水质分析与治理建议" },
              { icon: "🔍", title: "合规检查", desc: "环保法规合规性审核" },
              { icon: "📝", title: "报告生成", desc: "自动生成监测/执法/审批报告" },
            ].map((s, i) => <PanelItem key={i} {...s} />)
          )}
        </div>
      </SlidePanel>

      {/* Tools Panel */}
      <SlidePanel open={activePanel === 'tools'} onClose={() => setActivePanel(null)} title="🔧 工具面板">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground mb-3">可用工具清单（L1=公开 / L2=公务 / L3=执法）：</p>
          {panelDataLoading ? (
            <div className="text-center py-8 text-muted-foreground text-sm">⏳ 加载中...</div>
          ) : toolsList.length > 0 ? (
            toolsList.map((t, i) => (
              <PanelItem
                key={i}
                icon={getToolIcon(t.name)}
                title={`${getToolLabel(t.name)}`}
                desc={`[${t.safety_level}] ${t.description}`}
              />
            ))
          ) : (
            [
              { icon: "🌡", title: "空气质量查询", desc: "实时 AQI + 6项污染物" },
              { icon: "💧", title: "水质断面查询", desc: "14市州水质监测数据" },
              { icon: "🗺️", title: "3D 地图分析", desc: "Cesium 湖南全境可视化" },
              { icon: "📈", title: "趋势分析", desc: "历史数据对比与趋势图" },
              { icon: "🔔", title: "预警订阅", desc: "超标自动推送通知" },
            ].map((t, i) => <PanelItem key={i} {...t} />)
          )}
        </div>
      </SlidePanel>

      {/* Connectors Panel */}
      <SlidePanel open={activePanel === 'connectors'} onClose={() => setActivePanel(null)} title="🔌 连接器">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground mb-3">数据源连接状态：</p>
          {[
            { icon: "🟢", title: "DeepSeek API", desc: "已连接 · deepseek-chat" },
            { icon: "🟢", title: "WAQI 空气质量", desc: "已连接 · 免费 API" },
            { icon: "🟢", title: "Open-Meteo 天气", desc: "已连接 · 无需密钥" },
            { icon: "🟡", title: "WebSocket", desc: "待连接 · ws://localhost:8000" },
            { icon: "⚪", title: "NATS 消息总线", desc: "未配置 · P2 规划" },
          ].map((c, i) => <PanelItem key={i} {...c} />)}
        </div>
      </SlidePanel>

      {/* Knowledge Panel */}
      <SlidePanel open={activePanel === 'knowledge'} onClose={() => setActivePanel(null)} title="📚 资料库">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground mb-3">环保法规标准快速检索：</p>
          {[
            { icon: "📕", title: "环境保护法", desc: "2014年修订 · 主席令第9号" },
            { icon: "📗", title: "大气污染防治法", desc: "2018年修订" },
            { icon: "📘", title: "水污染防治法", desc: "2017年修订" },
            { icon: "📙", title: "环境影响评价法", desc: "2018年修订" },
            { icon: "📓", title: "碳排放权交易管理办法", desc: "2021年施行" },
            { icon: "📔", title: "湖南省环境保护条例", desc: "2020年修订" },
          ].map((k, i) => <PanelItem key={i} {...k} />)}
        </div>
      </SlidePanel>

      {/* Human-in-the-Loop Confirm Dialog (L3 人工确认) */}
      <HumanConfirmDialog
        open={confirmDialog.open}
        toolName={confirmDialog.toolName}
        toolParams={confirmDialog.params}
        auditId={confirmDialog.auditId}
        onConfirm={() => {
          confirmDialog.onConfirm()
          setConfirmDialog({ open: false, toolName: '', onConfirm: () => {}, onReject: () => {} })
        }}
        onReject={() => {
          confirmDialog.onReject()
          setConfirmDialog({ open: false, toolName: '', onConfirm: () => {}, onReject: () => {} })
        }}
      />
    </TooltipProvider>
  )
}

function getAqiColorCode(aqi: number): string {
  if (aqi <= 50) return 'text-green-600 bg-green-50 border-green-200'
  if (aqi <= 100) return 'text-yellow-600 bg-yellow-50 border-yellow-200'
  if (aqi <= 150) return 'text-orange-600 bg-orange-50 border-orange-200'
  if (aqi <= 200) return 'text-red-600 bg-red-50 border-red-200'
  return 'text-purple-600 bg-purple-50 border-purple-200'
}

function MessageBubble({ message, searchQuery }: { message: Message; searchQuery?: string }) {
  const isUser = message.role === "user"
  const envData = message.envData

  /** Highlight matching text */
  const highlightText = (text: string, query: string) => {
    if (!query) return text
    const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase()
        ? <mark key={i} className="bg-yellow-200 rounded-sm px-0.5">{part}</mark>
        : part
    )
  }

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(message.content)
      } else {
        const ta = document.createElement('textarea')
        ta.value = message.content; ta.style.position = 'fixed'; ta.style.opacity = '0'
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta)
      }
    } catch { /* ignore */ }
  }

  return (
    <div className={cn("flex items-start gap-3", isUser && "flex-row-reverse")} id={`msg-${message.id}`}>
      <Avatar className={cn("h-8 w-8", !isUser && "shrink-0")}>
        {isUser ? (
          <AvatarFallback className="text-xs">U</AvatarFallback>
        ) : (
          <AvatarFallback className="text-[10px] leading-none">
            {message.expert?.name || "AI"}
          </AvatarFallback>
        )}
      </Avatar>

      <div className={cn("max-w-[85%] space-y-2", isUser && "text-right")}>
        {/* 🌍 真实数据卡片 — 先于LLM文字显示 */}
        {envData && envData.aqi && (
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold flex items-center gap-1.5">
                  📡 {envData.city} · 实时监测
                  {envData.isCounty && (
                    <span className="text-[10px] font-normal text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                      ⚠️ 数据来自所属地级市监测站
                    </span>
                  )}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(envData.aqi.updateTime).toLocaleTimeString('zh-CN')}
                </span>
              </div>

              <div className={cn(
                "flex items-center gap-3 rounded-lg border px-3 py-2",
                getAqiColorCode(envData.aqi.aqi)
              )}>
                <div className="text-center">
                  <div className="text-2xl font-bold">{envData.aqi.aqi}</div>
                  <div className="text-[10px]">AQI</div>
                </div>
                <div className="text-xs">
                  <div className="font-medium">{envData.aqi.level}</div>
                  <div>首要: {envData.aqi.primaryPollutant}</div>
                </div>
                <div className="ml-auto grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
                  <span>PM2.5: {envData.aqi.pm25}</span>
                  <span>PM10: {envData.aqi.pm10}</span>
                  <span>O₃: {envData.aqi.o3}</span>
                  <span>NO₂: {envData.aqi.no2}</span>
                  <span>SO₂: {envData.aqi.so2}</span>
                  <span>CO: {envData.aqi.co}</span>
                </div>
              </div>

              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span>🌡 {envData.aqi.temperature}°C</span>
                <span>💧 {envData.aqi.humidity}%</span>
                <span>💨 {envData.aqi.wind}</span>
              </div>
            </div>

            {/* Map Embed (卫星图 + 监测站) */}
            <ChatMapEmbed
              city={envData.city}
              lat={envData.aqi.lat}
              lng={envData.aqi.lng}
              zoom={11}
              className="h-[280px] w-full"
              markers={(envData.stations || []).map(s => ({
                name: s.name,
                lat: s.lat,
                lng: s.lng,
                aqi: envData.aqi!.aqi + Math.floor((Math.random() - 0.5) * 20),
                level: envData.aqi!.level,
              }))}
            />

            {/* 7日预报趋势图 */}
            {envData.city && (
              <ForecastChart city={envData.city} />
            )}
          </div>
        )}

        {/* LLM 文字回复（在真实数据卡片下方） */}
        {(() => {
          if (!message.toolCalls || message.toolCalls.length === 0) return null
          const running = message.toolCalls.filter(tc =>
            tc.status === 'running' || tc.status === 'pending' || tc.status === 'pending_confirmation'
          )
          const done = message.toolCalls.filter(tc =>
            tc.status === 'success' || tc.status === 'error'
          )
          return (
            <div className="mb-2 space-y-1">
              {running.map((tc) => (
                <ToolCallMessage key={tc.id} toolCall={tc} />
              ))}
              {done.length > 0 && (
                <div className="flex items-center gap-1 px-2 py-0.5 text-[11px] text-muted-foreground/50 group cursor-pointer"
                     onClick={() => setMessages(prev => prev.map(m =>
                       m.id === message.id ? { ...m, _toolDetailExpanded: !m._toolDetailExpanded } : m
                     ))}>
                  <Check className="h-3 w-3 text-green-500/40 group-hover:text-green-500/70" />
                  <span>已调用 {done.length} 个工具</span>
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity">点击查看详情</span>
                </div>
              )}
              {message._toolDetailExpanded && done.map((tc) => (
                <ToolCallMessage key={tc.id} toolCall={tc} className="ml-3" />
              ))}
            </div>
          )
        })()}
        <div
          className={cn(
            "rounded-2xl px-4 py-3",
            isUser
              ? "bg-primary text-primary-foreground"
              : "bg-muted"
          )}
        >
          {message.expert && (
            <div className="font-medium text-sm mb-1">{message.expert.name}</div>
          )}
          <div className="text-sm">
            {isUser ? (
              <span className="whitespace-pre-wrap">
                {searchQuery ? highlightText(message.content, searchQuery) : message.content}
              </span>
            ) : message.content.startsWith('⚠️') ? (
              <span className="whitespace-pre-wrap text-red-600">{message.content}</span>
            ) : (
              <MarkdownRenderer content={message.content} />
            )}
            {message.isStreaming && (
              <span className="inline-block w-1.5 h-4 bg-current ml-0.5 animate-pulse align-text-bottom" />
            )}
          </div>
        </div>

        {/* Actions */}
        {!message.isStreaming && (
          <div
            className={cn(
              "flex items-center gap-1",
              isUser ? "justify-end" : "justify-start"
            )}
          >
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <ThumbsUp className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopy}>
              <Clipboard className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => {
              const btn = e.currentTarget as HTMLButtonElement
              const isPlaying = btn.getAttribute('data-playing') === 'true'
              if (isPlaying) {
                stopSpeaking()
                btn.setAttribute('data-playing', 'false')
                btn.classList.remove('text-primary', 'bg-primary/10')
              } else {
                document.querySelectorAll('[data-playing="true"]').forEach(el => {
                  (el as HTMLElement).setAttribute('data-playing', 'false')
                  el.classList.remove('text-primary', 'bg-primary/10')
                })
                stopSpeaking()
                speakText(message.content, {
                  onStart: () => {
                    btn.setAttribute('data-playing', 'true')
                    btn.classList.add('text-primary', 'bg-primary/10')
                  },
                  onEnd: () => {
                    btn.setAttribute('data-playing', 'false')
                    btn.classList.remove('text-primary', 'bg-primary/10')
                  },
                })
              }
            }}>
              <Volume2 className="h-3 w-3" />
            </Button>
          </div>
        )}

        <div className="text-xs text-muted-foreground">{message.timestamp}</div>
      </div>
    </div>
  )
}

// ─── WorkspaceSelector — 工作空间选择器（与模型并列一行） ───

function WorkspaceSelector({ workspace, onWorkspaceChange }: { workspace: string; onWorkspaceChange: (v: string) => void }) {
  return (
    <Select value={workspace} onValueChange={onWorkspaceChange}>
      <SelectTrigger className="h-7 w-auto gap-1 px-2 text-[11px] border-0 bg-transparent hover:bg-accent text-muted-foreground hover:text-foreground data-[state=open]:bg-accent font-mono">
        <Folder className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end" className="w-[180px]">
        {WORKSPACES.map((ws) => (
          <SelectItem key={ws} value={ws} className="text-xs">
            <span className="flex items-center gap-2">
              <Folder className="h-3.5 w-3.5 text-yellow-500" />
              {ws}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
