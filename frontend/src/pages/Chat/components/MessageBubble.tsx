import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Copy,
  ThumbsUp,
  ThumbsDown,
  Volume2,
  Shield,
  Wrench,
  Loader2,
  CheckCircle,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronRight,
  Code2,
  Terminal,
  FileText,
  Brain,
} from 'lucide-react';
import { useAppStore } from '@/store';
import { useExpertStore } from '@/store/expertStore';
import type { ChatMessage } from '@/types/chat';
import type { Expert } from '@/types/expert';

interface MessageBubbleProps {
  message: ChatMessage;
  expert?: Expert;
  isLast: boolean;
}

/**
 * MessageBubble — 统一使用 shadcn/ui 的消息气泡
 * AI 左对齐, 用户右对齐
 */
const MessageBubble: React.FC<MessageBubbleProps> = ({ message, expert, isLast }) => {
  const { theme } = useAppStore();
  const isUser = message.role === 'user';
  const isStreaming = message.isStreaming;

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content).catch(() => {});
  };

  // Detect code blocks in content
  const hasCodeBlock = /```[\s\S]*?```/.test(message.content);

  return (
    <TooltipProvider>
      <div className={cn("flex gap-3 py-1", isUser ? "flex-row-reverse" : "flex-row")}>
        {/* Avatar */}
        <div className="flex-shrink-0 mt-0.5">
          {isUser ? (
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                我
              </AvatarFallback>
            </Avatar>
          ) : (
            <Avatar className="h-8 w-8 border">
              <AvatarFallback
                className="text-xs font-medium"
                style={{
                  backgroundColor: expert?.color ? `${expert.color}20` : 'hsl(var(--muted))',
                  color: expert?.color || 'hsl(var(--primary))',
                }}
              >
                {expert?.displayName?.slice(0, 2) || 'AI'}
              </AvatarFallback>
            </Avatar>
          )}
        </div>

        {/* Content */}
        <div className={cn("flex flex-col", isUser ? "items-end" : "items-start", "max-w-[80%] min-w-0")}>
          {/* Sender name + badges */}
          {!isUser && expert && (
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-xs font-medium" style={{ color: expert.color }}>
                {expert.displayName}
              </span>
              {message.hallucinationRisk !== undefined && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[9px] h-4 gap-0.5 px-1 cursor-help",
                        message.hallucinationRisk > 0.5
                          ? "border-red-500/50 text-red-500"
                          : message.hallucinationRisk > 0.2
                          ? "border-yellow-500/50 text-yellow-600"
                          : "border-green-500/50 text-green-600"
                      )}
                    >
                      <Shield className="h-2.5 w-2.5" />
                      {(message.hallucinationRisk * 100).toFixed(0)}%
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    幻觉风险: {(message.hallucinationRisk * 100).toFixed(1)}%
                  </TooltipContent>
                </Tooltip>
              )}
              {/* Safety Level Badge */}
              {expert.safetyLevel && (
                <Badge variant="secondary" className="text-[9px] h-4 px-1 font-mono">
                  {expert.safetyLevel}
                </Badge>
              )}
              {/* Code indicator */}
              {hasCodeBlock && (
                <Badge variant="outline" className="text-[9px] h-4 gap-0.5 px-1">
                  <Code2 className="h-2.5 w-2.5" />
                  代码
                </Badge>
              )}
            </div>
          )}

          {/* Bubble */}
          <div
            className={cn(
              "px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
              isUser
                ? "bg-primary text-primary-foreground rounded-2xl rounded-br-md"
                : "bg-muted rounded-2xl rounded-bl-md"
            )}
          >
            {/* Render code blocks with syntax highlighting indicator */}
            {isUser ? (
              <span>{message.content}</span>
            ) : (
              <MessageContent content={message.content} />
            )}
            {isStreaming && (
              <span className="inline-block w-1.5 h-4 ml-0.5 align-middle animate-pulse bg-primary rounded-sm" />
            )}
          </div>

          {/* Thinking process (collapsible) */}
          {message.thinking && !isUser && (
            <ThinkingBlock thinking={message.thinking} />
          )}

          {/* Tools used */}
          {message.toolsUsed && message.toolsUsed.length > 0 && !isUser && (
            <div className="flex items-center gap-1 mt-1.5 flex-wrap">
              <Wrench className="h-3 w-3 text-muted-foreground" />
              {message.toolsUsed.map((tool) => (
                <Badge key={tool} variant="outline" className="text-[10px] h-4 px-1">
                  {tool}
                </Badge>
              ))}
            </div>
          )}

          {/* Action bar */}
          {!isUser && !isStreaming && (
            <div className="flex items-center gap-0.5 mt-1.5 opacity-0 hover:opacity-100 focus-within:opacity-100 transition-opacity group">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopy}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>复制</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <ThumbsUp className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>有用</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <ThumbsDown className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>无用</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <Volume2 className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>朗读</TooltipContent>
              </Tooltip>
            </div>
          )}

          {/* Timestamp */}
          <span className="text-[10px] text-muted-foreground mt-0.5">
            {formatTime(message.timestamp)}
          </span>
        </div>
      </div>
    </TooltipProvider>
  );
};

// ============================================================
// Message Content (with code block rendering)
// ============================================================

function MessageContent({ content }: { content: string }) {
  // Simple code block detection and rendering
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <>
      {parts.map((part, idx) => {
        if (part.startsWith('```') && part.endsWith('```')) {
          const lines = part.slice(3, -3).split('\n');
          const lang = lines[0]?.trim() || '';
          const code = lines.slice(lang ? 1 : 0).join('\n');

          return <CodeBlock key={idx} language={lang} code={code} />;
        }
        return <span key={idx}>{part}</span>;
      })}
    </>
  );
}

// ============================================================
// Code Block (with copy button)
// ============================================================

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="my-2 rounded-lg border bg-background/80 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1 border-b bg-muted/50">
        <div className="flex items-center gap-1.5">
          <Code2 className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground font-mono">
            {language || 'code'}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-5 text-[10px] gap-1"
          onClick={handleCopy}
        >
          {copied ? (
            <CheckCircle className="h-3 w-3 text-green-500" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
          {copied ? '已复制' : '复制'}
        </Button>
      </div>
      <pre className="p-3 text-xs overflow-x-auto font-mono leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

// ============================================================
// Thinking Block (collapsible reasoning)
// ============================================================

function ThinkingBlock({ thinking }: { thinking: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-1.5 w-full">
      <button
        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <Brain className="h-3 w-3" />
        <span>推理过程</span>
        {expanded ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
      </button>
      {expanded && (
        <div className="mt-1 px-3 py-2 rounded-lg border border-dashed text-[11px] leading-relaxed bg-muted/30 text-muted-foreground">
          {thinking}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Helpers
// ============================================================

function formatTime(iso: string): string {
  const date = new Date(iso);
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

export default MessageBubble;
