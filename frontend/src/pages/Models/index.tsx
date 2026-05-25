/**
 * 模型管理页面 — 本地模型路由、GPU 负载与微调
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Button, Card, Row, Col, Select, Space, Table, Tag, Typography, message } from 'antd';
import { ReloadOutlined, HeartOutlined, ExperimentOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { modelApi, safeCall } from '@/services/api';
import type { ModelInfo, ModelStatus, ModelTier } from '@/services/types';
import ModelHealthStats from './components/ModelHealthStats';
import ModelRouter from './components/ModelRouter';

const { Title, Text } = Typography;

const tierColorMap: Record<ModelTier, string> = {
  opus: 'purple',
  sonnet: 'blue',
  haiku: 'green',
};

const tierLabelMap: Record<ModelTier, string> = {
  opus: 'Opus',
  sonnet: 'Sonnet',
  haiku: 'Haiku',
};

const statusColorMap: Record<ModelStatus, string> = {
  online: 'green',
  offline: 'red',
  loading: 'orange',
  error: 'red',
};

const statusLabelMap: Record<ModelStatus, string> = {
  online: '在线',
  offline: '离线',
  loading: '加载中',
  error: '错误',
};

const ModelsPage: React.FC = () => {
  const { t } = useTranslation();
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterProvider, setFilterProvider] = useState<string | undefined>(undefined);
  const [filterTier, setFilterTier] = useState<string | undefined>(undefined);

  /** 加载模型列表 */
  const fetchModels = useCallback(async () => {
    setLoading(true);
    const result = await safeCall(() => modelApi.list({ provider: filterProvider, tier: filterTier }));
    if (result) {
      setModels(result.models);
    }
    setLoading(false);
  }, [filterProvider, filterTier]);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  /** 健康检查 */
  const handleHealthCheck = async () => {
    const result = await safeCall(() => modelApi.health());
    if (result) {
      message.success(result.healthy ? '所有模型健康' : '部分模型异常');
    }
  };

  const columns = [
    {
      title: '名称',
      dataIndex: 'model_name',
      key: 'model_name',
      width: 180,
      render: (text: string, record: ModelInfo) => (
        <div>
          <div className="font-medium">{text}</div>
          <div className="text-xs text-gray-400">{record.model_id}</div>
        </div>
      ),
    },
    {
      title: '提供商',
      dataIndex: 'provider',
      key: 'provider',
      width: 110,
      render: (provider: string) => <Tag>{provider.toUpperCase()}</Tag>,
    },
    {
      title: '层级',
      dataIndex: 'tier',
      key: 'tier',
      width: 90,
      render: (tier: ModelTier | null) =>
        tier ? <Tag color={tierColorMap[tier]}>{tierLabelMap[tier]}</Tag> : '—',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status: ModelStatus) => (
        <Tag color={statusColorMap[status]}>{statusLabelMap[status]}</Tag>
      ),
    },
    {
      title: '延迟',
      dataIndex: 'latency_ms',
      key: 'latency_ms',
      width: 90,
      align: 'right' as const,
      render: (ms: number) => (ms > 0 ? `${ms.toFixed(0)}ms` : '—'),
    },
    {
      title: '成本',
      dataIndex: 'cost_per_1k_tokens',
      key: 'cost_per_1k_tokens',
      width: 100,
      align: 'right' as const,
      render: (cost: number) => (cost > 0 ? `¥${cost.toFixed(4)}/1k` : '—'),
    },
    {
      title: '最大 Token',
      dataIndex: 'max_tokens',
      key: 'max_tokens',
      width: 100,
      align: 'right' as const,
      render: (val: number) => val.toLocaleString(),
    },
    {
      title: '能力',
      key: 'capabilities',
      width: 120,
      render: (_: unknown, record: ModelInfo) => (
        <Space size={4}>
          {record.supports_streaming && <Tag color="blue">流式</Tag>}
          {record.supports_tools && <Tag color="green">工具</Tag>}
        </Space>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <Title level={3} style={{ margin: 0 }}>
            {t('models.title')}
          </Title>
          <Text type="secondary">{t('models.description')}</Text>
        </div>
        <Space>
          <Button icon={<HeartOutlined />} onClick={handleHealthCheck}>
            健康检查
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchModels}>
            刷新
          </Button>
        </Space>
      </div>

      {/* 健康状态统计 */}
      <ModelHealthStats totalModels={models.length} />

      {/* 筛选栏 */}
      <Card size="small">
        <Space>
          <span>按提供商筛选：</span>
          <Select
            placeholder="全部提供商"
            value={filterProvider}
            onChange={setFilterProvider}
            allowClear
            style={{ width: 160 }}
            options={[
              { value: 'qwen', label: 'Qwen' },
              { value: 'deepseek', label: 'DeepSeek' },
              { value: 'glm', label: 'GLM' },
              { value: 'openai', label: 'OpenAI' },
              { value: 'anthropic', label: 'Anthropic' },
              { value: 'local_vllm', label: 'vLLM' },
              { value: 'local_sglang', label: 'SGLang' },
            ]}
          />
          <span>按层级筛选：</span>
          <Select
            placeholder="全部层级"
            value={filterTier}
            onChange={setFilterTier}
            allowClear
            style={{ width: 140 }}
            options={[
              { value: 'opus', label: 'Opus (高级)' },
              { value: 'sonnet', label: 'Sonnet (中级)' },
              { value: 'haiku', label: 'Haiku (轻量)' },
            ]}
          />
        </Space>
      </Card>

      {/* 模型列表 */}
      <Card>
        <Table
          dataSource={models}
          columns={columns}
          loading={loading}
          rowKey="model_id"
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
          scroll={{ x: 1000 }}
          size="middle"
        />
      </Card>

      {/* 模型路由 */}
      <ModelRouter />
    </div>
  );
};

export default ModelsPage;
