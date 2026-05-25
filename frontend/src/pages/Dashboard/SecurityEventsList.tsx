import React from 'react';
import { Card, Tag, Typography } from 'antd';
import { SafetyCertificateOutlined } from '@ant-design/icons';
import type { SecurityEvent } from './mockData';
import { SECURITY_EVENT_LABELS } from './mockData';

interface SecurityEventsListProps {
  events: SecurityEvent[];
}

/** Severity tag configuration */
const severityConfig: Record<SecurityEvent['severity'], { color: string; label: string }> = {
  critical: { color: 'red', label: '严重' },
  warning: { color: 'orange', label: '警告' },
  info: { color: 'blue', label: '信息' },
};

/** Event type tag color */
const eventTypeColor: Record<SecurityEvent['type'], string> = {
  verify_hallucination: 'volcano',
  sm2_certificate: 'geekblue',
  approval_flow: 'purple',
  access_denied: 'red',
};

/** Format timestamp to readable time */
const formatTime = (isoString: string): string => {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor(diffMs / (1000 * 60));

  if (diffMins < 60) return `${diffMins} 分钟前`;
  if (diffHours < 24) return `${diffHours} 小时前`;
  return date.toLocaleDateString('zh-CN');
};

/** Security Events list component */
const SecurityEventsList: React.FC<SecurityEventsListProps> = ({ events }) => {
  return (
    <Card
      title={
        <div className="flex items-center gap-2">
          <SafetyCertificateOutlined />
          <span>安全事件</span>
          <Tag color="red" className="ml-2">{events.length}</Tag>
        </div>
      }
      size="small"
    >
      <div className="space-y-3">
        {events.map((event) => {
          const severity = severityConfig[event.severity];
          return (
            <div
              key={event.id}
              className="flex items-start gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <Tag color={severity.color} className="shrink-0 mt-0.5">
                {severity.label}
              </Tag>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Tag color={eventTypeColor[event.type]} className="text-xs">
                    {SECURITY_EVENT_LABELS[event.type]}
                  </Tag>
                  <span className="text-xs text-gray-400">{formatTime(event.timestamp)}</span>
                </div>
                <Typography.Paragraph
                  className="!mb-0 text-xs text-gray-600 dark:text-gray-400"
                  ellipsis={{ rows: 2, expandable: true, symbol: '展开' }}
                >
                  {event.message}
                </Typography.Paragraph>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

export default SecurityEventsList;
