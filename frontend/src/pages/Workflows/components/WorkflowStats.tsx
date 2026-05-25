/**
 * 工作流状态统计卡片
 */
import React from 'react';
import { Row, Col, Card, Statistic } from 'antd';
import {
  ClockCircleOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import type { WorkflowResponse } from '@/services/types';

interface WorkflowStatsProps {
  workflows: WorkflowResponse[];
  loading: boolean;
}

const WorkflowStats: React.FC<WorkflowStatsProps> = ({ workflows, loading }) => {
  const pending = workflows.filter((w) => w.status === 'pending').length;
  const running = workflows.filter((w) => w.status === 'running').length;
  const completed = workflows.filter((w) => w.status === 'completed').length;
  const failed = workflows.filter((w) => w.status === 'failed').length;

  const cards = [
    {
      title: '待执行',
      value: pending,
      icon: <ClockCircleOutlined style={{ fontSize: 24, color: '#1890ff' }} />,
      color: '#1890ff',
    },
    {
      title: '运行中',
      value: running,
      icon: <PlayCircleOutlined style={{ fontSize: 24, color: '#52c41a' }} />,
      color: '#52c41a',
    },
    {
      title: '已完成',
      value: completed,
      icon: <CheckCircleOutlined style={{ fontSize: 24, color: '#13c2c2' }} />,
      color: '#13c2c2',
    },
    {
      title: '失败',
      value: failed,
      icon: <CloseCircleOutlined style={{ fontSize: 24, color: '#ff4d4f' }} />,
      color: '#ff4d4f',
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

export default WorkflowStats;
