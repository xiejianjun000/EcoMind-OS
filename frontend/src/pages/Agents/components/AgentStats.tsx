/**
 * Agent 状态统计卡片
 */
import React from 'react';
import { Row, Col, Card, Statistic } from 'antd';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  StopOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import type { AgentResponse } from '@/services/types';

interface AgentStatsProps {
  agents: AgentResponse[];
  loading: boolean;
}

const AgentStats: React.FC<AgentStatsProps> = ({ agents, loading }) => {
  const running = agents.filter((a) => a.status === 'running').length;
  const paused = agents.filter((a) => a.status === 'paused').length;
  const stopped = agents.filter((a) => a.status === 'stopped').length;
  const total = agents.length;

  const cards = [
    {
      title: '运行中',
      value: running,
      icon: <PlayCircleOutlined style={{ fontSize: 24, color: '#52c41a' }} />,
      color: '#52c41a',
    },
    {
      title: '已暂停',
      value: paused,
      icon: <PauseCircleOutlined style={{ fontSize: 24, color: '#faad14' }} />,
      color: '#faad14',
    },
    {
      title: '已停止',
      value: stopped,
      icon: <StopOutlined style={{ fontSize: 24, color: '#ff4d4f' }} />,
      color: '#ff4d4f',
    },
    {
      title: '总 Agent 数',
      value: total,
      icon: <RobotOutlined style={{ fontSize: 24, color: '#1890ff' }} />,
      color: '#1890ff',
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

export default AgentStats;
