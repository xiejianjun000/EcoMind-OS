import React from 'react';
import {
  FileTextOutlined,
  CheckSquareOutlined,
  BellOutlined,
  DoubleRightOutlined,
  DoubleLeftOutlined,
} from '@ant-design/icons';
import { useAppStore } from '@/store';
import { useArtifactStore } from '@/store/artifactStore';
import ArtifactList from './ArtifactList';
import TaskList from './TaskList';
import NotificationList from './NotificationList';

/**
 * ArtifactPanel — Right panel of the three-panel layout
 * Tabs: Artifacts | Tasks | Notifications
 */
const ArtifactPanel: React.FC = () => {
  const { theme } = useAppStore();
  const { panelTab, panelCollapsed, setPanelTab, togglePanel, unreadCount } = useArtifactStore();
  const isDark = theme === 'dark';

  const textColor = isDark ? '#e0e0e0' : '#262626';
  const mutedColor = isDark ? '#888888' : '#8c8c8c';
  const borderColor = isDark ? '#333333' : '#e8e8e8';
  const bgColor = isDark ? '#1f1f1f' : '#ffffff';

  if (panelCollapsed) {
    return (
      <div
        className="flex-shrink-0 h-full flex flex-col items-center py-4 border-l"
        style={{
          width: 40,
          borderColor,
          backgroundColor: bgColor,
        }}
      >
        <button
          className="w-7 h-7 flex items-center justify-center rounded hover:opacity-80 mb-4"
          style={{ color: mutedColor }}
          onClick={togglePanel}
          title="展开面板"
        >
          <DoubleLeftOutlined />
        </button>
        <TabButton
          icon={<FileTextOutlined />}
          active={panelTab === 'artifacts'}
          onClick={() => { setPanelTab('artifacts'); togglePanel(); }}
          isDark={isDark}
        />
        <TabButton
          icon={<CheckSquareOutlined />}
          active={panelTab === 'tasks'}
          onClick={() => { setPanelTab('tasks'); togglePanel(); }}
          isDark={isDark}
        />
        <TabButton
          icon={<BellOutlined />}
          active={panelTab === 'notifications'}
          onClick={() => { setPanelTab('notifications'); togglePanel(); }}
          isDark={isDark}
          badge={unreadCount > 0 ? unreadCount : undefined}
        />
      </div>
    );
  }

  return (
    <aside
      className="flex-shrink-0 h-full flex flex-col border-l"
      style={{
        width: 320,
        borderColor,
        backgroundColor: bgColor,
      }}
    >
      {/* Tab Header */}
      <div
        className="flex items-center justify-between px-3 py-2 flex-shrink-0"
        style={{ borderBottom: `1px solid ${borderColor}` }}
      >
        <div className="flex items-center gap-1">
          <TabHeader
            icon={<FileTextOutlined />}
            label="产物"
            active={panelTab === 'artifacts'}
            onClick={() => setPanelTab('artifacts')}
            isDark={isDark}
          />
          <TabHeader
            icon={<CheckSquareOutlined />}
            label="任务"
            active={panelTab === 'tasks'}
            onClick={() => setPanelTab('tasks')}
            isDark={isDark}
          />
          <TabHeader
            icon={<BellOutlined />}
            label="通知"
            active={panelTab === 'notifications'}
            onClick={() => setPanelTab('notifications')}
            isDark={isDark}
            badge={unreadCount > 0 ? unreadCount : undefined}
          />
        </div>
        <button
          className="w-6 h-6 flex items-center justify-center rounded hover:opacity-80"
          style={{ color: mutedColor }}
          onClick={togglePanel}
          title="收起面板"
        >
          <DoubleRightOutlined className="text-xs" />
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {panelTab === 'artifacts' && <ArtifactList />}
        {panelTab === 'tasks' && <TaskList />}
        {panelTab === 'notifications' && <NotificationList />}
      </div>
    </aside>
  );
};

// ============================================================
// Sub-components
// ============================================================

interface TabButtonProps {
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
  isDark: boolean;
  badge?: number;
}

const TabButton: React.FC<TabButtonProps> = ({ icon, active, onClick, isDark, badge }) => (
  <button
    className="relative w-8 h-8 flex items-center justify-center rounded-lg mb-2 transition-colors"
    style={{
      color: active ? '#52c41a' : isDark ? '#888' : '#999',
      backgroundColor: active ? (isDark ? '#1a3a1a' : '#f6ffed') : 'transparent',
    }}
    onClick={onClick}
  >
    {icon}
    {badge !== undefined && (
      <span
        className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full text-xs text-white flex items-center justify-center"
        style={{ backgroundColor: '#f5222d', fontSize: 10 }}
      >
        {badge > 99 ? '99+' : badge}
      </span>
    )}
  </button>
);

interface TabHeaderProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  isDark: boolean;
  badge?: number;
}

const TabHeader: React.FC<TabHeaderProps> = ({ icon, label, active, onClick, isDark, badge }) => (
  <button
    className="flex items-center gap-1 px-2.5 py-1 rounded-md text-sm transition-colors relative"
    style={{
      color: active ? '#52c41a' : isDark ? '#888' : '#999',
      backgroundColor: active ? (isDark ? '#1a3a1a' : '#f6ffed') : 'transparent',
      fontWeight: active ? 500 : 400,
    }}
    onClick={onClick}
  >
    {icon}
    <span>{label}</span>
    {badge !== undefined && (
      <span
        className="ml-0.5 min-w-4 h-4 px-1 rounded-full text-xs text-white flex items-center justify-center"
        style={{ backgroundColor: '#f5222d', fontSize: 10 }}
      >
        {badge > 99 ? '99+' : badge}
      </span>
    )}
  </button>
);

export default ArtifactPanel;
