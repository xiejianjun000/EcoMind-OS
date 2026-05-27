/**
 * Automation 自动化 — 定时巡检、告警、报告自动生成
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Tag, Button, Input, Typography, Row, Col, Switch, Empty, message } from 'antd';
import {
  SearchOutlined, ClockCircleOutlined, AlertOutlined,
  FileTextOutlined, SettingOutlined, PlayCircleOutlined,
  PauseCircleOutlined, HistoryOutlined,
} from '@ant-design/icons';
import { useChatStore } from '@/store/chatStore';

const { Title, Text } = Typography;

interface AutomationItem {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  category: '巡检' | '告警' | '报告';
  schedule: string;
  lastRun?: string;
  enabled: boolean;
  expertId: string;
}

const automations: AutomationItem[] = [
  {
    id: 'patrol-air',
    name: '空气质量定时巡检',
    description: '每小时自动巡检全省14市州空气质量数据，异常值自动标记并推送告警',
    icon: <ClockCircleOutlined />,
    color: '#1890ff',
    category: '巡检',
    schedule: '每小时',
    lastRun: '10分钟前',
    enabled: true,
    expertId: 'env-monitoring',
  },
  {
    id: 'patrol-water',
    name: '水质断面巡检',
    description: '每日自动巡检重点流域水质断面数据，超标自动生成预警报告',
    icon: <ClockCircleOutlined />,
    color: '#096dd9',
    category: '巡检',
    schedule: '每日 08:00',
    lastRun: '今天 08:00',
    enabled: true,
    expertId: 'water',
  },
  {
    id: 'patrol-emission',
    name: '企业排放在线巡检',
    description: '实时监控重点排污企业在线监测数据，异常排放即时告警',
    icon: <ClockCircleOutlined />,
    color: '#13c2c2',
    category: '巡检',
    schedule: '实时',
    lastRun: '持续运行中',
    enabled: true,
    expertId: 'enforcement',
  },
  {
    id: 'alert-aqi',
    name: 'AQI 超标告警',
    description: 'AQI超过150自动触发告警，推送至相关市州生态环境局及省级平台',
    icon: <AlertOutlined />,
    color: '#fa8c16',
    category: '告警',
    schedule: '实时监控',
    lastRun: '持续运行中',
    enabled: true,
    expertId: 'env-monitoring',
  },
  {
    id: 'alert-emergency',
    name: '突发环境事件告警',
    description: '监测到突发环境事件信号时自动启动应急响应流程，通知应急团队',
    icon: <AlertOutlined />,
    color: '#f5222d',
    category: '告警',
    schedule: '实时监控',
    lastRun: '持续运行中',
    enabled: true,
    expertId: 'emergency',
  },
  {
    id: 'alert-compliance',
    name: '合规期限提醒',
    description: '环评审批/排污许可到期前自动提醒，避免超期违规',
    icon: <AlertOutlined />,
    color: '#eb2f96',
    category: '告警',
    schedule: '每日 09:00',
    lastRun: '今天 09:00',
    enabled: false,
    expertId: 'eia',
  },
  {
    id: 'report-daily',
    name: '日报自动生成',
    description: '每日自动汇总全省环境质量数据，生成标准化日报并推送至厅领导',
    icon: <FileTextOutlined />,
    color: '#52c41a',
    category: '报告',
    schedule: '每日 07:00',
    lastRun: '今天 07:00',
    enabled: true,
    expertId: 'gaia',
  },
  {
    id: 'report-weekly',
    name: '周报自动生成',
    description: '每周一自动生成上周环境质量综合分析报告，含趋势对比图表',
    icon: <FileTextOutlined />,
    color: '#237804',
    category: '报告',
    schedule: '每周一 08:00',
    lastRun: '3天前',
    enabled: true,
    expertId: 'gaia',
  },
  {
    id: 'report-monthly',
    name: '月报自动生成',
    description: '每月1日自动生成上月环境质量月报，包含14市州排名与变化分析',
    icon: <FileTextOutlined />,
    color: '#135200',
    category: '报告',
    schedule: '每月1日 08:00',
    lastRun: '25天前',
    enabled: true,
    expertId: 'gaia',
  },
];

const categoryConfig: Record<string, { color: string; bg: string }> = {
  '巡检': { color: '#1890ff', bg: '#1890ff20' },
  '告警': { color: '#fa8c16', bg: '#fa8c1620' },
  '报告': { color: '#52c41a', bg: '#52c41a20' },
};

const AutomationPage: React.FC = () => {
  const navigate = useNavigate();
  const { createSession } = useChatStore();
  const [items, setItems] = useState(automations);
  const [searchText, setSearchText] = useState('');

  const filtered = searchText.trim()
    ? items.filter((a) => a.name.includes(searchText.trim()) || a.description.includes(searchText.trim()))
    : items;

  const handleToggle = (id: string) => {
    setItems((prev) =>
      prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a))
    );
    message.success('自动化状态已更新');
  };

  const handleRunNow = (item: AutomationItem) => {
    const sessionId = createSession({
      title: `执行自动化：${item.name}`,
      expertId: item.expertId,
    });
    navigate(`/chat/${sessionId}`);
    message.success(`已触发：${item.name}`);
  };

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <SettingOutlined style={{ marginRight: 8, color: '#722ed1' }} />
            自动化
          </Title>
          <Text type="secondary">9 项自动化任务，让环境管理全天候在线</Text>
        </div>
        <Input
          prefix={<SearchOutlined />}
          placeholder="搜索自动化任务..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ width: 260 }}
          allowClear
        />
      </div>

      <Row gutter={[16, 16]}>
        {filtered.map((item) => {
          const cat = categoryConfig[item.category] ?? categoryConfig['巡检'];
          return (
            <Col xs={24} sm={12} lg={8} key={item.id}>
              <Card
                hoverable
                className="h-full transition-all duration-200 hover:shadow-md"
                bodyStyle={{ padding: 16 }}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div
                    className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-xl"
                    style={{ backgroundColor: cat.bg, color: cat.color }}
                  >
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-semibold text-base">{item.name}</div>
                      <Switch
                        size="small"
                        checked={item.enabled}
                        onChange={() => handleToggle(item.id)}
                      />
                    </div>
                    <Text type="secondary" className="text-xs">
                      {item.description.length > 50
                        ? item.description.slice(0, 50) + '...'
                        : item.description}
                    </Text>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1 mb-3">
                  <Tag color={cat.color} style={{ margin: 0 }}>
                    {item.category}
                  </Tag>
                  <Tag
                    style={{ margin: 0 }}
                    icon={<ClockCircleOutlined />}
                  >
                    {item.schedule}
                  </Tag>
                </div>

                {item.lastRun && (
                  <div className="flex items-center gap-1 mb-3 text-xs text-muted-foreground">
                    <HistoryOutlined />
                    <span>上次运行: {item.lastRun}</span>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    type="primary"
                    size="small"
                    icon={<PlayCircleOutlined />}
                    onClick={() => handleRunNow(item)}
                    style={{
                      backgroundColor: item.enabled ? cat.color : undefined,
                      borderColor: item.enabled ? cat.color : undefined,
                    }}
                    disabled={!item.enabled}
                  >
                    立即执行
                  </Button>
                  {item.enabled ? (
                    <Button
                      size="small"
                      icon={<PauseCircleOutlined />}
                      onClick={() => handleToggle(item.id)}
                    >
                      暂停
                    </Button>
                  ) : (
                    <Button
                      size="small"
                      type="primary"
                      icon={<PlayCircleOutlined />}
                      onClick={() => handleToggle(item.id)}
                    >
                      启用
                    </Button>
                  )}
                </div>
              </Card>
            </Col>
          );
        })}
      </Row>

      {filtered.length === 0 && <Empty description="未找到匹配的自动化任务" />}
    </div>
  );
};

export default AutomationPage;
