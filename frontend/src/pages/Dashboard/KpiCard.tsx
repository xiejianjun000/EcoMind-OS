import React from 'react';
import { Card, Statistic } from 'antd';
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  MinusOutlined,
} from '@ant-design/icons';
import type { KpiData } from './mockData';

interface KpiCardProps {
  data: KpiData;
}

/** Trend icon mapping */
const TrendIcon: React.FC<{ trend?: KpiData['trend'] }> = ({ trend }) => {
  switch (trend) {
    case 'up':
      return <ArrowUpOutlined />;
    case 'down':
      return <ArrowDownOutlined />;
    case 'stable':
      return <MinusOutlined />;
    default:
      return null;
  }
};

/** Trend color */
const trendColor: Record<string, string> = {
  up: '#cf1322',
  down: '#3f8600',
  stable: '#8c8c8c',
};

/** Status border color */
const statusBorder: Record<string, string> = {
  success: '#52c41a',
  warning: '#faad14',
  error: '#ff4d4f',
  default: '#d9d9d9',
};

/** KPI stat card component */
const KpiCard: React.FC<KpiCardProps> = ({ data }) => {
  return (
    <Card
      size="small"
      className="h-full"
      style={{
        borderLeft: `3px solid ${statusBorder[data.status || 'default']}`,
      }}
    >
      <Statistic
        title={data.title}
        value={data.value}
        valueStyle={{ fontSize: '28px', fontWeight: 700 }}
      />
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-gray-400">{data.subtitle}</span>
        {data.trend && (
          <span
            className="flex items-center gap-0.5 text-xs"
            style={{ color: trendColor[data.trend] }}
          >
            <TrendIcon trend={data.trend} />
            {data.trendValue}
          </span>
        )}
      </div>
    </Card>
  );
};

export default KpiCard;
