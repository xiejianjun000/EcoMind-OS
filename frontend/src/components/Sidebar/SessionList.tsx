import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Empty, Tooltip } from 'antd';
import { MessageOutlined, DeleteOutlined } from '@ant-design/icons';
import { useAppStore } from '@/store';
import { useChatStore } from '@/store/chatStore';
import { useExpertStore } from '@/store/expertStore';

/**
 * SessionList — Displays chat session history in the sidebar
 */
const SessionList: React.FC = () => {
  const { theme } = useAppStore();
  const { sessions, currentSessionId, deleteSession, setCurrentSession } = useChatStore();
  const { experts } = useExpertStore();
  const navigate = useNavigate();
  const params = useParams();
  const isDark = theme === 'dark';

  const textColor = isDark ? '#e0e0e0' : '#262626';
  const mutedColor = isDark ? '#888888' : '#8c8c8c';
  const hoverBg = isDark ? '#2a2a2a' : '#f0f0f0';
  const activeBg = isDark ? '#2a3a2a' : '#e6f7e6';

  const handleSelectSession = (sessionId: string) => {
    setCurrentSession(sessionId);
    navigate(`/chat/${sessionId}`);
  };

  const handleDelete = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    deleteSession(sessionId);
  };

  if (sessions.length === 0) {
    return (
      <div className="px-4 py-4">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <span style={{ color: mutedColor, fontSize: 12 }}>
              暂无会话
            </span>
          }
        />
      </div>
    );
  }

  return (
    <div className="px-1 space-y-0.5">
      <div className="px-2 py-1 text-xs font-medium uppercase tracking-wide" style={{ color: mutedColor }}>
        会话历史
      </div>
      {sessions.map((session) => {
        const expert = experts.find((e) => e.id === session.expertId);
        const isActive = currentSessionId === session.id || params.sessionId === session.id;

        return (
          <div
            key={session.id}
            className="flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer group transition-colors"
            style={{
              backgroundColor: isActive ? activeBg : 'transparent',
            }}
            onClick={() => handleSelectSession(session.id)}
            onMouseEnter={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLElement).style.backgroundColor = hoverBg;
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
              }
            }}
          >
            <MessageOutlined
              className="text-sm flex-shrink-0"
              style={{ color: expert?.color || mutedColor }}
            />
            <div className="flex-1 min-w-0">
              <div
                className="text-sm truncate"
                style={{ color: isActive ? '#52c41a' : textColor }}
              >
                {session.title}
              </div>
              <div className="text-xs truncate" style={{ color: mutedColor }}>
                {session.messageCount} 条消息 · {formatTime(session.updatedAt)}
              </div>
            </div>
            <Tooltip title="删除会话">
              <DeleteOutlined
                className="text-xs opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                style={{ color: '#f5222d' }}
                onClick={(e) => handleDelete(e, session.id)}
              />
            </Tooltip>
          </div>
        );
      })}
    </div>
  );
};

function formatTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  if (diffDays < 7) return `${diffDays}天前`;
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export default SessionList;
