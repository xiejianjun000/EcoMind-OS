/**
 * 安全事件列表组件
 */
import React, { useEffect, useState } from 'react';
import { Table, Tag, Select, Space, Switch, Typography, Card } from 'antd';
import { securityApi, safeCall } from '@/services/api';
import type { SecurityEventResponse, SecurityEventType, SecurityEventSeverity } from '@/services/types';

const { Text } = Typography;

const severityColorMap: Record<SecurityEventSeverity, string> = {
  critical: 'red',
  high: 'orange',
  medium: 'yellow',
  low: 'blue',
};

const severityLabelMap: Record<SecurityEventSeverity, string> = {
  critical: '严重',
  high: '高危',
  medium: '中危',
  low: '低危',
};

const eventTypeLabelMap: Record<SecurityEventType, string> = {
  hallucination: '幻觉检测',
  unauthorized_access: '未授权访问',
  data_leak: '数据泄露',
  injection: '注入攻击',
  policy_violation: '策略违规',
  rate_limit: '频率限制',
  compliance: '合规检查',
  encryption: '加密验证',
};

interface SecurityEventsTabProps {
  refreshKey: number;
}

const SecurityEventsTab: React.FC<SecurityEventsTabProps> = ({ refreshKey }) => {
  const [events, setEvents] = useState<SecurityEventResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState<string | undefined>(undefined);
  const [filterSeverity, setFilterSeverity] = useState<string | undefined>(undefined);
  const [filterResolved, setFilterResolved] = useState<boolean | undefined>(undefined);

  const fetchEvents = async () => {
    setLoading(true);
    const result = await safeCall(() =>
      securityApi.events({
        event_type: filterType,
        severity: filterSeverity,
        resolved: filterResolved,
      })
    );
    if (result) {
      setEvents(result.events);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, filterType, filterSeverity, filterResolved]);

  const columns = [
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      render: (text: string) => new Date(text).toLocaleString('zh-CN'),
    },
    {
      title: '类型',
      dataIndex: 'event_type',
      key: 'event_type',
      width: 120,
      render: (type: SecurityEventType) => (
        <Tag>{eventTypeLabelMap[type] ?? type}</Tag>
      ),
    },
    {
      title: '严重等级',
      dataIndex: 'severity',
      key: 'severity',
      width: 90,
      render: (severity: SecurityEventSeverity) => (
        <Tag color={severityColorMap[severity]}>{severityLabelMap[severity]}</Tag>
      ),
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: 200,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '来源',
      dataIndex: 'source',
      key: 'source',
      width: 90,
    },
    {
      title: '状态',
      dataIndex: 'resolved',
      key: 'resolved',
      width: 90,
      render: (resolved: boolean) => (
        <Tag color={resolved ? 'green' : 'orange'}>{resolved ? '已处理' : '未处理'}</Tag>
      ),
    },
  ];

  return (
    <div>
      <Card size="small" className="mb-4">
        <Space wrap>
          <span>类型：</span>
          <Select
            placeholder="全部类型"
            value={filterType}
            onChange={setFilterType}
            allowClear
            style={{ width: 140 }}
            options={Object.entries(eventTypeLabelMap).map(([value, label]) => ({ value, label }))}
          />
          <span>等级：</span>
          <Select
            placeholder="全部等级"
            value={filterSeverity}
            onChange={setFilterSeverity}
            allowClear
            style={{ width: 120 }}
            options={Object.entries(severityLabelMap).map(([value, label]) => ({ value, label }))}
          />
          <span>已处理：</span>
          <Select
            placeholder="全部"
            value={filterResolved}
            onChange={setFilterResolved}
            allowClear
            style={{ width: 100 }}
            options={[
              { value: true, label: '已处理' },
              { value: false, label: '未处理' },
            ]}
          />
        </Space>
      </Card>

      <Table
        dataSource={events}
        columns={columns}
        loading={loading}
        rowKey="event_id"
        pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
        scroll={{ x: 900 }}
        size="middle"
      />
    </div>
  );
};

export default SecurityEventsTab;
