import React from 'react';
import { Card, Tag, Button, Badge } from 'antd';
import {
  AuditOutlined,
  ClockCircleOutlined,
  UserOutlined,
  RightOutlined,
} from '@ant-design/icons';
import type { ApprovalItem } from './mockData';

interface PendingApprovalsListProps {
  approvals: ApprovalItem[];
}

/** Priority tag configuration */
const priorityConfig: Record<string, { color: string; label: string }> = {
  urgent: { color: 'red', label: '紧急' },
  normal: { color: 'blue', label: '普通' },
  low: { color: 'default', label: '低' },
};

/** Approval type labels */
const approvalTypeLabels: Record<ApprovalItem['type'], string> = {
  data_access: '数据访问',
  model_deploy: '模型部署',
  config_change: '配置变更',
};

/** Format timestamp */
const formatTime = (isoString: string): string => {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours < 1) return '刚刚';
  if (diffHours < 24) return `${diffHours} 小时前`;
  return date.toLocaleDateString('zh-CN');
};

/** Pending Approvals list component */
const PendingApprovalsList: React.FC<PendingApprovalsListProps> = ({ approvals }) => {
  return (
    <Card
      title={
        <div className="flex items-center gap-2">
          <AuditOutlined />
          <span>审批队列</span>
          <Badge count={approvals.length} className="ml-2" />
        </div>
      }
      size="small"
    >
      <div className="space-y-2">
        {approvals.map((item) => {
          const priority = priorityConfig[item.priority] || priorityConfig.normal;
          return (
            <div
              key={item.id}
              className="flex items-center gap-3 p-2 rounded border border-gray-100 dark:border-gray-800 hover:border-blue-200 dark:hover:border-blue-800 transition-colors"
            >
              <Tag color={priority.color} className="shrink-0">
                {priority.label}
              </Tag>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{item.title}</div>
                <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <UserOutlined />
                    {item.requestedBy}
                  </span>
                  <span className="flex items-center gap-1">
                    <ClockCircleOutlined />
                    {formatTime(item.createdAt)}
                  </span>
                  <Tag className="text-xs" bordered={false}>
                    {approvalTypeLabels[item.type]}
                  </Tag>
                </div>
              </div>
              <Button type="link" size="small" icon={<RightOutlined />} />
            </div>
          );
        })}
      </div>
    </Card>
  );
};

export default PendingApprovalsList;
