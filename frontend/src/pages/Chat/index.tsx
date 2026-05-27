"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { flushSync } from "react-dom"
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
  Share2,
  Search,
  LayoutGrid,
  ThumbsUp,
  Clipboard,
  Volume2,
  MoreHorizontal,
  Zap,
  ZapOff,
} from "lucide-react"
import { chatStream, isApiKeyConfigured } from "@/services/deepseek"
import { getCityAQI, getCityStations, getCityWaterQuality, getCityCoordinates, getAllCities, type CityAQI } from "@/services/envDataService"
import ChatMapEmbed from "@/components/ChatMap/ChatMapEmbed"

interface Message {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  expert?: { id: string; name: string }
  timestamp: string
  isStreaming?: boolean
  /** 附加的真实环境数据 */
  envData?: EnvDataCard
}

interface EnvDataCard {
  type: 'aqi' | 'water' | 'stations'
  city: string
  aqi?: CityAQI
  waterQuality?: ReturnType<typeof getCityWaterQuality>
  stations?: ReturnType<typeof getCityStations>
}

const EXPERT_MAP: Record<string, { id: string; name: string }> = {
  gaia: { id: "gaia", name: "GAIA 生态主控" },
  "env-monitoring": { id: "env-monitoring", name: "环境监测专家" },
  enforcement: { id: "enforcement", name: "执法监察专家" },
  eia: { id: "eia", name: "环评审批专家" },
  carbon: { id: "carbon", name: "碳排放专家" },
  emergency: { id: "emergency", name: "应急管理专家" },
  water: { id: "water", name: "水资源专家" },
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState("")
  const [selectedExpert, setSelectedExpert] = useState("gaia")
  const [isLoading, setIsLoading] = useState(false)
  const [apiStatus, setApiStatus] = useState(isApiKeyConfigured())
  const [lastError, setLastError] = useState<string | null>(null)
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<(() => void) | null>(null)
  const lastUserMessageRef = useRef<string>("")

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [])

  useEffect(() => { scrollToBottom() }, [messages, scrollToBottom])

  // Periodic API status check
  useEffect(() => {
    const interval = setInterval(() => setApiStatus(isApiKeyConfigured()), 3000)
    return () => clearInterval(interval)
  }, [])

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

  const handleSend = (retryContent?: string) => {
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
    const expert = EXPERT_MAP[selectedExpert] || EXPERT_MAP.gaia

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

    // Build conversation history (last 20 messages, max context)
    const history = messages.slice(-20).map(m => ({
      role: (m.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
      content: m.content
    }))

    // Real DeepSeek API streaming with memory
    const abort = chatStream(userMsg.content, {
      expertId: selectedExpert,
      expertName: expert.name,
      conversationHistory: history,
      onChunk: (text) => {
        // flushSync forces immediate render for true streaming effect
        flushSync(() => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: m.content + text } : m
            )
          )
        })
      },
      onDone: () => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, isStreaming: false } : m
          )
        )
        setIsLoading(false)
        abortRef.current = null

        // After LLM done → fetch real env data for detected cities
        if (detectedCities.length > 0) {
          fetchRealData(assistantId, detectedCities[0])
        }
      },
      onError: (err) => {
        console.error("[DeepSeek]", err.message)
        const isNetworkError = err.message.includes('Failed to fetch') || !navigator.onLine
        const errMsg = isNetworkError
          ? "⚠️ 网络连接失败，请检查网络后重试"
          : `⚠️ API 调用失败: ${err.message}\n\n请检查 Settings → 模型配置 中的 API Key 是否正确。`
        setLastError(errMsg)
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: errMsg, isStreaming: false }
              : m
          )
        )
        setIsLoading(false)
        abortRef.current = null
      },
    })
    abortRef.current = abort
  }

  /** Detect city names in text */
  const detectCities = (text: string): string[] => {
    const allCities = getAllCities()
    return allCities.filter(city => text.includes(city.replace('市', '')) || text.includes(city))
  }

  /** Fetch real environmental data and attach to message */
  const fetchRealData = async (messageId: string, city: string) => {
    try {
      const [aqi, water, stations] = await Promise.all([
        getCityAQI(city).catch(() => null),
        Promise.resolve(getCityWaterQuality(city)),
        Promise.resolve(getCityStations(city)),
      ])

      if (aqi) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, envData: { type: 'aqi', city, aqi, waterQuality: water, stations } as EnvDataCard }
              : m
          )
        )
      }
    } catch (e) {
      console.warn('[Chat] Failed to fetch env data:', e)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
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
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="font-semibold flex items-center gap-2">
                GAIA 生态主控
                <Badge variant={apiStatus ? "default" : "secondary"} className="text-[10px] h-4 px-1.5">
                  {apiStatus ? (
                    <><Zap className="h-2.5 w-2.5 mr-0.5" />DeepSeek</>
                  ) : (
                    <><ZapOff className="h-2.5 w-2.5 mr-0.5" />Mock</>
                  )}
                </Badge>
              </h1>
              <p className="text-xs text-muted-foreground">
                {messages.length} 条消息 · {apiStatus ? "真实 AI 对话" : "模拟模式"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Share2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>分享</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Search className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>搜索</TooltipContent>
            </Tooltip>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Messages */}
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-6">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
            {isLoading && (
              <div className="flex items-start gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">GA</AvatarFallback>
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

        <Separator />

        {/* Input Area */}
        <div className="p-4">
          <div className="flex items-end gap-2">
            {/* Expert Selector */}
            <Select value={selectedExpert} onValueChange={setSelectedExpert}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="选择专家" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gaia">🌿 GAIA 生态主控</SelectItem>
                <SelectItem value="env-monitoring">📊 环境监测专家</SelectItem>
                <SelectItem value="enforcement">🚔 执法监察专家</SelectItem>
                <SelectItem value="eia">📋 环评审批专家</SelectItem>
                <SelectItem value="carbon">🏭 碳排放专家</SelectItem>
                <SelectItem value="emergency">🚨 应急管理专家</SelectItem>
                <SelectItem value="water">💧 水资源专家</SelectItem>
              </SelectContent>
            </Select>

            {/* Quick Actions */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon">
                  <Sparkles className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>技能</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon">
                  <Wrench className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>工具</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon">
                  <Plug className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>连接器</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon">
                  <BookOpen className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>资料库</TooltipContent>
            </Tooltip>
          </div>

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
              <Button onClick={() => handleSend()} disabled={!inputValue.trim() || !isOnline}>
                <Send className="h-4 w-4 mr-2" />
                发送
              </Button>
            )}
          </div>

          {/* API Status */}
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-3">
              {!isOnline ? (
                <span className="text-red-600 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500 inline-block" />
                  网络已断开
                </span>
              ) : apiStatus ? (
                <span className="text-green-600 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500 inline-block" />
                  DeepSeek API 已连接 · 真实 AI 对话
                </span>
              ) : (
                <span className="text-orange-600 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-orange-500 inline-block" />
                  Mock 模式 · 请在 Settings 中配置 API Key
                </span>
              )}
            </span>
            <Badge variant="outline" className="text-xs">
              {EXPERT_MAP[selectedExpert] ? selectedExpert : "gaia"} · L2
            </Badge>
          </div>
        </div>
      </div>
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

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user"
  const envData = message.envData

  return (
    <div className={cn("flex items-start gap-3", isUser && "flex-row-reverse")}>
      <Avatar className={cn("h-8 w-8", !isUser && "shrink-0")}>
        {isUser ? (
          <AvatarFallback className="text-xs">U</AvatarFallback>
        ) : (
          <AvatarFallback className="text-xs">
            {message.expert?.name.slice(0, 2) || "AI"}
          </AvatarFallback>
        )}
      </Avatar>

      <div className={cn("max-w-[85%] space-y-2", isUser && "text-right")}>
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
          <div className="text-sm whitespace-pre-wrap">
            {message.content}
            {message.isStreaming && (
              <span className="inline-block w-1.5 h-4 bg-current ml-0.5 animate-pulse align-text-bottom" />
            )}
          </div>
        </div>

        {/* 🌍 Real Data Card + Map */}
        {envData && envData.aqi && (
          <div className="rounded-xl border bg-card overflow-hidden">
            {/* AQI Data Card */}
            <div className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold flex items-center gap-1.5">
                  📡 {envData.city} · 实时监测
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

            {/* Map Embed */}
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
          </div>
        )}

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
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <Clipboard className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7">
              <Volume2 className="h-3 w-3" />
            </Button>
          </div>
        )}

        <div className="text-xs text-muted-foreground">{message.timestamp}</div>
      </div>
    </div>
  )
}
