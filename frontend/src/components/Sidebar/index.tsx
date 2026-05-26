import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Input,
  Tooltip,
  Badge,
  Avatar,
  Divider,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  SettingOutlined,
  UserOutlined,
  DownOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { useAppStore } from '@/store';
import { useChatStore } from '@/store/chatStore';
import { useExpertStore } from '@/store/expertStore';
import ExpertList from './ExpertList';
import SessionList from './SessionList';
import SkillMenu from './SkillMenu';

/**
 * Sidebar — Left panel of the three-panel layout
 * Contains: search, new session, experts, skills, connectors, workspaces, team
 */
const Sidebar: React.FC = () => {
  const { theme } = useAppStore();
  const { createSession, currentSessionId } = useChatStore();
  const { activeExpertId, sidebarExpandedSections, toggleSidebarSection, team } = useExpertStore();
  const navigate = useNavigate();
  const isDark = theme === 'dark';

  const [searchQuery, setSearchQuery] = useState('');

  const handleNewSession = () => {
    const expert = activeExpertId || 'gaia';
    const sessionId = createSession({
      title: '新会话',
      expertId: expert,
    });
    navigate(`/chat/${sessionId}`);
  };

  const textColor = isDark ? '#e0e0e0' : '#262626';
  const mutedColor = isDark ? '#888888' : '#8c8c8c';
  const borderColor = isDark ? '#333333' : '#e8e8e8';
  const hoverBg = isDark ? '#2a2a2a' : '#f5f5f5';
  const sectionBg = isDark ? '#1a1a1a' : '#fafafa';

  return (
    <div className="flex flex-col h-full">
      {/* Header: Logo + Version */}
      <div
        className="flex items-center gap-2 px-4 py-3 flex-shrink-0"
        style={{ borderBottom: `1px solid ${borderColor}` }}
      >
        <div className="w-7 h-7 rounded bg-green-600 flex items-center justify-center text-white font-bold text-xs">
          E
        </div>
        <span className="font-semibold text-sm" style={{ color: textColor }}>
          EcoMind OS
        </span>
        <span className="text-xs ml-auto" style={{ color: mutedColor }}>
          v1.0.0
        </span>
      </div>

      {/* Search */}
      <div className="px-3 py-2 flex-shrink-0">
        <Input
          prefix={<SearchOutlined style={{ color: mutedColor }} />}
          placeholder="搜索会话、产物..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="text-sm"
          style={{
            backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5',
            borderColor: 'transparent',
            color: textColor,
          }}
        />
      </div>

      {/* New Session Button */}
      <div className="px-3 pb-2 flex-shrink-0">
        <Button
          type="primary"
          icon={<PlusOutlined />}
          block
          onClick={handleNewSession}
          style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
        >
          新建会话
        </Button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto min-h-0 px-2">
        {/* Experts Section */}
        <SidebarSection
          title="专家"
          expanded={sidebarExpandedSections.experts}
          onToggle={() => toggleSidebarSection('experts')}
          isDark={isDark}
          textColor={textColor}
          mutedColor={mutedColor}
          borderColor={borderColor}
          hoverBg={hoverBg}
        >
          <ExpertList />
        </SidebarSection>

        <Divider style={{ margin: '4px 0', borderColor }} />

        {/* Session History */}
        <div className="py-1">
          <SessionList />
        </div>

        <Divider style={{ margin: '4px 0', borderColor }} />

        {/* Skills Section */}
        <SidebarSection
          title="技能"
          expanded={sidebarExpandedSections.skills}
          onToggle={() => toggleSidebarSection('skills')}
          isDark={isDark}
          textColor={textColor}
          mutedColor={mutedColor}
          borderColor={borderColor}
          hoverBg={hoverBg}
        >
          <SkillMenu />
        </SidebarSection>

        {/* Connectors Section */}
        <SidebarSection
          title="连接器"
          expanded={sidebarExpandedSections.connectors}
          onToggle={() => toggleSidebarSection('connectors')}
          isDark={isDark}
          textColor={textColor}
          mutedColor={mutedColor}
          borderColor={borderColor}
          hoverBg={hoverBg}
        >
          <ConnectorList />
        </SidebarSection>

        {/* Knowledge Base Section */}
        <SidebarSection
          title="资料库"
          expanded={sidebarExpandedSections.knowledge}
          onToggle={() => toggleSidebarSection('knowledge')}
          isDark={isDark}
          textColor={textColor}
          mutedColor={mutedColor}
          borderColor={borderColor}
          hoverBg={hoverBg}
        >
          <KnowledgeList />
        </SidebarSection>
      </div>

      {/* Footer: Team Members + Settings */}
      <div
        className="flex-shrink-0 px-3 py-2"
        style={{ borderTop: `1px solid ${borderColor}` }}
      >
        <div className="flex items-center gap-1 mb-2 overflow-x-auto">
          {team.map((member) => (
            <Tooltip key={member.id} title={`${member.name} · ${member.role}`}>
              <Badge
                dot
                color={member.status === 'online' ? '#52c41a' : member.status === 'away' ? '#faad14' : '#bfbfbf'}
                offset={[-2, 2]}
              >
                <Avatar
                  size="small"
                  icon={<UserOutlined />}
                  style={{
                    backgroundColor: member.isHuman ? '#1890ff' : '#52c41a',
                    fontSize: 12,
                  }}
                />
              </Badge>
            </Tooltip>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: mutedColor }}>
            {team.filter((m) => m.status === 'online').length} 在线
          </span>
          <Tooltip title="运维面板">
            <Button
              type="text"
              size="small"
              icon={<SettingOutlined />}
              onClick={() => navigate('/admin')}
              style={{ color: mutedColor }}
            />
          </Tooltip>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// Sidebar Section Collapsible Wrapper
// ============================================================

interface SidebarSectionProps {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  isDark: boolean;
  textColor: string;
  mutedColor: string;
  borderColor: string;
  hoverBg: string;
  children: React.ReactNode;
}

const SidebarSection: React.FC<SidebarSectionProps> = ({
  title,
  expanded,
  onToggle,
  textColor,
  mutedColor,
  hoverBg,
  children,
}) => (
  <div className="py-1">
    <div
      className="flex items-center gap-1 px-2 py-1.5 rounded cursor-pointer select-none"
      style={{ color: mutedColor }}
      onClick={onToggle}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = hoverBg; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
    >
      {expanded ? <DownOutlined className="text-xs" /> : <RightOutlined className="text-xs" />}
      <span className="text-xs font-medium uppercase tracking-wide">{title}</span>
    </div>
    {expanded && <div className="mt-1">{children}</div>}
  </div>
);

// ============================================================
// Connector List
// ============================================================

const ConnectorList: React.FC = () => {
  const { connectors } = useExpertStore();
  return (
    <div className="px-1">
      {connectors.map((conn) => (
        <div
          key={conn.id}
          className="flex items-center gap-2 px-2 py-1.5 rounded text-sm cursor-pointer"
          style={{ color: '#a0a0a0' }}
        >
          <Badge
            dot
            color={conn.status === 'connected' ? '#52c41a' : '#f5222d'}
          />
          <span>{conn.name}</span>
        </div>
      ))}
    </div>
  );
};

// ============================================================
// Knowledge Base List
// ============================================================

const KnowledgeList: React.FC = () => {
  const { knowledgeBases } = useExpertStore();
  return (
    <div className="px-1">
      {knowledgeBases.map((kb) => (
        <div
          key={kb.id}
          className="flex items-center justify-between px-2 py-1.5 rounded text-sm cursor-pointer"
          style={{ color: '#a0a0a0' }}
        >
          <span>{kb.name}</span>
          <span className="text-xs" style={{ color: '#666' }}>{kb.itemCount}</span>
        </div>
      ))}
    </div>
  );
};

export default Sidebar;
