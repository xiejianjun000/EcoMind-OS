import React, { useState } from 'react';
import {
  Avatar,
  Tooltip,
  Button,
  Badge,
} from 'antd';
import {
  UserOutlined,
  RobotOutlined,
  CopyOutlined,
  LikeOutlined,
  DislikeOutlined,
  SoundOutlined,
  SafetyOutlined,
  ToolOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { useAppStore } from '@/store';
import type { ChatMessage } from '@/types/chat';
import type { Expert } from '@/types/expert';

interface MessageBubbleProps {
  message: ChatMessage;
  expert?: Expert;
  isLast: boolean;
}

/**
 * MessageBubble — Single message bubble (AI left, user right)
 */
const MessageBubble: React.FC<MessageBubbleProps> = ({ message, expert, isLast }) => {
  const { theme } = useAppStore();
  const isDark = theme === 'dark';
  const isUser = message.role === 'user';
  const isStreaming = message.isStreaming;

  const textColor = isDark ? '#e0e0e0' : '#262626';
  const mutedColor = isDark ? '#888888' : '#8c8c8c';
  const userBg = isDark ? '#2b4a2b' : '#f6ffed';
  const aiBg = isDark ? '#252525' : '#f5f5f5';
  const borderColor = isDark ? '#333333' : '#e8e8e8';

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content).catch(() => {});
  };

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div className="flex-shrink-0">
        {isUser ? (
          <Avatar
            size="default"
            icon={<UserOutlined />}
            style={{ backgroundColor: '#1890ff' }}
          />
        ) : (
          <Avatar
            size="default"
            icon={<RobotOutlined />}
            style={{
              backgroundColor: expert?.color + '20' || '#52c41a20',
              color: expert?.color || '#52c41a',
            }}
          />
        )}
      </div>

      {/* Content */}
      <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[80%]`}>
        {/* Sender name */}
        {!isUser && expert && (
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-xs font-medium" style={{ color: expert.color }}>
              {expert.displayName}
            </span>
            {message.hallucinationRisk !== undefined && (
              <Tooltip title={`幻觉风险: ${(message.hallucinationRisk * 100).toFixed(0)}%`}>
                <Badge
                  count={`${(message.hallucinationRisk * 100).toFixed(0)}%`}
                  style={{
                    backgroundColor:
                      message.hallucinationRisk > 0.5
                        ? '#f5222d'
                        : message.hallucinationRisk > 0.2
                        ? '#faad14'
                        : '#52c41a',
                    fontSize: 10,
                  }}
                />
              </Tooltip>
            )}
          </div>
        )}

        {/* Bubble */}
        <div
          className="px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap"
          style={{
            backgroundColor: isUser ? userBg : aiBg,
            color: textColor,
            border: `1px solid ${borderColor}`,
            borderRadius: isUser ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
          }}
        >
          {message.content}
          {isStreaming && (
            <span className="inline-block w-1.5 h-4 ml-0.5 align-middle animate-pulse" style={{ backgroundColor: '#52c41a' }} />
          )}
        </div>

        {/* Thinking process (collapsible) */}
        {message.thinking && !isUser && (
          <ThinkingBlock thinking={message.thinking} isDark={isDark} mutedColor={mutedColor} />
        )}

        {/* Tools used */}
        {message.toolsUsed && message.toolsUsed.length > 0 && !isUser && (
          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
            <ToolOutlined className="text-xs" style={{ color: mutedColor }} />
            {message.toolsUsed.map((tool) => (
              <span
                key={tool}
                className="text-xs px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0',
                  color: mutedColor,
                }}
              >
                {tool}
              </span>
            ))}
          </div>
        )}

        {/* Action bar */}
        {!isUser && !isStreaming && (
          <div className="flex items-center gap-1 mt-1.5 opacity-0 hover:opacity-100 transition-opacity">
            <Tooltip title="复制">
              <Button type="text" size="small" icon={<CopyOutlined />} style={{ color: mutedColor }} onClick={handleCopy} />
            </Tooltip>
            <Tooltip title="有用">
              <Button type="text" size="small" icon={<LikeOutlined />} style={{ color: mutedColor }} />
            </Tooltip>
            <Tooltip title="无用">
              <Button type="text" size="small" icon={<DislikeOutlined />} style={{ color: mutedColor }} />
            </Tooltip>
            <Tooltip title="朗读">
              <Button type="text" size="small" icon={<SoundOutlined />} style={{ color: mutedColor }} />
            </Tooltip>
          </div>
        )}

        {/* Timestamp */}
        <span className="text-xs mt-1" style={{ color: mutedColor }}>
          {formatTime(message.timestamp)}
        </span>
      </div>
    </div>
  );
};

// ============================================================
// Thinking Block (collapsible reasoning)
// ============================================================

interface ThinkingBlockProps {
  thinking: string;
  isDark: boolean;
  mutedColor: string;
}

const ThinkingBlock: React.FC<ThinkingBlockProps> = ({ thinking, isDark, mutedColor }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-2 w-full">
      <button
        className="flex items-center gap-1 text-xs"
        style={{ color: mutedColor }}
        onClick={() => setExpanded(!expanded)}
      >
        <SafetyOutlined />
        推理过程 {expanded ? '▲' : '▼'}
      </button>
      {expanded && (
        <div
          className="mt-1 px-3 py-2 rounded-lg text-xs leading-relaxed"
          style={{
            backgroundColor: isDark ? '#1a1a2e' : '#f0f5ff',
            color: isDark ? '#a0a0c0' : '#595959',
            border: `1px dashed ${isDark ? '#333' : '#d9d9d9'}`,
          }}
        >
          {thinking}
        </div>
      )}
    </div>
  );
};

function formatTime(iso: string): string {
  const date = new Date(iso);
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

export default MessageBubble;
