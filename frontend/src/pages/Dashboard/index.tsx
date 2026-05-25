import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Row,
  Col,
  Card,
  Statistic,
  Badge,
  Tag,
  Table,
  Timeline,
  Typography,
  Space,
} from 'antd';
import {
  RobotOutlined,
  DashboardOutlined,
  SafetyCertificateOutlined,
  AuditOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  WarningOutlined,
  ThunderboltOutlined,
  CloudServerOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';

const { Title, Text } = Typography;

/* ---------- Mock Data ---------- */

const agentData = [
  { key: '1', name: '执法监察 Agent', type: 'opus', level: 'L5', status: 'online', model: 'DeepSeek-671B', tasks: 23, uptime: '99.2%' },
  { key: '2', name: '环境监测 Agent', type: 'sonnet', level: 'L4', status: 'online', model: 'Qwen3-14B', tasks: 156, uptime: '99.8%' },
  { key: '3', name: '政务审批 Agent', type: 'opus', level: 'L5', status: 'online', model: 'Qwen3-72B', tasks: 8, uptime: '98.5%' },
  { key: '4', name: '公众服务 Agent', type: 'sonnet', level: 'L4', status: 'offline', model: 'GLM-4-9B', tasks: 0, uptime: '—' },
];

const securityEvents = [
  { id: 'SE-001', type: 'VERIFY 幻觉检测', level: 'warning', detail: '执法监察 Agent 回答偏差 ΔS=0.23', time: '2 分钟前', status: '已拦截' },
  { id: 'SE-002', type: 'SM2 证书验证', level: 'success', detail: '政务审批 Agent 国密签名验证通过', time: '15 分钟前', status: '通过' },
  { id: 'SE-003', type: 'GOVMCP 审批流', level: 'info', detail: '排污许可证变更待三级审批', time: '1 小时前', status: '审批中' },
  { id: 'SE-004', type: 'VERIFY 幻觉检测', level: 'error', detail: '公众服务 Agent 事实性错误 ΔS=0.41', time: '3 小时前', status: '已纠正' },
];

const approvalQueue = [
  { id: 'AP-001', requester: '执法监察 Agent', action: '发布环境执法通报', level: 'L2', required: '单签', time: '5 分钟前' },
  { id: 'AP-002', requester: '政务审批 Agent', action: '环评报告正式签章', level: 'L3', required: '双因子+会签', time: '22 分钟前' },
  { id: 'AP-003', requester: '环境监测 Agent', action: '调用外部气象 API', level: 'L2', required: '单签', time: '1 小时前' },
];

const recentActivity = [
  { color: 'green', children: '环境监测 Agent 完成湘江水质数据采集（12 站点）' },
  { color: 'blue', children: '政务审批 Agent 启动环评报告审批工作流' },
  { color: 'orange', children: 'VERIFY 拦截执法监察 Agent 1 次幻觉输出' },
  { color: 'green', children: '执法监察 Agent 完成现场取证任务 #2026-0512' },
  { color: 'red', children: 'GOVMCP 审批超时预警：排污许可证变更 30min 未响应' },
  { color: 'blue', children: '模型路由：Qwen3-14B → DeepSeek-671B（复杂推理升级）' },
];

/* ---------- Component ---------- */

const DashboardPage: React.FC = () => {
  const { t } = useTranslation();

  /* ---- Stat Cards ---- */
  const statCards = [
    {
      title: t('dashboardPage.onlineAgents'),
      value: 3,
      suffix: '/ 4',
      icon: <RobotOutlined style={{ fontSize: 28, color: '#52c41a' }} />,
      color: '#52c41a',
    },
    {
      title: t('dashboardPage.gpuUsage'),
      value: 67,
      suffix: '%',
      icon: <DashboardOutlined style={{ fontSize: 28, color: '#1890ff' }} />,
      color: '#1890ff',
    },
    {
      title: t('dashboardPage.alerts24h'),
      value: 2,
      suffix: t('common.online'),
      icon: <SafetyCertificateOutlined style={{ fontSize: 28, color: '#faad14' }} />,
      color: '#faad14',
    },
    {
      title: t('dashboardPage.pendingApprovals'),
      value: 3,
      suffix: t('common.online'),
      icon: <AuditOutlined style={{ fontSize: 28, color: '#ff4d4f' }} />,
      color: '#ff4d4f',
    },
  ];

  /* ---- Agent Table Columns ---- */
  const agentColumns = [
    {
      title: 'Agent',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: typeof agentData[0]) => (
        <Space>
          <Badge status={record.status === 'online' ? 'success' : 'default'} />
          <Text strong>{text}</Text>
        </Space>
      ),
    },
    {
      title: '类型 / 级别',
      key: 'typeLevel',
      render: (_: unknown, record: typeof agentData[0]) => (
        <Space>
          <Tag color={record.type === 'opus' ? 'purple' : 'blue'}>{record.type}</Tag>
          <Tag color={record.level === 'L5' ? 'red' : 'orange'}>{record.level}</Tag>
        </Space>
      ),
    },
    {
      title: '当前模型',
      dataIndex: 'model',
      key: 'model',
      render: (text: string) => (
        <Space>
          <CloudServerOutlined />
          <Text>{text}</Text>
        </Space>
      ),
    },
    {
      title: '任务数',
      dataIndex: 'tasks',
      key: 'tasks',
      align: 'center' as const,
    },
    {
      title: '可用率',
      dataIndex: 'uptime',
      key: 'uptime',
      align: 'center' as const,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'online' ? 'success' : 'default'} icon={status === 'online' ? <CheckCircleOutlined /> : <CloseCircleOutlined />}>
          {status === 'online' ? t('common.online') : t('common.offline')}
        </Tag>
      ),
    },
  ];

  /* ---- Security Event Table Columns ---- */
  const securityColumns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 90,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: '级别',
      dataIndex: 'level',
      key: 'level',
      render: (level: string) => {
        const map: Record<string, { color: string; icon: React.ReactNode }> = {
          error: { color: 'red', icon: <CloseCircleOutlined /> },
          warning: { color: 'orange', icon: <WarningOutlined /> },
          success: { color: 'green', icon: <CheckCircleOutlined /> },
          info: { color: 'blue', icon: <SyncOutlined /> },
        };
        const cfg = map[level] || map.info;
        return <Tag color={cfg.color} icon={cfg.icon}>{level.toUpperCase()}</Tag>;
      },
    },
    {
      title: '详情',
      dataIndex: 'detail',
      key: 'detail',
      ellipsis: true,
    },
    {
      title: '时间',
      dataIndex: 'time',
      key: 'time',
      width: 100,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (text: string) => <Tag>{text}</Tag>,
    },
  ];

  /* ---- Approval Queue Columns ---- */
  const approvalColumns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 90 },
    { title: '请求方', dataIndex: 'requester', key: 'requester' },
    { title: '操作', dataIndex: 'action', key: 'action', ellipsis: true },
    {
      title: '安全级别',
      dataIndex: 'level',
      key: 'level',
      render: (level: string) => <Tag color={level === 'L3' ? 'red' : 'orange'}>{level}</Tag>,
    },
    { title: '审批要求', dataIndex: 'required', key: 'required' },
    { title: '时间', dataIndex: 'time', key: 'time', width: 100 },
  ];

  /* ---- ECharts: GPU Usage Gauge ---- */
  const gpuChartOption = {
    series: [
      {
        type: 'gauge',
        startAngle: 210,
        endAngle: -30,
        min: 0,
        max: 100,
        pointer: { show: true },
        progress: {
          show: true,
          width: 14,
        },
        axisLine: {
          lineStyle: { width: 14, color: [[0.6, '#52c41a'], [0.85, '#faad14'], [1, '#ff4d4f']] },
        },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        detail: { valueAnimation: true, fontSize: 22, offsetCenter: [0, '70%'], formatter: '{value}%' },
        data: [{ value: 67, name: 'GPU' }],
        title: { offsetCenter: [0, '95%'], fontSize: 13 },
      },
    ],
  };

  /* ---- ECharts: Model Routing Status ---- */
  const modelRoutingOption = {
    tooltip: { trigger: 'item' },
    legend: { bottom: '5%', left: 'center', textStyle: { fontSize: 11 } },
    series: [
      {
        name: '模型路由',
        type: 'pie',
        radius: ['40%', '65%'],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 6, borderColor: '#1a1a1a', borderWidth: 2 },
        label: { show: true, fontSize: 11, formatter: '{b}\n{d}%' },
        data: [
          { value: 45, name: 'Qwen3-14B', itemStyle: { color: '#1890ff' } },
          { value: 28, name: 'DeepSeek-671B', itemStyle: { color: '#722ed1' } },
          { value: 18, name: 'Qwen3-72B', itemStyle: { color: '#13c2c2' } },
          { value: 9, name: 'GLM-4-9B', itemStyle: { color: '#52c41a' } },
        ],
      },
    ],
  };

  /* ---- ECharts: 24h Inference Trend ---- */
  const inferenceTrendOption = {
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00', '24:00'],
      axisLine: { lineStyle: { color: '#555' } },
      axisLabel: { color: '#999', fontSize: 10 },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#333' } },
      axisLabel: { color: '#999', fontSize: 10 },
    },
    series: [
      {
        name: '推理请求',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        lineStyle: { width: 2, color: '#1890ff' },
        itemStyle: { color: '#1890ff' },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(24,144,255,0.35)' },
              { offset: 1, color: 'rgba(24,144,255,0.02)' },
            ],
          },
        },
        data: [120, 82, 156, 389, 467, 312, 198],
      },
    ],
  };

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div>
        <Title level={3} style={{ margin: 0 }}>{t('dashboard.title')}</Title>
        <Text type="secondary">{t('dashboard.description')}</Text>
      </div>

      {/* Row 1: Stat Cards */}
      <Row gutter={[16, 16]}>
        {statCards.map((card, idx) => (
          <Col xs={24} sm={12} lg={6} key={idx}>
            <Card hoverable className="h-full">
              <div className="flex items-center justify-between">
                <Statistic
                  title={<Text type="secondary" className="text-sm">{card.title}</Text>}
                  value={card.value}
                  suffix={card.suffix}
                  valueStyle={{ color: card.color, fontWeight: 700, fontSize: 28 }}
                />
                {card.icon}
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Row 2: Agent Status + GPU Gauge */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card
            title={
              <Space>
                <RobotOutlined />
                <span>{t('dashboardPage.agentStatus')}</span>
                <Badge count={3} style={{ backgroundColor: '#52c41a' }} />
              </Space>
            }
          >
            <Table
              dataSource={agentData}
              columns={agentColumns}
              pagination={false}
              size="small"
              bordered={false}
            />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title={<Space><DashboardOutlined /><span>{t('dashboardPage.modelLoad')}</span></Space>}>
            <ReactECharts option={gpuChartOption} style={{ height: 220 }} />
          </Card>
        </Col>
      </Row>

      {/* Row 3: Charts - Model Routing + Inference Trend */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={10}>
          <Card title={<Space><ThunderboltOutlined /><span>{t('dashboardPage.modelRouting')}</span></Space>}>
            <ReactECharts option={modelRoutingOption} style={{ height: 280 }} />
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          <Card title={<Space><CloudServerOutlined /><span>24h 推理趋势</span></Space>}>
            <ReactECharts option={inferenceTrendOption} style={{ height: 280 }} />
          </Card>
        </Col>
      </Row>

      {/* Row 4: Security + Approval + Activity */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card
            title={
              <Space>
                <SafetyCertificateOutlined />
                <span>{t('dashboardPage.securityEvents')}</span>
                <Tag color="orange">{securityEvents.length}</Tag>
              </Space>
            }
          >
            <Table
              dataSource={securityEvents}
              columns={securityColumns}
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <div className="space-y-4">
            {/* Approval Queue */}
            <Card
              title={
                <Space>
                  <AuditOutlined />
                  <span>{t('dashboardPage.pendingApprovalList')}</span>
                  <Tag color="red">{approvalQueue.length}</Tag>
                </Space>
              }
            >
              <Table
                dataSource={approvalQueue}
                columns={approvalColumns}
                pagination={false}
                size="small"
              />
            </Card>

            {/* Recent Activity */}
            <Card title={t('dashboardPage.recentActivity')}>
              <Timeline
                items={recentActivity.map((item) => ({
                  color: item.color,
                  children: <Text className="text-sm">{item.children}</Text>,
                }))}
              />
            </Card>
          </div>
        </Col>
      </Row>
    </div>
  );
};

export default DashboardPage;
