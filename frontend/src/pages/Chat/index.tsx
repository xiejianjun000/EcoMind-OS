"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useParams, useNavigate, useOutletContext } from "react-router-dom"
import type { ChatLayoutContext } from "@/layouts/ChatLayout"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Send, Sparkles, ThumbsUp, Clipboard, Volume2, Search, Plus, Eye } from "lucide-react"
import { TaskList } from "@/components/Chat/TaskList"
import { chatStream, isApiKeyConfigured } from "@/services/deepseek"
import { getCityAQI, getCityStations, getAllCities, resolveCity } from "@/services/envDataService"
import { getToolLabel, getToolIcon, summarizeToolResult } from "@/services/toolService"
import ChatMapEmbed from "@/components/ChatMap/ChatMapEmbed"
import ForecastChart from "@/components/Chat/ForecastChart"
import MarkdownRenderer from "@/components/Chat/MarkdownRenderer"
import { VoiceInputButton, speakText, stopSpeaking } from "@/components/Chat/VoiceInputButton"
import { ChatTopBar } from "@/components/ChatTopBar/ChatTopBar"
import { ModelStatusBadge } from "@/components/Chat/ModelStatusBadge"
import { ToolCallMessage } from "@/components/Chat/ToolCallMessage"
import { HumanConfirmDialog } from "@/components/Chat/HumanConfirmDialog"
import { AgentStatusBar } from "@/components/AgentStatus/AgentStatusBar"
import { useChatStore } from "@/store/chatStore"
import type { Message, EnvDataCard, ToolCallMessage as ToolCallMsg } from "./types"
import type { ChatMessage } from "@/types/chat"

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
}

function getExpertName(id: string) { return EXPERT_MAP[id]?.name || id }
function getInitials(name: string) { return name.replace(/专家|环境|生态|管理/g, "").slice(0, 2) }

export default function ChatPage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const chatStore = useChatStore()
  const outletCtx = useOutletContext<ChatLayoutContext>()
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState("")
  const [selectedExpert, setSelectedExpert] = useState("ecomind")
  const [isLoading, setIsLoading] = useState(false)
  const [toolCalls, setToolCalls] = useState<ToolCallMsg[]>([])
  const [taskListVisible, setTaskListVisible] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [attachedFiles, setAttachedFiles] = useState<Array<{ file: File; status: string; serverPath?: string }>>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<(() => void) | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; toolName: string; params: any; auditId: string; onConfirm: () => void; onReject: () => void }>({
    open: false, toolName: "", params: {}, auditId: "", onConfirm: () => {}, onReject: () => {},
  })

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    if (!isApiKeyConfigured()) return
    const session = sessionId
      ? chatStore.sessions.find(s => s.id === sessionId)
      : chatStore.sessions[0]
    if (session) {
      setMessages(session.messages?.map((m: ChatMessage, _i: number) => ({ id: m.id || String(Date.now()), role: m.role as "user" | "assistant" | "system", content: m.content || "", timestamp: new Date(m.timestamp).toISOString() })).filter((m: Message) => m.role !== "system") || [])
    }
  }, [sessionId])

  const handleSend = useCallback(async (messageText?: string) => {
    const text = (messageText || inputValue).trim()
    if (!text || isLoading) return
    setInputValue("")
    const userMsg: Message = { id: String(Date.now()), role: "user", content: text, timestamp: new Date().toISOString() }
    setMessages(prev => [...prev, userMsg])
    setIsLoading(true)
    setToolCalls([])
    setTaskListVisible(true)  // 发送新消息时显示任务列表

    const assistantMsg: Message = { id: String(Date.now() + 1), role: "assistant", content: "", timestamp: new Date().toISOString(), isStreaming: true, toolCalls: [] }
    setMessages(prev => [...prev, assistantMsg])

    try {
      const abort = chatStream(text, {
        expertId: selectedExpert,
        model: "deepseek-chat",
        conversationHistory: messages.filter(m => m.role !== "system").map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
        onChunk: (token: string) => {
          setMessages(prev => prev.map(m => m.id === assistantMsg.id ? { ...m, content: m.content + token } : m))
        },
        onToolCall: (name: string, params: Record<string, any>, callId: string) => {
          const tc: ToolCallMsg = { id: callId, name, params, status: "running" }
          setToolCalls(prev => [...prev, tc])
          setMessages(prev => prev.map(m => m.id === assistantMsg.id ? { ...m, toolCalls: [...(m.toolCalls || []), tc] } : m))
        },
        onToolResult: (name: string, summary: string, callId: string) => {
          setToolCalls(prev => prev.map(tc => tc.id === callId ? { ...tc, status: "success", result: summary } : tc))
        },
        onDone: (_fullContent: string) => {
          setIsLoading(false)
          setToolCalls(prev => prev.map(tc => tc.status === "running" ? { ...tc, status: "success" } : tc))
          setMessages(prev => prev.map(m => m.id === assistantMsg.id ? { ...m, isStreaming: false } : m))
        },
        onError: (err: Error) => {
          setIsLoading(false)
          setMessages(prev => prev.map(m => m.id === assistantMsg.id ? { ...m, content: m.content || `错误: ${err.message}`, isStreaming: false } : m))
        },
      })
      abortRef.current = abort
    } catch (e: any) {
      setIsLoading(false)
      setMessages(prev => prev.map(m => m.id === assistantMsg.id ? { ...m, content: `请求失败: ${e.message}`, isStreaming: false } : m))
    }
  }, [inputValue, isLoading, messages, selectedExpert])

  return (
    <TooltipProvider>
    <div className="flex flex-col h-full">
      <ChatTopBar
        selectedExpert={selectedExpert}
        onExpertChange={setSelectedExpert}
        sidebarCollapsed={!outletCtx.sidebarOpen}
        onToggleSidebar={outletCtx.toggleSidebar}
        isSearchOpen={isSearchOpen}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onToggleSearch={() => setIsSearchOpen(!isSearchOpen)}
        onNewSession={() => {
          const s = chatStore.createSession({ title: "新会话", expertId: selectedExpert, expertName: getExpertName(selectedExpert) })
          navigate(`/chat/${s}`)
        }}
        panelVisible={outletCtx.contextPanelOpen}
        onTogglePanel={outletCtx.toggleContextPanel}
      />

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6 max-w-[900px] mx-auto">
          {!isSearchOpen && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center bg-primary">
                <Sparkles className="h-8 w-8 text-primary-foreground" />
              </div>
              <h1 className="text-[24px] font-bold mb-2">EcoMind OS</h1>
              <p className="text-muted-foreground text-[15px]">生态环境智能协作平台</p>
              <p className="text-xs text-muted-foreground mt-8">输入问题开始对话</p>
            </div>
          )}
          {messages.filter(m => m.role !== "system").map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          {isLoading && (
            <div className="flex items-start gap-3">
              <Avatar className="h-8 w-8"><AvatarFallback className="text-xs bg-primary text-primary-foreground">EM</AvatarFallback></Avatar>
              <div className="bg-muted rounded-lg px-4 py-3">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <span>思考中</span>
                  <div className="flex gap-1">
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

      {/* Task List — 对标 Trae: 消息区和输入框之间, 实时显示Agent正在执行的操作 */}
      <TaskList toolCalls={toolCalls} visible={taskListVisible} onToggle={() => setTaskListVisible(false)} />

      <Separator />

      {/* Input */}
      <div className="px-4 pb-4 pt-2 max-w-3xl mx-auto w-full">
        <div className="flex items-end gap-2 bg-muted/50 rounded-xl border p-2">
          <Textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            placeholder="输入指令或问题...（Enter 发送）"
            className="min-h-[40px] max-h-[200px] resize-none border-0 bg-transparent focus-visible:ring-0 text-sm"
            rows={1}
            disabled={isLoading}
          />
          <div className="flex items-center gap-1 flex-shrink-0">
            <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleSend()} disabled={isLoading}><Send className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>发送</TooltipContent></Tooltip>
          </div>
        </div>
        <div className="flex items-center justify-between mt-1.5 px-1">
          <ModelStatusBadge onOpenSettings={outletCtx.onOpenSettings} />
          <span className="text-[10px] text-muted-foreground">
            {getExpertName(selectedExpert)}
          </span>
        </div>
      </div>

      <HumanConfirmDialog
        open={confirmDialog.open}
        toolName={confirmDialog.toolName}
        toolParams={confirmDialog.params}
        auditId={confirmDialog.auditId}
        onConfirm={() => { confirmDialog.onConfirm(); setConfirmDialog(p => ({ ...p, open: false })) }}
        onReject={() => { confirmDialog.onReject(); setConfirmDialog(p => ({ ...p, open: false })) }}
      />
    </div>
    </TooltipProvider>
  )
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user"
  return (
    <div className={cn("flex items-start gap-3", isUser ? "flex-row-reverse" : "")}>
      <Avatar className="h-8 w-8 mt-0.5">
        {isUser ? (
          <AvatarFallback className="text-xs bg-primary text-primary-foreground">我</AvatarFallback>
        ) : (
          <AvatarFallback className="text-xs bg-primary text-primary-foreground">EM</AvatarFallback>
        )}
      </Avatar>
      <div className={cn("rounded-2xl px-4 py-3 max-w-[80%] min-w-0", isUser ? "bg-primary text-primary-foreground" : "bg-muted")}>
        <MarkdownRenderer content={message.content} isStreaming={message.isStreaming} />
      </div>
    </div>
  )
}
