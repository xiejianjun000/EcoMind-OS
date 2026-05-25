import React from 'react';
import { Popover, Typography, Space, Tag } from 'antd';
import {
  LinkOutlined,
  DisconnectOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { useAppStore } from '@/store';

/** Connection status enum */
type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

/** Status display configuration */
const STATUS_CONFIG: Record<
  ConnectionStatus,
  { color: string; dotClass: string; label: string; icon: React.ReactNode }
> = {
  connected: {
    color: '#52c41a',
    dotClass: 'bg-green-500',
    label: '已连接',
    icon: <LinkOutlined />,
  },
  connecting: {
    color: '#faad14',
    dotClass: 'bg-yellow-400',
    label: '连接中',
    icon: <LoadingOutlined />,
  },
  disconnected: {
    color: '#ff4d4f',
    dotClass: 'bg-red-500',
    label: '已断开',
    icon: <DisconnectOutlined />,
  },
};

/**
 * WebSocket connection status indicator component.
 * Displays a small colored dot in the header indicating connection state.
 * Click to see connection details in a Popover.
 */
const WsStatusIndicator: React.FC = () => {
  const wsConnected = useAppStore((s) => s.wsConnected);
  const wsReconnectCount = useAppStore((s) => s.wsReconnectCount);
  const wsLastMessageTime = useAppStore((s) => s.wsLastMessageTime);

  // Determine status — we treat reconnecting as "connecting"
  const status: ConnectionStatus = wsConnected
    ? 'connected'
    : wsReconnectCount > 0
      ? 'connecting'
      : 'disconnected';

  const config = STATUS_CONFIG[status];

  /** Format an ISO timestamp to a readable local time string */
  const formatTime = (isoString: string | null): string => {
    if (!isoString) return '—';
    try {
      return new Date(isoString).toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return '—';
    }
  };

  /** Popover content showing connection details */
  const popoverContent = (
    <div style={{ minWidth: 200 }}>
      <Space direction="vertical" size={4} className="w-full">
        <div className="flex justify-between">
          <Typography.Text type="secondary" className="text-xs">
            状态
          </Typography.Text>
          <Tag color={status === 'connected' ? 'green' : status === 'connecting' ? 'gold' : 'red'}>
            {config.label}
          </Tag>
        </div>
        <div className="flex justify-between">
          <Typography.Text type="secondary" className="text-xs">
            重连次数
          </Typography.Text>
          <Typography.Text className="text-xs">{wsReconnectCount}</Typography.Text>
        </div>
        <div className="flex justify-between">
          <Typography.Text type="secondary" className="text-xs">
            最后消息
          </Typography.Text>
          <Typography.Text className="text-xs">{formatTime(wsLastMessageTime)}</Typography.Text>
        </div>
      </Space>
    </div>
  );

  return (
    <Popover
      content={popoverContent}
      title="WebSocket 连接"
      trigger="hover"
      placement="bottomRight"
    >
      <div className="flex items-center gap-1.5 cursor-pointer px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
        <span
          className={`w-2 h-2 rounded-full ${config.dotClass} ${
            status === 'connecting' ? 'animate-pulse' : ''
          }`}
        />
        <span className="text-xs font-medium" style={{ color: config.color }}>
          WS
        </span>
      </div>
    </Popover>
  );
};

export default WsStatusIndicator;
