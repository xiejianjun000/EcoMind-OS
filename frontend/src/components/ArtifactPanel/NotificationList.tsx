import React from 'react';
import { Empty, Button, Badge } from 'antd';
import {
  CheckCircleOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  CloseCircleOutlined,
  CheckOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { useAppStore } from '@/store';
import { useArtifactStore } from '@/store/artifactStore';
import type { NotificationItem } from '@/types/artifact';

const severityConfig = {
  info: { icon: <InfoCircleOutlined />, color: '#1890ff', bg: '#e6f4ff' },
  warning: { icon: <WarningOutlined />, color: '#faad14', bg: '#fffbe6' },
  error: { icon: <CloseCircleOutlined />, color: '#f5222d', bg: '#fff2f0' },
  success: { icon: <CheckCircleOutlined />, color: '#52c41a', bg: '#f6ffed' },
};

const typeLabelMap = {
  approval: '审批',
  security: '安全',
  system: '系统',
  task: '任务',
  workflow: '工作流',
};

/**
 * NotificationList — Displays notifications in the right panel
 */
const NotificationList: React.FC = () => {
  const { theme } = useAppStore();
  const { notifications, markNotificationRead, markAllNotificationsRead, removeNotification } = useArtifactStore();
  const isDark = theme === 'dark';

  const textColor = isDark ? '#e0e0e0' : '#262626';
  const mutedColor = isDark ? '#888888' : '#8c8c8c';
  const hoverBg = isDark ? '#2a2a2a' : '#f5f5f5';

  if (notifications.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <span style={{ color: mutedColor, fontSize: 12 }}>
              暂无通知
            </span>
          }
        />
      </div>
    );
  }

  return (
    <div className="p-2">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-xs" style={{ color: mutedColor }}>
          {notifications.filter((n) => !n.read).length} 条未读
        </span>
        <Button type="link" size="small" onClick={markAllNotificationsRead}>
          全部已读
        </Button>
      </div>
      <div className="space-y-1">
        {notifications.map((notification) => (
          <NotificationItemCard
            key={notification.id}
            notification={notification}
            isDark={isDark}
            textColor={textColor}
            mutedColor={mutedColor}
            hoverBg={hoverBg}
            onMarkRead={() => markNotificationRead(notification.id)}
            onDelete={() => removeNotification(notification.id)}
          />
        ))}
      </div>
    </div>
  );
};

interface NotificationItemCardProps {
  notification: NotificationItem;
  isDark: boolean;
  textColor: string;
  mutedColor: string;
  hoverBg: string;
  onMarkRead: () => void;
  onDelete: () => void;
}

const NotificationItemCard: React.FC<NotificationItemCardProps> = ({
  notification,
  isDark,
  textColor,
  mutedColor,
  hoverBg,
  onMarkRead,
  onDelete,
}) => {
  const config = severityConfig[notification.severity];

  return (
    <div
      className="flex items-start gap-2.5 px-2.5 py-2.5 rounded-lg cursor-pointer group transition-colors"
      style={{
        backgroundColor: notification.read ? 'transparent' : config.bg + (isDark ? '30' : ''),
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.backgroundColor = hoverBg;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.backgroundColor = notification.read
          ? 'transparent'
          : config.bg + (isDark ? '30' : '');
      }}
    >
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ backgroundColor: config.color + '15', color: config.color }}
      >
        {config.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {!notification.read && (
            <Badge dot color={config.color} />
          )}
          <span className="text-sm font-medium truncate" style={{ color: textColor }}>
            {notification.title}
          </span>
        </div>
        <div className="text-xs mt-0.5" style={{ color: mutedColor }}>
          {notification.message}
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs" style={{ color: mutedColor }}>
            {typeLabelMap[notification.type]} · {formatTime(notification.timestamp)}
          </span>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {!notification.read && (
              <Button
                type="text"
                size="small"
                icon={<CheckOutlined />}
                style={{ color: '#52c41a' }}
                onClick={(e) => { e.stopPropagation(); onMarkRead(); }}
              />
            )}
            <Button
              type="text"
              size="small"
              icon={<DeleteOutlined />}
              style={{ color: '#f5222d' }}
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

function formatTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export default NotificationList;
