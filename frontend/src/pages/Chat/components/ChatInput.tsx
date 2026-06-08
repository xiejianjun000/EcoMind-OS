import React, { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Send,
  Paperclip,
  Shield,
  Loader2,
  Cpu,
  ChevronDown,
  X,
  Bot,
  Zap,
  Brain,
  Globe,
  Upload,
  Sparkles,
} from 'lucide-react';
import { useAppStore } from '@/store';
import { useChatStore } from '@/store/chatStore';
import { useExpertStore } from '@/store/expertStore';
import { useArtifactStore } from '@/store/artifactStore';
import { sendMessageStream } from '@/services/chatApi';

// ============================================================
// LiteLLM Model Options
// ============================================================

const MODEL_OPTIONS = [
  { id: 'qwen3-14b', name: 'Qwen3-14B', traffic: '45%', icon: Zap, tier: 'sonnet' },
  { id: 'deepseek-671b', name: 'DeepSeek-671B', traffic: '28%', icon: Brain, tier: 'opus' },
  { id: 'qwen3-72b', name: 'Qwen3-72B', traffic: '18%', icon: Cpu, tier: 'sonnet' },
  { id: 'glm-4-9b', name: 'GLM-4-9B', traffic: '9%', icon: Globe, tier: 'haiku' },
];

interface ChatInputProps {
  sessionId: string | null;
}

/**
 * ChatInput — Bottom input area with expert selector, model selector, file upload, and send button
 * Unified to use shadcn/ui
 */
const ChatInput: React.FC<ChatInputProps> = ({ sessionId }) => {
  const { theme } = useAppStore();
  const { experts, activeExpertId, setActiveExpert, skills, connectors } = useExpertStore();
  const { addUserMessage, startAssistantMessage, appendStreamChunk, finalizeStreamingMessage } = useChatStore();
  const { addTask } = useArtifactStore();
  const isDark = theme === 'dark';

  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [selectedModel, setSelectedModel] = useState('qwen3-14b');
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Get active expert
  const expert = experts.find((e) => e.id === activeExpertId);

  // Online status
  const onlineExperts = experts.filter(e => e.status === 'online').length;
  const connectedConnectors = connectors.filter(c => c.status === 'connected').length;

  // Try to get WebSocket
  useEffect(() => {
    const checkWs = () => {
      const ws = (window as any).__ws;
      if (ws instanceof WebSocket) {
        wsRef.current = ws;
      }
    };
    checkWs();
    const interval = setInterval(checkWs, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleSend = async () => {
    if (!input.trim() || !sessionId || isSending) return;

    const messageText = input.trim();
    setInput('');
    setIsSending(true);

    // Add user message
    addUserMessage(sessionId, messageText);

    // Start assistant message
    const assistantMessageId = startAssistantMessage(sessionId, activeExpertId || undefined, expert?.displayName);

    // Add task
    addTask({
      name: expert ? `${expert.displayName} 正在回复` : 'AI 正在回复',
      description: messageText.slice(0, 50) + (messageText.length > 50 ? '...' : ''),
      status: 'running',
      progress: 0,
      expertId: activeExpertId || undefined,
      expertName: expert?.displayName,
      sessionId,
    });

    // Send via WebSocket stream
    sendMessageStream(
      sessionId,
      messageText,
      activeExpertId || undefined,
      assistantMessageId,
      (chunk) => {
        appendStreamChunk(chunk);
      },
      wsRef.current
    );

    setIsSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // File handling
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachedFiles((prev) => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    setAttachedFiles((prev) => [...prev, ...files]);
  }, []);

  return (
    <TooltipProvider>
      <div
        className={cn(
          "flex-shrink-0 px-4 py-3 border-t",
          isDragOver && "bg-primary/5 border-primary/30"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Top control bar */}
        <div className="flex items-center gap-2 mb-2">
          {/* Expert Selector */}
          <Select value={activeExpertId || 'gaia'} onValueChange={setActiveExpert}>
            <SelectTrigger className="h-7 w-auto min-w-[120px] text-xs border-0 bg-muted/50">
              <div className="flex items-center gap-1.5">
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: expert?.color || '#52c41a' }}
                />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              {experts.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "h-2 w-2 rounded-full",
                        e.status === 'online' ? "bg-green-500" :
                        e.status === 'busy' ? "bg-yellow-500" : "bg-gray-400"
                      )}
                    />
                    <span>{e.displayName}</span>
                    <Badge variant="outline" className="text-[8px] h-3 px-0.5 font-mono ml-1">
                      {e.safetyLevel}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Model Selector */}
          <Select value={selectedModel} onValueChange={setSelectedModel}>
            <SelectTrigger className="h-7 w-auto min-w-[100px] text-xs border-0 bg-muted/50">
              <div className="flex items-center gap-1">
                <Cpu className="h-3 w-3 text-muted-foreground" />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              {MODEL_OPTIONS.map((model) => (
                <SelectItem key={model.id} value={model.id}>
                  <div className="flex items-center gap-2">
                    <model.icon className="h-3 w-3" />
                    <span>{model.name}</span>
                    <span className="text-[9px] text-muted-foreground">{model.traffic}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Skills quick access */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground">
                <Sparkles className="h-3 w-3" />
                技能
              </Button>
            </TooltipTrigger>
            <TooltipContent>选择技能</TooltipContent>
          </Tooltip>

          {/* Connectors */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground">
                <Zap className="h-3 w-3" />
                连接器
              </Button>
            </TooltipTrigger>
            <TooltipContent>数据源</TooltipContent>
          </Tooltip>

          {/* Safety Level */}
          <div className="ml-auto flex items-center gap-1">
            <Shield className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">
              {expert?.safetyLevel || 'L2'} · {expert?.safetyLevel === 'L3' ? '需审批' : '需确认'}
            </span>
          </div>
        </div>

        {/* Attached files preview */}
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {attachedFiles.map((file, idx) => (
              <Badge key={idx} variant="secondary" className="text-[10px] gap-1 pr-0.5">
                <Upload className="h-2.5 w-2.5" />
                <span className="truncate max-w-[100px]">{file.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-3.5 w-3.5"
                  onClick={() => removeFile(idx)}
                >
                  <X className="h-2 w-2" />
                </Button>
              </Badge>
            ))}
          </div>
        )}

        {/* Input area */}
        <div className="flex items-end gap-2">
          <div className={cn(
            "flex-1 flex items-end gap-2 rounded-xl px-3 py-2 border",
            isDragOver ? "border-primary" : "border-border",
            "bg-muted/30"
          )}>
            {/* File upload button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 flex-shrink-0"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>上传附件 (拖拽也可)</TooltipContent>
            </Tooltip>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />

            {/* Text input */}
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="请输入指令或问题...（Shift+Enter 换行）"
              className="flex-1 bg-transparent text-sm resize-none outline-none min-h-[24px] max-h-[144px]"
              rows={1}
              style={{
                lineHeight: '1.5',
              }}
            />
          </div>

          {/* Send button */}
          <Button
            size="icon"
            className="h-10 w-10 rounded-xl bg-primary hover:bg-primary/90"
            onClick={handleSend}
            disabled={!input.trim() || !sessionId || isSending}
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Status bar */}
        <div className="flex items-center gap-3 mt-1.5 text-[9px] text-muted-foreground">
          <span className="flex items-center gap-0.5">
            <Bot className="h-2.5 w-2.5" />
            {onlineExperts}/{experts.length} 在线
          </span>
          <span className="flex items-center gap-0.5">
            <Zap className="h-2.5 w-2.5" />
            {connectedConnectors}/{connectors.length} 连接
          </span>
          <span className="flex items-center gap-0.5">
            <Cpu className="h-2.5 w-2.5" />
            {MODEL_OPTIONS.find(m => m.id === selectedModel)?.name}
          </span>
          <span className="flex items-center gap-0.5">
            <Shield className="h-2.5 w-2.5" />
            {expert?.safetyLevel || 'L2'}
          </span>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default ChatInput;
