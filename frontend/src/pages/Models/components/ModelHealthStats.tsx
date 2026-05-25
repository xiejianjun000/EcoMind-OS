/**
 * 模型健康状态总览卡片
 */
import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Tag, Spin } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  CloudServerOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { modelApi, safeCall } from '@/services/api';
import type { ModelHealthResponse } from '@/services/types';

interface ModelHealthStatsProps {
  totalModels: number;
}

const ModelHealthStats: React.FC<ModelHealthStatsProps> = ({ totalModels }) => {
  const [health, setHealth] = useState<ModelHealthResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchHealth = async () => {
    setLoading(true);
    const result = await safeCall(() => modelApi.health());
    if (result) {
      setHealth(result);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const online = health?.models.filter((m: Record<string, unknown>) => m.status === 'online').length ?? 0;
  const offline = health?.models.filter((m: Record<string, unknown>) => m.status === 'offline').length ?? 0;

  const cards = [
    {
      title: '在线模型',
      value: online,
      icon: <CheckCircleOutlined style={{ fontSize: 24, color: '#52c41a' }} />,
      color: '#52c41a',
    },
    {
      title: '离线模型',
      value: offline,
      icon: <CloseCircleOutlined style={{ fontSize: 24, color: '#ff4d4f' }} />,
      color: '#ff4d4f',
    },
    {
      title: '总模型数',
      value: totalModels,
      icon: <CloudServerOutlined style={{ fontSize: 24, color: '#1890ff' }} />,
      color: '#1890ff',
    },
    {
      title: '系统健康',
      value: health?.healthy ? '正常' : '异常',
      icon: health?.healthy ? (
        <CheckCircleOutlined style={{ fontSize: 24, color: '#52c41a' }} />
      ) : (
        <CloseCircleOutlined style={{ fontSize: 24, color: '#ff4d4f' }} />
      ),
      color: health?.healthy ? '#52c41a' : '#ff4d4f',
    },
  ];

  return (
    <Row gutter={[16, 16]}>
      {cards.map((card, idx) => (
        <Col xs={24} sm={12} lg={6} key={idx}>
          <Card hoverable loading={loading} className="h-full">
            <div className="flex items-center justify-between">
              <Statistic
                title={card.title}
                value={card.value}
                valueStyle={{ color: card.color, fontWeight: 700 }}
              />
              {card.icon}
            </div>
          </Card>
        </Col>
      ))}
    </Row>
  );
};

export default ModelHealthStats;
