import React from 'react';
import { Empty } from 'antd';
import { RobotOutlined } from '@ant-design/icons';
import { useAppStore } from '@/store';
import { useExpertStore } from '@/store/expertStore';
import MessageBubble from './MessageBubble';
import type { ChatMessage } from '@/types/chat';

interface MessageListProps {
  messages: ChatMessage[];
}

/**
 * MessageList — Displays the conversation message bubbles
 */
const MessageList: React.FC<MessageListProps> = ({ messages }) => {
  const { theme } = useAppStore();
  const { experts } = useExpertStore();
  const isDark = theme === 'dark';

  const mutedColor = isDark ? '#888888' : '#8c8c8c';

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-8">
        <WelcomeMessage isDark={isDark} mutedColor={mutedColor} />
      </div>
    );
  }

  return (
    <div className="flex flex-col px-4 py-4 space-y-4">
      {messages.map((message, index) => {
        const expert = message.expert
          ? experts.find((e) => e.id === message.expert?.id)
          : undefined;

        return (
          <MessageBubble
            key={message.id}
            message={message}
            expert={expert}
            isLast={index === messages.length - 1}
          />
        );
      })}
    </div>
  );
};

// ============================================================
// Welcome Message (shown when no messages)
// ============================================================

interface WelcomeMessageProps {
  isDark: boolean;
  mutedColor: string;
}

const WelcomeMessage: React.FC<WelcomeMessageProps> = ({ isDark, mutedColor }) => {
  const textColor = isDark ? '#e0e0e0' : '#262626';

  const suggestions = [
    '帮我看一下湘江流域最近一周的空气质量趋势',
    '分析洞庭湖区域近三年的鸟类观测数据变化',
    '生成一份企业排污许可年报的合规预检报告',
    '在3D地图上展示湖南省所有监测站点的实时数据',
    '起草一份关于某园区环评审批的初步意见',
  ];

  return (
    <div className="text-center max-w-lg">
      <div
        className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
        style={{ backgroundColor: '#52c41a20' }}
      >
        <RobotOutlined className="text-3xl" style={{ color: '#52c41a' }} />
      </div>
      <h2 className="text-xl font-semibold mb-2" style={{ color: textColor }}>
        GAIA 生态主控 AI
      </h2>
      <p className="text-sm mb-6" style={{ color: mutedColor }}>
        我是 EcoMind OS 的智能助手，协调 12 位业务域专家为您服务。
        您可以向我提问环境监测、执法监察、环评审批、生物多样性等任何问题。
      </p>
      <div className="space-y-2">
        {suggestions.map((suggestion, i) => (
          <SuggestionButton key={i} text={suggestion} isDark={isDark} />
        ))}
      </div>
    </div>
  );
};

interface SuggestionButtonProps {
  text: string;
  isDark: boolean;
}

const SuggestionButton: React.FC<SuggestionButtonProps> = ({ text, isDark }) => (
  <button
    className="block w-full text-left px-4 py-2.5 rounded-lg text-sm transition-colors border"
    style={{
      color: isDark ? '#a0a0a0' : '#595959',
      backgroundColor: isDark ? '#1f1f1f' : '#ffffff',
      borderColor: isDark ? '#333' : '#e8e8e8',
    }}
    onMouseEnter={(e) => {
      (e.currentTarget as HTMLElement).style.backgroundColor = isDark ? '#2a2a2a' : '#f5f5f5';
      (e.currentTarget as HTMLElement).style.borderColor = '#52c41a40';
    }}
    onMouseLeave={(e) => {
      (e.currentTarget as HTMLElement).style.backgroundColor = isDark ? '#1f1f1f' : '#ffffff';
      (e.currentTarget as HTMLElement).style.borderColor = isDark ? '#333' : '#e8e8e8';
    }}
  >
    {text}
  </button>
);

export default MessageList;
