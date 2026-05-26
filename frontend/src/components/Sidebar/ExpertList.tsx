import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Avatar } from 'antd';
import {
  GlobalOutlined,
  LineChartOutlined,
  SafetyCertificateOutlined,
  FileTextOutlined,
  IdcardOutlined,
  BugOutlined,
  CloudOutlined,
  AlertOutlined,
  ReloadOutlined,
  AuditOutlined,
  TeamOutlined,
  DropboxOutlined,
} from '@ant-design/icons';
import { useAppStore } from '@/store';
import { useChatStore } from '@/store/chatStore';
import { useExpertStore } from '@/store/expertStore';
import type { Expert } from '@/types/expert';

/** Icon mapping for experts */
const expertIconMap: Record<string, React.ReactNode> = {
  GlobalOutlined: <GlobalOutlined />,
  LineChartOutlined: <LineChartOutlined />,
  SafetyCertificateOutlined: <SafetyCertificateOutlined />,
  FileTextOutlined: <FileTextOutlined />,
  IdcardOutlined: <IdcardOutlined />,
  BugOutlined: <BugOutlined />,
  CloudOutlined: <CloudOutlined />,
  AlertOutlined: <AlertOutlined />,
  ReloadOutlined: <ReloadOutlined />,
  AuditOutlined: <AuditOutlined />,
  TeamOutlined: <TeamOutlined />,
  DropboxOutlined: <DropboxOutlined />,
};

const statusColorMap: Record<string, string> = {
  online: '#52c41a',
  busy: '#faad14',
  offline: '#bfbfbf',
  error: '#f5222d',
};

/**
 * ExpertList — Displays all 12 expert agents in the sidebar
 * Clicking an expert starts a new session with that expert
 */
const ExpertList: React.FC = () => {
  const { theme } = useAppStore();
  const { createSession } = useChatStore();
  const { experts, activeExpertId, setActiveExpert } = useExpertStore();
  const navigate = useNavigate();
  const isDark = theme === 'dark';

  const handleSelectExpert = (expert: Expert) => {
    setActiveExpert(expert.id);
    const sessionId = createSession({
      title: `与 ${expert.displayName} 的对话`,
      expertId: expert.id,
    });
    navigate(`/chat/${sessionId}`);
  };

  const textColor = isDark ? '#e0e0e0' : '#262626';
  const mutedColor = isDark ? '#888888' : '#8c8c8c';
  const hoverBg = isDark ? '#2a2a2a' : '#f0f0f0';
  const activeBg = isDark ? '#1f3a1f' : '#f6ffed';

  return (
    <div className="px-1 space-y-0.5">
      {experts.map((expert) => {
        const isActive = activeExpertId === expert.id;
        return (
          <div
            key={expert.id}
            className="flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer transition-colors"
            style={{
              backgroundColor: isActive ? activeBg : 'transparent',
            }}
            onClick={() => handleSelectExpert(expert)}
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
            <Badge
              dot
              color={statusColorMap[expert.status] || '#bfbfbf'}
              offset={[-2, 2]}
            >
              <Avatar
                size="small"
                style={{
                  backgroundColor: expert.color + '20',
                  color: expert.color,
                  fontSize: 14,
                }}
                icon={expertIconMap[expert.icon]}
              />
            </Badge>
            <div className="flex-1 min-w-0">
              <div
                className="text-sm font-medium truncate"
                style={{ color: isActive ? expert.color : textColor }}
              >
                {expert.displayName}
              </div>
              <div className="text-xs truncate" style={{ color: mutedColor }}>
                {expert.capabilities.slice(0, 2).join(' · ')}
              </div>
            </div>
            {isActive && (
              <div
                className="w-1 h-4 rounded-full flex-shrink-0"
                style={{ backgroundColor: expert.color }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ExpertList;
