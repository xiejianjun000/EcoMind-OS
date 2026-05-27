import React from 'react';
import { Tag } from 'antd';

export type StatusType = 'online' | 'offline' | 'warning' | 'error' | 'running' | 'stopped' | 'pending' | 'approved' | 'rejected' | 'reviewing';

const STATUS_CONFIG: Record<StatusType, { color: string; text: string }> = {
  online:    { color: '#10B981', text: '在线' },
  offline:   { color: '#9CA3AF', text: '离线' },
  warning:   { color: '#F59E0B', text: '告警' },
  error:     { color: '#DC2626', text: '异常' },
  running:   { color: '#3B82F6', text: '运行中' },
  stopped:   { color: '#6B7280', text: '已停止' },
  pending:   { color: '#F59E0B', text: '待审批' },
  approved:  { color: '#10B981', text: '已通过' },
  rejected:  { color: '#DC2626', text: '已驳回' },
  reviewing: { color: '#3B82F6', text: '审查中' },
};

interface Props {
  status: StatusType;
  text?: string;
  pulse?: boolean;
}

export const StatusBadge: React.FC<Props> = ({ status, text, pulse = false }) => {
  const config = STATUS_CONFIG[status] ?? { color: '#9CA3AF', text: status };
  return (
    <Tag
      color={config.color}
      style={{
        borderRadius: 12,
        margin: 0,
        ...(pulse ? { animation: 'pulse 2s infinite' } : {}),
      }}
    >
      {text ?? config.text}
    </Tag>
  );
};

export default StatusBadge;
