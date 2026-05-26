"use client"

import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
  Paperclip,
  Sparkles,
  Wrench,
  Plug,
  BookOpen,
  Share2,
  Search,
  LayoutGrid,
  Plus,
  ThumbsUp,
  Clipboard,
  Volume2,
  ChevronLeft,
  MoreHorizontal,
} from "lucide-react"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  expert?: {
    id: string
    name: string
    avatar?: string
  }
  timestamp: string
  artifacts?: { id: string; name: string; type: string }[]
}

interface Participant {
  id: string
  name: string
  avatar?: string
}

const participants: Participant[] = [
  { id: "gaia", name: "GAIA" },
  { id: "monitor", name: "许清楚" },
  { id: "law", name: "寇豆码" },
  { id: "eia", name: "高见远" },
]

const initialMessages: Message[] = [
  {
    id: "1",
    role: "user",
    content: "1、这个页面智能放在什么位置？2、你自己看一下WORKBUDDY的交互模式，3、已有智能体跟WORKBUDDY的多智能体协作方式有什么异同？",
    timestamp: "14:30",
  },
  {
    id: "2",
    role: "assistant",
    content: `根据您的需求，我建议将这个页面放在以下位置：

1. **左侧导航栏** - 作为核心入口，类似 WorkBuddy 的 "+ 新建任务" 按钮
2. **顶部工具栏** - 提供快捷操作按钮

关于与 WorkBuddy 的异同分析：

**相同点：**
- 都是多智能体协作系统
- 都支持自然语言交互
- 都有任务分解和执行能力

**不同点：**
- WorkBuddy 更侧重于软件开发场景
- EcoMind OS 侧重于环境治理场景
- 智能体角色定义不同（环境专家 vs 开发者）`,
    expert: { id: "gaia", name: "GAIA 生态主控" },
    timestamp: "14:31",
    participants: [
      { id: "gaia", name: "GAIA" },
      { id: "monitor", name: "许清楚" },
    ],
  },
]

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [inputValue, setInputValue] = useState("")
  const [selectedExpert, setSelectedExpert] = useState("gaia")
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = () => {
    if (!inputValue.trim()) return

    const newMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: inputValue,
      timestamp: new Date().toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    }

    setMessages((prev) => [...prev, newMessage])
    setInputValue("")
    setIsLoading(true)

    // Simulate AI response
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "这是一个模拟的AI回复。根据您的输入，我已经理解了您的需求。",
        expert: { id: "gaia", name: "GAIA 生态主控" },
        timestamp: new Date().toLocaleTimeString("zh-CN", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        participants: [
          { id: "gaia", name: "GAIA" },
          { id: "monitor", name: "许清楚" },
        ],
      }
      setMessages((prev) => [...prev, aiResponse])
      setIsLoading(false)
    }, 1500)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="md:hidden">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="font-semibold">湘江流域水质分析</h1>
              <p className="text-xs text-muted-foreground">3 个成员 · 15 条消息</p>
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
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon">
                  <LayoutGrid className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>视图</TooltipContent>
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
              <MessageBubble
                key={message.id}
                message={message}
                participants={message.participants}
              />
            ))}
            {isLoading && (
              <div className="flex items-start gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">GA</AvatarFallback>
                </Avatar>
                <div className="bg-muted rounded-lg px-4 py-3">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm">
                    <div className="h-2 w-2 rounded-full bg-current animate-bounce" />
                    <div className="h-2 w-2 rounded-full bg-current animate-bounce [animation-delay:0.2s]" />
                    <div className="h-2 w-2 rounded-full bg-current animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Participants */}
        {messages.length > 0 && (
          <div className="px-4 py-2 border-t">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">参与成员:</span>
              <div className="flex -space-x-2">
                {participants.map((p) => (
                  <Avatar key={p.id} className="h-6 w-6 border-2 border-background">
                    <AvatarFallback className="text-[10px]">
                      {p.name.slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
            </div>
          </div>
        )}

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
                <SelectItem value="monitor">📊 环境监测专家</SelectItem>
                <SelectItem value="law">🚔 执法监察专家</SelectItem>
                <SelectItem value="eia">📋 环评审批专家</SelectItem>
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
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="请输入指令或问题..."
                className="min-h-[60px] resize-none pr-12"
                rows={1}
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 bottom-2"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
            </div>
            <Button onClick={handleSend} disabled={!inputValue.trim()}>
              <Send className="h-4 w-4 mr-2" />
              发送
            </Button>
          </div>

          {/* Security Level */}
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>默认权限 · 安全沙箱</span>
            <Badge variant="outline" className="text-xs">
              L2 · 需确认
            </Badge>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}

interface MessageBubbleProps {
  message: Message
  participants?: Participant[]
}

function MessageBubble({ message, participants }: MessageBubbleProps) {
  const isUser = message.role === "user"

  return (
    <div className={cn("flex items-start gap-3", isUser && "flex-row-reverse")}>
      <Avatar className={cn("h-8 w-8", !isUser && "shrink-0")}>
        {isUser ? (
          <>
            <AvatarFallback className="text-xs">U</AvatarFallback>
          </>
        ) : (
          <>
            <AvatarImage src={message.expert?.avatar} />
            <AvatarFallback className="text-xs">
              {message.expert?.name.slice(0, 2) || "AI"}
            </AvatarFallback>
          </>
        )}
      </Avatar>

      <div className={cn("max-w-[70%] space-y-2", isUser && "text-right")}>
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
          <div className="text-sm whitespace-pre-wrap">{message.content}</div>
        </div>

        {/* Actions */}
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

        {/* Participants */}
        {participants && participants.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">参与:</span>
            <div className="flex -space-x-1">
              {participants.map((p) => (
                <Avatar key={p.id} className="h-5 w-5 border border-background">
                  <AvatarFallback className="text-[8px]">
                    {p.name.slice(0, 1)}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground">{message.timestamp}</div>
      </div>
    </div>
  )
}
