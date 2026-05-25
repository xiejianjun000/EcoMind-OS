/**
 * Agent 列表表格
 */
import React from 'react';
import { Table, Tag, Button, Space, Tooltip, Popconfirm } from 'antd';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  StopOutlined,
  MessageOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { AgentResponse, AgentStatus } from '@/services/types';

interface AgentTableProps {
  agents: AgentResponse[];
  loading: boolean;
  onStatusChange: (id: string, status: AgentStatus) => void;
  onSendMessage: (agent: AgentResponse) => void;
}

const statusConfig: Record<AgentStatus, { color: string; label: string }> = {
  running: { color: 'green', label: '运行中' },
  paused: { color: 'orange', label: '已暂停' },
  stopped: { color: 'red', label: '已停止' },
  error: { color: 'red', label: '错误' },
};

const AgentTable: React.FC<AgentTableProps> = ({ agents, loading, onStatusChange, onSendMessage }) => {
  const columns: ColumnsType<AgentResponse> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      render: (text: string, record: AgentResponse) => (
        <div>
          <div className="font-medium">{text}</div>
          <div className="text-xs text-gray-400">{record.agent_id.slice(0, 8)}</div>
        </div>
      ),
    },
    {
      title: '提供商',
      dataIndex: 'provider',
      key: 'provider',
      width: 100,
      render: (provider: string) => <Tag>{provider.toUpperCase()}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: AgentStatus) => {
        const cfg = statusConfig[status] ?? statusConfig.stopped;
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: '模型',
      dataIndex: 'model',
      key: 'model',
      width: 140,
    },
    {
      title: '防幻觉',
      dataIndex: 'taiji_verify_enabled',
      key: 'taiji_verify_enabled',
      width: 80,
      align: 'center',
      render: (enabled: boolean) => (
        <Tag color={enabled ? 'green' : 'default'}>{enabled ? '已启用' : '未启用'}</Tag>
      ),
    },
    {
      title: '工具数',
      key: 'tools_count',
      width: 80,
      align: 'center',
      render: (_: unknown, record: AgentResponse) => record.tools.length,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      render: (text: string) => new Date(text).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      fixed: 'right',
      render: (_: unknown, record: AgentResponse) => (
        <Space size="small">
          {record.status !== 'running' && (
            <Tooltip title="启动">
              <Button
                type="link"
                size="small"
                icon={<PlayCircleOutlined />}
                onClick={() => onStatusChange(record.agent_id, 'running')}
              />
            </Tooltip>
          )}
          {record.status === 'running' && (
            <Tooltip title="暂停">
              <Button
                type="link"
                size="small"
                icon={<PauseCircleOutlined />}
                onClick={() => onStatusChange(record.agent_id, 'paused')}
              />
            </Tooltip>
          )}
          {record.status !== 'stopped' && (
            <Popconfirm
              title="确定停止该 Agent 吗？"
              onConfirm={() => onStatusChange(record.agent_id, 'stopped')}
              okText="确定"
              cancelText="取消"
            >
              <Tooltip title="停止">
                <Button type="link" size="small" danger icon={<StopOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}
          {(record.status === 'running' || record.status === 'paused') && (
            <Tooltip title="发送消息">
              <Button
                type="link"
                size="small"
                icon={<MessageOutlined />}
                onClick={() => onSendMessage(record)}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Table
      dataSource={agents}
      columns={columns}
      loading={loading}
      rowKey="agent_id"
      pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
      scroll={{ x: 1000 }}
      size="middle"
    />
  );
};

export default AgentTable;
