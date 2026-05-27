/**
 * Connectors 连接器 — 数据源接入管理
 */
import React, { useState, useMemo } from 'react';
import { Card, Tag, Button, Input, Typography, Row, Col, Space, Badge, Empty } from 'antd';
import {
  SearchOutlined, ApiOutlined, RadarChartOutlined,
  RocketOutlined, BankOutlined, CloudOutlined,
  CheckCircleOutlined, CloseCircleOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useExpertStore } from '@/store/expertStore';

const { Title, Text } = Typography;

const iconMap: Record<string, React.ReactNode> = {
  RadarChartOutlined: <RadarChartOutlined />,
  ApiOutlined: <ApiOutlined />,
  RocketOutlined: <RocketOutlined />,
  BankOutlined: <BankOutlined />,
  CloudOutlined: <CloudOutlined />,
};

const typeLabels: Record<string, string> = {
  monitoring_station: '监测站',
  iot: 'IoT设备',
  satellite: '卫星遥感',
  government: '政务系统',
  weather: '气象数据',
};

const typeColors: Record<string, string> = {
  monitoring_station: '#1890ff',
  iot: '#13c2c2',
  satellite: '#722ed1',
  government: '#f5222d',
  weather: '#52c41a',
};

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  connected: { color: '#52c41a', icon: <CheckCircleOutlined />, label: '已连接' },
  disconnected: { color: '#bfbfbf', icon: <CloseCircleOutlined />, label: '未连接' },
  error: { color: '#ff4d4f', icon: <ExclamationCircleOutlined />, label: '异常' },
};

const ConnectorsPage: React.FC = () => {
  const { connectors } = useExpertStore();
  const [searchText, setSearchText] = useState('');

  const filteredConnectors = useMemo(() => {
    if (!searchText.trim()) return connectors;
    const kw = searchText.trim().toLowerCase();
    return connectors.filter(
      (c) =>
        c.name.toLowerCase().includes(kw) ||
        c.description.toLowerCase().includes(kw) ||
        c.type.toLowerCase().includes(kw)
    );
  }, [connectors, searchText]);

  const handleTest = (name: string) => {
    console.log(`测试连接: ${name}`);
  };

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <ApiOutlined style={{ marginRight: 8, color: '#13c2c2' }} />
            连接器
          </Title>
          <Text type="secondary">5 个数据源连接器，实时接入生态环境数据</Text>
        </div>
        <Input
          prefix={<SearchOutlined />}
          placeholder="搜索连接器..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ width: 260 }}
          allowClear
        />
      </div>

      <Row gutter={[16, 16]}>
        {filteredConnectors.map((conn) => {
          const status = statusConfig[conn.status] ?? statusConfig.disconnected;
          return (
            <Col xs={24} sm={12} lg={8} xl={6} key={conn.id}>
              <Card
                hoverable
                className="h-full transition-all duration-200 hover:shadow-md"
                bodyStyle={{ padding: 16 }}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="relative flex-shrink-0">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-xl"
                      style={{ backgroundColor: `${typeColors[conn.type]}20`, color: typeColors[conn.type] }}
                    >
                      {iconMap[conn.icon] ?? <ApiOutlined />}
                    </div>
                    <Badge
                      color={status.color}
                      dot
                      offset={[-2, 2]}
                      style={{ position: 'absolute', bottom: -4, right: -4 }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-base">{conn.name}</div>
                    <Text type="secondary" className="text-xs">
                      {conn.description.length > 40
                        ? conn.description.slice(0, 40) + '...'
                        : conn.description}
                    </Text>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 mb-3">
                  <Tag color={typeColors[conn.type]} style={{ margin: 0 }}>
                    {typeLabels[conn.type] ?? conn.type}
                  </Tag>
                  <Tag
                    color={status.color}
                    style={{ margin: 0 }}
                    icon={status.icon}
                  >
                    {status.label}
                  </Tag>
                </div>

                <Button
                  type={conn.status === 'connected' ? 'default' : 'primary'}
                  block
                  icon={<ApiOutlined />}
                  onClick={() => handleTest(conn.name)}
                  disabled={conn.status === 'disconnected'}
                >
                  {conn.status === 'connected' ? '测试连接' : conn.status === 'error' ? '重新连接' : '未接入'}
                </Button>
              </Card>
            </Col>
          );
        })}
      </Row>

      {filteredConnectors.length === 0 && <Empty description="未找到匹配的连接器" />}
    </div>
  );
};

export default ConnectorsPage;
