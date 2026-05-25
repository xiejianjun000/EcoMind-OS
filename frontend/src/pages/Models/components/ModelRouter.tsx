/**
 * 模型路由测试组件
 */
import React, { useState } from 'react';
import { Card, Select, Button, Descriptions, Tag, Space, Typography, Switch } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import { modelApi, safeCall } from '@/services/api';
import type { ModelTier, ModelRouteResponse } from '@/services/types';

const { Text, Paragraph } = Typography;

const ModelRouter: React.FC = () => {
  const [tier, setTier] = useState<ModelTier>('sonnet');
  const [taskType, setTaskType] = useState('chat');
  const [preferLocal, setPreferLocal] = useState(false);
  const [routing, setRouting] = useState(false);
  const [result, setResult] = useState<ModelRouteResponse | null>(null);

  const handleRoute = async () => {
    setRouting(true);
    const res = await safeCall(() =>
      modelApi.route({
        tier,
        task_type: taskType,
        prefer_local: preferLocal,
      })
    );
    if (res) {
      setResult(res);
    }
    setRouting(false);
  };

  const tierColorMap: Record<ModelTier, string> = {
    opus: 'purple',
    sonnet: 'blue',
    haiku: 'green',
  };

  return (
    <Card
      title={
        <Space>
          <ThunderboltOutlined />
          <span>模型路由</span>
        </Space>
      }
    >
      <Space direction="vertical" className="w-full" size="middle">
        <Space wrap>
          <span>目标层级：</span>
          <Select
            value={tier}
            onChange={setTier}
            style={{ width: 140 }}
            options={[
              { value: 'opus', label: 'Opus (高级)' },
              { value: 'sonnet', label: 'Sonnet (中级)' },
              { value: 'haiku', label: 'Haiku (轻量)' },
            ]}
          />
          <span>任务类型：</span>
          <Select
            value={taskType}
            onChange={setTaskType}
            style={{ width: 140 }}
            options={[
              { value: 'chat', label: '对话' },
              { value: 'code', label: '代码' },
              { value: 'analysis', label: '分析' },
            ]}
          />
          <span>优先本地：</span>
          <Switch checked={preferLocal} onChange={setPreferLocal} />
          <Button type="primary" loading={routing} onClick={handleRoute}>
            路由测试
          </Button>
        </Space>

        {result && (
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="路由模型">
              <Tag color={tierColorMap[result.tier]}>{result.routed_model}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="提供商">
              <Tag>{result.provider}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="层级">
              <Tag color={tierColorMap[result.tier]}>{result.tier}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="API 地址">
              <Text copyable className="text-xs">
                {result.api_base || '—'}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="路由原因" span={2}>
              {result.reason || '—'}
            </Descriptions.Item>
            {result.fallback && (
              <Descriptions.Item label="备选模型" span={2}>
                <Tag>{result.fallback}</Tag>
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Space>
    </Card>
  );
};

export default ModelRouter;
