/**
 * 审计日志组件
 */
import React, { useEffect, useState } from 'react';
import { Table, Tag, Typography, Card } from 'antd';
import { securityApi, safeCall } from '@/services/api';
import type { AuditRecordResponse } from '@/services/types';

const { Text } = Typography;

const AuditLogTab: React.FC = () => {
  const [records, setRecords] = useState<AuditRecordResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [chainValid, setChainValid] = useState(true);

  const fetchAuditTrail = async () => {
    setLoading(true);
    const result = await safeCall(() => securityApi.auditTrail());
    if (result) {
      setRecords(result.records);
      setChainValid(result.chain_valid);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAuditTrail();
  }, []);

  const columns = [
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 170,
      render: (text: string) => new Date(text).toLocaleString('zh-CN'),
    },
    {
      title: '操作人',
      dataIndex: 'user_id',
      key: 'user_id',
      width: 120,
    },
    {
      title: '操作类型',
      dataIndex: 'action',
      key: 'action',
      width: 140,
      render: (text: string) => <Tag>{text}</Tag>,
    },
    {
      title: '资源',
      dataIndex: 'resource',
      key: 'resource',
      width: 180,
    },
    {
      title: '状态',
      dataIndex: 'success',
      key: 'success',
      width: 80,
      render: (success: boolean) => (
        <Tag color={success ? 'green' : 'red'}>{success ? '成功' : '失败'}</Tag>
      ),
    },
    {
      title: '详情',
      dataIndex: 'details',
      key: 'details',
      ellipsis: true,
      render: (details: Record<string, unknown>) => (
        <Text className="text-xs">
          {Object.keys(details).length > 0 ? JSON.stringify(details) : '—'}
        </Text>
      ),
    },
  ];

  return (
    <div>
      <Card size="small" className="mb-4">
        <Space>
          <span>哈希链状态：</span>
          <Tag color={chainValid ? 'green' : 'red'}>
            {chainValid ? '✓ 链完整' : '✗ 链异常'}
          </Tag>
        </Space>
      </Card>

      <Table
        dataSource={records}
        columns={columns}
        loading={loading}
        rowKey="record_id"
        pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
        scroll={{ x: 900 }}
        size="middle"
      />
    </div>
  );
};

export default AuditLogTab;
