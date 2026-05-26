import React, { useState, useRef, useEffect } from 'react';
import {
  Button,
  Input,
  Select,
  Tooltip,
  Badge,
  Popover,
} from 'antd';
import {
  SendOutlined,
  PaperClipOutlined,
  GlobalOutlined,
  ToolOutlined,
  ApiOutlined,
  BookOutlined,
  SafetyOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { useAppStore } from '@/store';
import { useChatStore } from '@/store/chatStore';
import { useExpertStore } from '@/store/expertStore';
import { useArtifactStore } from '@/store/artifactStore';
import { sendMessageStream } from '@/services/chatApi';

interface ChatInputProps {
  sessionId: string | null;
}

/**
 * ChatInput — Bottom input area with expert selector, skills, and send button
 */
const ChatInput: React.FC<ChatInputProps> = ({ sessionId }) => {
  const { theme } = useAppStore();
  const { experts, activeExpertId, setActiveExpert, skills, connectors } = useExpertStore();
  const { addUserMessage, startAssistantMessage, appendStreamChunk, finalizeStreamingMessage } = useChatStore();
  const { addTask } = useArtifactStore();
  const isDark = theme === 'dark';

  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const inputRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const textColor = isDark ? '#e0e0e0' : '#262626';
  const mutedColor = isDark ? '#888888' : '#8c8c8c';
  const borderColor = isDark ? '#333333' : '#e8e8e8';
  const bgColor = isDark ? '#1f1f1f' : '#ffffff';

  // Get active expert
  const expert = experts.find((e) => e.id === activeExpertId);

  // Try to get WebSocket from window (set by WebSocketProvider)
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

    // Add a task to the task panel
    const taskId = addTask({
      name: expert ? `${expert.displayName} 正在回复` : 'AI 正在回复',
      description: messageText.slice(0, 50) + (messageText.length > 50 ? '...' : ''),
      status: 'running',
      progress: 0,
      expertId: activeExpertId || undefined,
      expertName: expert?.displayName,
      sessionId,
    });

    // Send via WebSocket stream
    const abort = sendMessageStream(
      sessionId,
      messageText,
      activeExpertId || undefined,
      assistantMessageId,
      (chunk) => {
        appendStreamChunk(chunk);
        if (chunk.type === 'chunk') {
          // Update task progress (simulate)
          // In real implementation, this would come from backend
        }
      },
      wsRef.current
    );

    // Simulate task completion after stream
    setTimeout(() => {
      // Task is tracked but we don't have a direct update here
      // The stream completion will handle message finalization
    }, 100);

    setIsSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const expertOptions = experts.map((e) => ({
    value: e.id,
    label: (
      <div className="flex items-center gap-2">
        <span
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: e.color }}
        />
        <span>{e.displayName}</span>
      </div>
    ),
  }));

  return (
    <div
      className="flex-shrink-0 px-4 py-3"
      style={{
        borderTop: `1px solid ${borderColor}`,
        backgroundColor: bgColor,
      }}
    >
      {/* Top control bar */}
      <div className="flex items-center gap-2 mb-2">
        <Select
          value={activeExpertId}
          onChange={(value) => setActiveExpert(value)}
          options={expertOptions}
          variant="borderless"
          size="small"
          className="text-sm"
          style={{ minWidth: 140 }}
          dropdownStyle={{ backgroundColor: bgColor }}
        />

        <Tooltip title="选择技能">
          <Button
            type="text"
            size="small"
            icon={<ToolOutlined />}
            style={{ color: mutedColor }}
          >
            技能
          </Button>
        </Tooltip>

        <Tooltip title="数据源">
          <Button
            type="text"
            size="small"
            icon={<ApiOutlined />}
            style={{ color: mutedColor }}
          >
            连接器
          </Button>
        </Tooltip>

        <Tooltip title="知识库">
          <Button
            type="text"
            size="small"
            icon={<BookOutlined />}
            style={{ color: mutedColor }}
          >
            资料库
          </Button>
        </Tooltip>

        <div className="ml-auto flex items-center gap-1">
          <SafetyOutlined className="text-xs" style={{ color: mutedColor }} />
          <span className="text-xs" style={{ color: mutedColor }}>
            当前权限: {expert?.safetyLevel || 'L2'} · {expert?.safetyLevel === 'L3' ? '需审批' : '需确认'}
          </span>
        </div>
      </div>

      {/* Input area */}
      <div className="flex items-end gap-2">
        <div
          className="flex-1 flex items-end gap-2 rounded-xl px-3 py-2"
          style={{
            border: `1px solid ${borderColor}`,
            backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5',
          }}
        >
          <Tooltip title="上传附件">
            <Button
              type="text"
              size="small"
              icon={<PaperClipOutlined />}
              style={{ color: mutedColor }}
            />
          </Tooltip>
          <Input.TextArea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="请输入指令或问题...（Shift+Enter 换行）"
            autoSize={{ minRows: 1, maxRows: 6 }}
            variant="borderless"
            className="flex-1"
            style={{
              backgroundColor: 'transparent',
              color: textColor,
              resize: 'none',
            }}
          />
        </div>
        <Button
          type="primary"
          icon={isSending ? <LoadingOutlined /> : <SendOutlined />}
          onClick={handleSend}
          disabled={!input.trim() || !sessionId || isSending}
          className="h-10 w-10 flex items-center justify-center"
          style={{
            backgroundColor: '#52c41a',
            borderColor: '#52c41a',
            borderRadius: 12,
          }}
        />
      </div>
    </div>
  );
};

export default ChatInput;
