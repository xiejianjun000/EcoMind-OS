/**
 * CommandCockpit — 指挥驾驶舱 (QClaw CommandCockpit + WorkBuddy Dashboard 对应)
 *
 * 全景指挥面板，集成:
 * - 实时态势感知 (Real-time Situation Awareness)
 * - 智能体调度状态 (Agent Orchestration)
 * - 执法/监控告警流 (Alert Stream)
 * - 关键指标仪表盘 (KPI Dashboard)
 * - 快速操作入口 (Quick Actions)
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Card, Tag, Button, Typography, Row, Col, Space, Badge,
  Statistic, Progress, Timeline, List, Tooltip, Tabs,
  Skeleton, Segmented, Avatar,
} from 'antd';
import {
  ThunderboltOutlined, SafetyOutlined, GlobalOutlined,
  AlertOutlined, CheckCircleOutlined, SyncOutlined,
  ClockCircleOutlined, TeamOutlined, RobotOutlined,
  DashboardOutlined, WarningOutlined, FireOutlined,
  EnvironmentOutlined, ExperimentOutlined, CloudOutlined,
  ApiOutlined, SettingOutlined, BellOutlined,
  ReloadOutlined, ArrowUpOutlined, ArrowDownOutlined,
  LineChartOutlined, FundOutlined, AppstoreOutlined,
} from '@ant-design/icons';
import { useExpertStore, useAgentStore, useAutomationStore } from '@/store';

const { Title, Text } = Typography;

// ─── 模拟实时数据 ───

interface KPIData {
  label: string;
  value: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  change: number;
  icon: React.ReactNode;
  color: string;
}

interface AlertItem {
  id: string;
  level: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  source: string;
  time: string;
  acknowledged: boolean;
}

interface AgentStatus {
  id: string;
  name: string;
  role: string;
  status: 'online' | 'busy' | 'idle' | 'offline';
  currentTask?: string;
  load: number; // 0-100
  sessions: number;
}

const KPI_DATA: KPIData[] = [
  { label: 'AQI 指数', value: 62, unit: '', trend: 'down', change: 8, icon: <CloudOutlined />, color: '#52c41a' },
  { label: '水质达标率', value: 94.2, unit: '%', trend: 'up', change: 2.1, icon: <ExperimentOutlined />, color: '#1677ff' },
  { label: '执法案卷数', value: 1287, unit: '件', trend: 'up', change: 12, icon: <SafetyOutlined />, color: '#722ed1' },
  { label: '在线设备', value: 4856, unit: '台', trend: 'up', change: 54, icon: <ApiOutlined />, color: '#13c2c2' },
  { label: '预警处置率', value: 87.5, unit: '%', trend: 'up', change: 3.2, icon: <AlertOutlined />, color: '#fa8c16' },
  { label: '专家响应', value: 0.8, unit: 's', trend: 'down', change: 0.2, icon: <RobotOutlined />, color: '#52c41a' },
];

const ALERTS: AlertItem[] = [
  { id: 'a1', level: 'critical', title: 'PM2.5 超标预警', message: '开福区监测站 PM2.5 已达 158μg/m³，超过二级标准', source: '空气质量监测', time: '2 分钟前', acknowledged: false },
  { id: 'a2', level: 'warning', title: '污水处理厂排放异常', message: '岳麓污水处理厂 COD 排放浓度持续偏高', source: '污水监测', time: '15 分钟前', acknowledged: false },
  { id: 'a3', level: 'info', title: '月报生成完成', message: '2026年5月环境执法月报已自动生成，待审核', source: '系统任务', time: '30 分钟前', acknowledged: true },
  { id: 'a4', level: 'warning', title: '噪声投诉激增', message: '天心区夜间施工噪声投诉较上月增长 45%', source: '信访系统', time: '1 小时前', acknowledged: false },
  { id: 'a5', level: 'info', title: '设备离线通知', message: '望城区 3 号监测站数据中断超过 30 分钟', source: '设备管理', time: '2 小时前', acknowledged: true },
];

const AGENT_STATUSES: AgentStatus[] = [
  { id: 'zhang_chufa_01', name: '张处长', role: '执法监察', status: 'busy', currentTask: '审核案卷 EJ-2026-0582', load: 72, sessions: 12 },
  { id: 'li_engineer_02', name: '李工程师', role: '环境监测', status: 'online', currentTask: '水质分析报告', load: 45, sessions: 8 },
  { id: 'wang_analyst_03', name: '王分析师', role: '数据分析', status: 'idle', load: 15, sessions: 3 },
  { id: 'zhao_lawyer_04', name: '赵律师', role: '法规合规', status: 'online', currentTask: '审核新规草案', load: 60, sessions: 5 },
];

// ─── 主组件 ───

const CommandCockpit: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // 获取 store 数据
  const experts = useExpertStore(s => s.experts);
  const activeAgentId = useAgentStore((s: any) => s.activeAgentId);
  const automationTasks = useAutomationStore((s: any) => s.tasks);

  // 模拟数据加载
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, [refreshKey]);

  const handleRefresh = () => {
    setLoading(true);
    setRefreshKey(k => k + 1);
  };

  // KPI 卡片
  const renderKPICard = (kpi: KPIData) => (
    <Col xs={12} sm={8} md={4} key={kpi.label}>
      <Card size="small" bordered={false} style={{ background: '#fafafa', height: '100%' }}>
        {loading ? <Skeleton active paragraph={{ rows: 1 }} /> : (
          <Statistic
            title={
              <Space size={4}>
                {kpi.icon}
                <Text type="secondary" style={{ fontSize: 12 }}>{kpi.label}</Text>
              </Space>
            }
            value={kpi.value}
            suffix={kpi.unit}
            valueStyle={{ fontSize: 24, color: kpi.color }}
            precision={kpi.value % 1 !== 0 ? 1 : 0}
          />
        )}
        {!loading && (
          <div style={{ marginTop: 4 }}>
            <Text type={kpi.trend === 'down' && (kpi.label.includes('AQI') || kpi.label.includes('响应')) ? 'success' : kpi.trend === 'up' ? 'success' : 'secondary'} style={{ fontSize: 11 }}>
              {kpi.trend === 'up' ? <ArrowUpOutlined /> : kpi.trend === 'down' ? <ArrowDownOutlined /> : '—'}
              {' '}{kpi.change}{kpi.unit || '%'} vs 上周
            </Text>
          </div>
        )}
      </Card>
    </Col>
  );

  // 告警列表
  const renderAlertItem = (alert: AlertItem) => (
    <List.Item
      key={alert.id}
      style={{
        padding: '8px 12px',
        background: alert.level === 'critical' ? '#fff1f0' : alert.level === 'warning' ? '#fff7e6' : undefined,
        borderRadius: 6,
        marginBottom: 4,
        borderLeft: `3px solid ${
          alert.level === 'critical' ? '#ff4d4f' : alert.level === 'warning' ? '#faad14' : '#1677ff'
        }`,
      }}
    >
      <List.Item.Meta
        avatar={
          <Tag color={
            alert.level === 'critical' ? 'red' : alert.level === 'warning' ? 'orange' : 'blue'
          } style={{ margin: 0 }}>
            {alert.level === 'critical' ? '紧急' : alert.level === 'warning' ? '警告' : '通知'}
          </Tag>
        }
        title={
          <Space size={4}>
            {!alert.acknowledged && <Badge status="processing" />}
            <Text strong style={{ fontSize: 13 }}>{alert.title}</Text>
          </Space>
        }
        description={
          <div>
            <Text type="secondary" style={{ fontSize: 11 }}>{alert.message}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 10 }}>
              <ClockCircleOutlined /> {alert.time} · {alert.source}
            </Text>
          </div>
        }
      />
    </List.Item>
  );

  // 智能体状态
  const renderAgentCard = (agent: AgentStatus) => {
    const statusColor = {
      online: '#52c41a',
      busy: '#faad14',
      idle: '#d9d9d9',
      offline: '#ff4d4f',
    };
    const statusLabel = {
      online: '在线',
      busy: '忙碌',
      idle: '空闲',
      offline: '离线',
    };

    return (
      <Card
        key={agent.id}
        size="small"
        hoverable
        style={{ borderRadius: 8, marginBottom: 8 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            <Avatar size={36} style={{ background: statusColor[agent.status] }}>
              <RobotOutlined />
            </Avatar>
            <div style={{
              position: 'absolute',
              bottom: -2,
              right: -2,
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: statusColor[agent.status],
              border: '2px solid white',
            }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text strong style={{ fontSize: 13 }}>{agent.name}</Text>
              <Tag color={agent.status === 'online' ? 'success' : agent.status === 'busy' ? 'warning' : agent.status === 'offline' ? 'error' : 'default'} style={{ fontSize: 10 }}>
                {statusLabel[agent.status]}
              </Tag>
            </div>
            <Text type="secondary" style={{ fontSize: 11 }}>{agent.role}</Text>
            {agent.currentTask && (
              <div style={{ marginTop: 4 }}>
                <Text style={{ fontSize: 11 }}>📋 {agent.currentTask}</Text>
              </div>
            )}
            <div style={{ marginTop: 4 }}>
              <Progress percent={agent.load} size="small" showInfo={false}
                strokeColor={agent.load > 70 ? '#ff4d4f' : agent.load > 40 ? '#faad14' : '#52c41a'}
              />
              <Space size={8}>
                <Text type="secondary" style={{ fontSize: 10 }}>负载 {agent.load}%</Text>
                <Text type="secondary" style={{ fontSize: 10 }}>会话 {agent.sessions}</Text>
              </Space>
            </div>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="p-4 md:p-6" style={{ height: '100%', overflow: 'auto' }}>
      {/* 顶部标题栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <DashboardOutlined /> 指挥驾驶舱
          </Title>
          <Text type="secondary">实时态势感知 · 智能体调度 · 告警监控</Text>
        </div>
        <Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            数据刷新: {new Date().toLocaleTimeString('zh-CN')}
          </Text>
          <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={loading}>刷新</Button>
        </Space>
      </div>

      {/* KPI 指标行 */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {KPI_DATA.map(renderKPICard)}
      </Row>

      {/* 三栏布局 */}
      <Row gutter={[16, 16]}>
        {/* 左栏: 实时告警 */}
        <Col xs={24} lg={8}>
          <Card
            title={<Space><BellOutlined /><span>实时告警</span></Space>}
            extra={<Badge count={ALERTS.filter(a => !a.acknowledged).length} />}
            size="small"
            style={{ height: '100%' }}
            bodyStyle={{ maxHeight: 500, overflow: 'auto' }}
          >
            {loading ? (
              <Skeleton active paragraph={{ rows: 4 }} />
            ) : (
              <List
                dataSource={ALERTS}
                renderItem={renderAlertItem}
                split={false}
              />
            )}
          </Card>
        </Col>

        {/* 中栏: 智能体调度 */}
        <Col xs={24} lg={9}>
          <Card
            title={<Space><RobotOutlined /><span>智能体调度</span></Space>}
            extra={<Tag color="green">{AGENT_STATUSES.filter(a => a.status !== 'offline').length} 在线</Tag>}
            size="small"
            style={{ height: '100%' }}
          >
            {loading ? (
              <Skeleton active paragraph={{ rows: 4 }} />
            ) : (
              <div style={{ maxHeight: 500, overflow: 'auto' }}>
                {AGENT_STATUSES.map(renderAgentCard)}
              </div>
            )}
            <div style={{ marginTop: 8, textAlign: 'center' }}>
              <Button type="dashed" size="small" block>
                <TeamOutlined /> 调度新智能体
              </Button>
            </div>
          </Card>
        </Col>

        {/* 右栏: 系统概览 + 快捷操作 */}
        <Col xs={24} lg={7}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* 系统健康度 */}
            <Card
              title={<Space><FundOutlined /><span>系统健康度</span></Space>}
              size="small"
            >
              {loading ? <Skeleton active /> : (
                <div>
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 12 }}>API 网关</Text>
                      <Text type="success" style={{ fontSize: 12 }}>99.9%</Text>
                    </div>
                    <Progress percent={99.9} size="small" showInfo={false} strokeColor="#52c41a" />
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 12 }}>LLM 服务</Text>
                      <Text type="success" style={{ fontSize: 12 }}>正常</Text>
                    </div>
                    <Progress percent={95} size="small" showInfo={false} strokeColor="#1677ff" />
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 12 }}>模型推理</Text>
                      <Text style={{ fontSize: 12, color: '#faad14' }}>轻微延迟</Text>
                    </div>
                    <Progress percent={78} size="small" showInfo={false} strokeColor="#faad14" />
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 12 }}>数据同步</Text>
                      <Text type="success" style={{ fontSize: 12 }}>正常</Text>
                    </div>
                    <Progress percent={100} size="small" showInfo={false} strokeColor="#52c41a" />
                  </div>
                </div>
              )}
            </Card>

            {/* 任务概览 */}
            <Card
              title={<Space><ClockCircleOutlined /><span>任务概览</span></Space>}
              size="small"
            >
              {loading ? <Skeleton active /> : (
                <Row gutter={[8, 8]}>
                  <Col span={8}>
                    <Statistic title="运行中" value={automationTasks?.filter((t: any) => t.status === 'active').length || 3} valueStyle={{ fontSize: 18, color: '#1677ff' }} suffix="个" />
                  </Col>
                  <Col span={8}>
                    <Statistic title="已暂停" value={automationTasks?.filter((t: any) => t.status === 'paused').length || 1} valueStyle={{ fontSize: 18, color: '#faad14' }} suffix="个" />
                  </Col>
                  <Col span={8}>
                    <Statistic title="已归档" value={automationTasks?.filter((t: any) => t.status === 'ended').length || 5} valueStyle={{ fontSize: 18 }} suffix="个" />
                  </Col>
                </Row>
              )}
            </Card>

            {/* 专家分布 */}
            <Card
              title={<Space><TeamOutlined /><span>专家在岗</span></Space>}
              size="small"
            >
              {loading ? <Skeleton active /> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {experts.slice(0, 5).map((expert: any) => (
                    <div key={expert.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Space size={4}>
                        <Badge status={expert.status === 'online' ? 'success' : 'default'} />
                        <Text style={{ fontSize: 12 }}>{expert.name}</Text>
                      </Space>
                      <Tag style={{ fontSize: 10 }}>{expert.domain}</Tag>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </Col>
      </Row>
    </div>
  );
};

export default CommandCockpit;
