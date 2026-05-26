import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Tooltip,
  Popover,
  Input,
} from 'antd';
import {
  ShareAltOutlined,
  SearchOutlined,
  AppstoreOutlined,
  SplitCellsOutlined,
  PlusOutlined,
  EditOutlined,
  CheckOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import { useAppStore } from '@/store';
import { useChatStore } from '@/store/chatStore';
import { useExpertStore } from '@/store/expertStore';
import type { ChatSession } from '@/types/chat';

interface ChatHeaderProps {
  session?: ChatSession;
}

/**
 * ChatHeader — Top toolbar of the chat area
 */
const ChatHeader: React.FC<ChatHeaderProps> = ({ session }) => {
  const { theme } = useAppStore();
  const { createSession } = useChatStore();
  const { activeExpertId, experts } = useExpertStore();
  const navigate = useNavigate();
  const isDark = theme === 'dark';

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');

  const textColor = isDark ? '#e0e0e0' : '#262626';
  const mutedColor = isDark ? '#888888' : '#8c8c8c';
  const borderColor = isDark ? '#333333' : '#e8e8e8';

  const expert = experts.find((e) => e.id === (session?.expertId || activeExpertId));

  const handleNewSession = () => {
    const sessionId = createSession({
      title: '新会话',
      expertId: activeExpertId || 'gaia',
    });
    navigate(`/chat/${sessionId}`);
  };

  const handleShare = () => {
    if (session?.id) {
      const url = `${window.location.origin}/chat/${session.id}`;
      navigator.clipboard.writeText(url).catch(() => {});
    }
  };

  return (
    <div
      className="flex items-center justify-between px-4 py-2.5 flex-shrink-0"
      style={{
        borderBottom: `1px solid ${borderColor}`,
        backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
      }}
    >
      {/* Left: Session title + Expert badge */}
      <div className="flex items-center gap-3 min-w-0">
        {isEditingTitle && session ? (
          <Input
            autoFocus
            size="small"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={() => setIsEditingTitle(false)}
            onPressEnter={() => setIsEditingTitle(false)}
            className="w-48"
          />
        ) : (
          <div className="flex items-center gap-2 min-w-0">
            <h2
              className="text-base font-semibold truncate cursor-pointer hover:opacity-80"
              style={{ color: textColor }}
              onClick={() => {
                if (session) {
                  setEditTitle(session.title);
                  setIsEditingTitle(true);
                }
              }}
              title={session?.title || '新会话'}
            >
              {session?.title || '新会话'}
            </h2>
            <EditOutlined
              className="text-xs cursor-pointer"
              style={{ color: mutedColor }}
              onClick={() => {
                if (session) {
                  setEditTitle(session.title);
                  setIsEditingTitle(true);
                }
              }}
            />
          </div>
        )}

        {expert && (
          <div
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs flex-shrink-0"
            style={{
              backgroundColor: expert.color + '15',
              color: expert.color,
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: expert.color }}
            />
            {expert.displayName}
          </div>
        )}
      </div>

      {/* Right: Toolbar actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <Tooltip title="分享会话">
          <Button
            type="text"
            size="small"
            icon={<ShareAltOutlined />}
            style={{ color: mutedColor }}
            onClick={handleShare}
          />
        </Tooltip>
        <Tooltip title="搜索内容">
          <Button
            type="text"
            size="small"
            icon={<SearchOutlined />}
            style={{ color: mutedColor }}
          />
        </Tooltip>
        <Tooltip title="视图切换">
          <Button
            type="text"
            size="small"
            icon={<AppstoreOutlined />}
            style={{ color: mutedColor }}
          />
        </Tooltip>
        <div style={{ width: 1, height: 16, backgroundColor: borderColor, margin: '0 4px' }} />
        <Button
          type="primary"
          size="small"
          icon={<PlusOutlined />}
          onClick={handleNewSession}
          style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
        >
          新会话
        </Button>
      </div>
    </div>
  );
};

export default ChatHeader;
