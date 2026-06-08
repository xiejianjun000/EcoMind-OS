import React from 'react';
import { Timeline, Typography } from 'antd';
import { ClockCircleOutlined, CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface TimelineItem {
  time: string;
  title: string;
  description?: string;
  type?: 'success' | 'warning' | 'error' | 'info';
}

interface Props {
  items: TimelineItem[];
  title?: string;
}

const DOT_ICONS: Record<string, React.ReactNode> = {
  success: <CheckCircleOutlined style={{ color: '#10B981' }} />,
  warning: <ExclamationCircleOutlined style={{ color: '#F59E0B' }} />,
  error: <ExclamationCircleOutlined style={{ color: '#DC2626' }} />,
  info: <ClockCircleOutlined style={{ color: '#3B82F6' }} />,
};

export const TimelineView: React.FC<Props> = ({ items, title }) => {
  return (
    <div>
      {title && <Text strong style={{ marginBottom: 12, display: 'block' }}>{title}</Text>}
      <Timeline
        items={items.map((item) => ({
          dot: DOT_ICONS[item.type ?? 'info'],
          children: (
            <div>
              <div style={{ fontWeight: 500 }}>{item.title}</div>
              {item.description && (
                <Text type="secondary" style={{ fontSize: 13 }}>{item.description}</Text>
              )}
              <div><Text type="secondary" style={{ fontSize: 12 }}>{item.time}</Text></div>
            </div>
          ),
        }))}
      />
    </div>
  );
};

export default TimelineView;
