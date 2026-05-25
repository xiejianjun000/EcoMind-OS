import React from 'react';
import { Card, Badge, Tag } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import type { AgentInfo } from './mockData';
import { AGENT_TYPE_LABELS } from './mockData';

interface AgentCardProps {
  agent: AgentInfo;
  expanded: boolean;
  onToggle: () => void;
}

/** Status icon for agent */
const StatusIcon: React.FC<{ status: AgentInfo['status'] }> = ({ status }) => {
  switch (status) {
    case 'online':
      return <CheckCircleOutlined className="text-green-500" />;
    case 'busy':
      return <LoadingOutlined className="text-orange-500" />;
    case 'offline':
      return <CloseCircleOutlined className="text-gray-400" />;
  }
};

/** Status badge color */
const statusColor: Record<AgentInfo['status'], string> = {
  online: 'green',
  busy: 'orange',
  offline: 'default',
};

/** Agent type color */
const typeColor: Record<AgentInfo['type'], string> = {
  law_enforcement: 'red',
  env_monitoring: 'blue',
  gov_approval: 'purple',
  public_service: 'cyan',
};

/** Single Agent card component with expand/collapse */
const AgentCard: React.FC<AgentCardProps> = ({ agent, expanded, onToggle }) => {
  return (
    <Card
      size="small"
      className="mb-2 cursor-pointer hover:shadow-md transition-shadow"
      onClick={onToggle}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusIcon status={agent.status} />
          <span className="font-medium text-sm">{agent.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <Tag color={typeColor[agent.type]} className="text-xs">
            {AGENT_TYPE_LABELS[agent.type]}
          </Tag>
          <Badge status={statusColor[agent.status] as 'success' | 'warning' | 'default'} />
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-1 text-xs text-gray-500 mb-1">
            <ClockCircleOutlined />
            <span>{agent.lastActivity}</span>
          </div>
          <div className="text-xs text-gray-400">
            累计处理任务：<span className="font-medium text-gray-600 dark:text-gray-300">{agent.taskCount}</span>
          </div>
        </div>
      )}
    </Card>
  );
};

export default AgentCard;
