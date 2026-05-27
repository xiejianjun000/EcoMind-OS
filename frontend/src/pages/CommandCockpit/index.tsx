import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Row, Col, Card, Statistic, Table, List, Tag, Typography, Spin,
} from 'antd';
import {
  DashboardOutlined, EnvironmentOutlined, SafetyCertificateOutlined,
  ThunderboltOutlined, AlertOutlined, TeamOutlined, CloudOutlined,
  ExperimentOutlined, BarChartOutlined,
} from '@ant-design/icons';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { LineChart, BarChart, GaugeChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { useAppStore } from '@/store';
import StatusBadge from '@/components/StatusBadge';
import HunanMapChart from '@/components/HunanMapChart';
import { environmentApi } from '@/services/api';
import type { EnvRealtimeItem, EnvRankingItem, EnvForecastItem } from '@/services/api';

echarts.use([LineChart, BarChart, GaugeChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

const { Title, Text } = Typography;

interface AlertItem {
  id: string; severity: 'high' | 'medium' | 'low'; title: string; desc: string; time: string;
}

const SEV_COLORS: Record<string, string> = {
  high: '#DC2626', medium: '#F59E0B', low: '#10B981',
};

const MOCK_AGENTS = [
  { id: '1', name: '执法办案智能体', dept: '生态环境执法局', status: 'online' as const, tasks: 156, successRate: '97%' },
  { id: '2', name: '监测分析智能体', dept: '生态环境监测处', status: 'online' as const, tasks: 432, successRate: '99%' },
  { id: '3', name: '环评审批智能体', dept: '环评与排放管理处', status: 'online' as const, tasks: 89, successRate: '95%' },
  { id: '4', name: '大气治理智能体', dept: '大气与气候变化处', status: 'busy' as const, tasks: 201, successRate: '98%' },
  { id: '5', name: '水环境治理智能体', dept: '水生态环境处', status: 'online' as const, tasks: 178, successRate: '96%' },
];

const CommandCockpit: React.FC = () => {
  const store = useAppStore();
  const [realtime, setRealtime] = useState<EnvRealtimeItem[]>([]);
  const [ranking, setRanking] = useState<EnvRankingItem[]>([]);
  const [forecast, setForecast] = useState<EnvForecastItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [rt, rk, fc] = await Promise.all([
        environmentApi.getRealtime(),
        environmentApi.getRanking(),
        environmentApi.getForecast(),
      ]);
      setRealtime(rt.filter((d) => d.city !== '全省'));
      setRanking(rk.filter((d) => d.city !== '全省'));
      setForecast(fc);
    } catch (e) {
      console.warn('环境数据获取失败，使用缓存', e);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, 300000); // 5分钟刷新
    return () => clearInterval(timer);
  }, [fetchData]);

  // 从实时数据计算KPI
  const kpiCards = useMemo(() => {
    const cities = realtime.filter((d) => d.city !== '全省');
    const total = cities.length;
    const good = cities.filter((d) => d.level === '优').length;
    const goodLight = cities.filter((d) => d.level === '优' || d.level === '良').length;
    const avgAqi = total > 0 ? Math.round(cities.reduce((s, d) => s + d.aqi, 0) / total) : 0;
    const goodRate = total > 0 ? Math.round((good / total) * 100) : 0;
    const goodLightRate = total > 0 ? Math.round((goodLight / total) * 100) : 0;
    const bestCity = cities.length > 0
      ? cities.reduce((a, b) => (a.aqi < b.aqi ? a : b))
      : { city: '--', aqi: 0 };

    return [
      { key: 'avgAqi', title: '全省平均AQI', value: String(avgAqi), delta: `${bestCity.city}最优`, color: avgAqi <= 50 ? '#10B981' : avgAqi <= 100 ? '#F59E0B' : '#DC2626', icon: <CloudOutlined /> },
      { key: 'goodRate', title: '空气质量为优城市', value: `${good}/${total}`, delta: `优良率${goodLightRate}%`, color: '#3B82F6', icon: <ExperimentOutlined /> },
      { key: 'bestCity', title: '空气质量最佳', value: bestCity.city, delta: `AQI ${bestCity.aqi}`, color: '#00A86B', icon: <BarChartOutlined /> },
      { key: 'dataTime', title: '数据更新时间', value: realtime[0]?.time?.substring(11, 16) || '--', delta: '湖南省站实时', color: '#8B5CF6', icon: <SafetyCertificateOutlined /> },
    ];
  }, [realtime]);

  // 动态告警
  const alerts: AlertItem[] = useMemo(() => {
    const list: AlertItem[] = [];
    const alarmCities = realtime.filter((d) => d.level !== '优' && d.level !== '良' && d.city !== '全省');
    alarmCities.forEach((d) => {
      list.push({ id: d.city, severity: 'high', title: `${d.city}空气污染`, desc: `AQI ${d.aqi} ${d.level}`, time: d.time?.substring(11, 16) || '' });
    });
    const lightCities = realtime.filter((d) => d.level === '良' && d.city !== '全省');
    lightCities.slice(0, 3).forEach((d) => {
      list.push({ id: d.city + '_light', severity: 'medium', title: `${d.city}空气质量良`, desc: `AQI ${d.aqi}`, time: d.time?.substring(11, 16) || '' });
    });
    if (list.length === 0) {
      list.push({ id: 'all_good', severity: 'low', title: '全省空气质量优良', desc: '所有市州AQI达标', time: realtime[0]?.time?.substring(11, 16) || '' });
    }
    return list.slice(0, 5);
  }, [realtime]);

  const gaugeOption = useMemo(() => {
    const goodCount = realtime.filter((d) => d.level === '优' && d.city !== '全省').length;
    const total = realtime.filter((d) => d.city !== '全省').length;
    const ratio = total > 0 ? Math.round((goodCount / total) * 100) : 0;
    const avgAqi = total > 0 ? Math.round(realtime.filter((d) => d.city !== '全省').reduce((s, d) => s + d.aqi, 0) / total) : 0;
    return {
      series: [
        { type: 'gauge', startAngle: 200, endAngle: -20, center: ['25%', '55%'], radius: '70%',
          min: 0, max: 100, splitNumber: 10, axisLine: { show: true,
            lineStyle: { width: 12, color: [[0.3, '#DC2626'], [0.5, '#F59E0B'], [0.7, '#3B82F6'], [1, '#10B981']] } },
          pointer: { length: '60%', width: 6 }, detail: { fontSize: 18, offsetCenter: [0, '70%'], formatter: '{value}%' },
          data: [{ value: ratio, name: '优率' }] },
        { type: 'gauge', startAngle: 200, endAngle: -20, center: ['50%', '55%'], radius: '70%',
          min: 0, max: 300, splitNumber: 10, axisLine: { show: true,
            lineStyle: { width: 12, color: [[0.3, '#10B981'], [0.5, '#3B82F6'], [0.7, '#F59E0B'], [1, '#DC2626']] } },
          pointer: { length: '60%', width: 6 }, detail: { fontSize: 18, offsetCenter: [0, '70%'], formatter: '{value}' },
          data: [{ value: avgAqi, name: '均AQI' }] },
        { type: 'gauge', startAngle: 200, endAngle: -20, center: ['75%', '55%'], radius: '70%',
          min: 0, max: 100, splitNumber: 10, axisLine: { show: true,
            lineStyle: { width: 12, color: [[0.8, '#DC2626'], [0.9, '#F59E0B'], [1, '#10B981']] } },
          pointer: { length: '60%', width: 6 }, detail: { fontSize: 18, offsetCenter: [0, '70%'], formatter: '{value}%' },
          data: [{ value: 99.2, name: '安全率' }] },
      ],
    };
  }, [realtime]);

  const trendOption = useMemo(() => ({
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 20, top: 10, bottom: 30 },
    xAxis: { type: 'category', data: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月'], axisLabel: { fontSize: 10 } },
    yAxis: { type: 'value', axisLabel: { fontSize: 10 }, splitLine: { lineStyle: { type: 'dashed' } } },
    series: [
      { name: 'PM2.5', type: 'line', data: [52, 48, 42, 38, 35, 32, 30, 28], smooth: true, lineStyle: { color: '#DC2626' }, itemStyle: { color: '#DC2626' } },
      { name: '优良天数', type: 'line', data: [72, 76, 80, 84, 87, 89, 91, 92], smooth: true, lineStyle: { color: '#10B981' }, itemStyle: { color: '#10B981' } },
    ],
  }), []);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          <DashboardOutlined style={{ marginRight: 8, color: '#00A86B' }} />
          湖南省生态环境 AI 指挥驾驶舱
        </Title>
        <Text type="secondary">
          数据刷新: {new Date().toLocaleString('zh-CN')} &nbsp;
          <Tag color={store.wsConnected ? 'green' : 'red'}>
            {store.wsConnected ? '● 实时连接' : '○ 未连接'}
          </Tag>
        </Text>
      </div>

      {/* KPI Row */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {kpiCards.map((kpi) => (
          <Col xs={12} sm={6} key={kpi.key}>
            <Card hoverable size="small" style={{ borderTop: `3px solid ${kpi.color}` }}>
              <Statistic
                title={<Text type="secondary" style={{ fontSize: 13 }}>{kpi.title}</Text>}
                value={kpi.value}
                valueStyle={{ color: kpi.color, fontSize: 28, fontWeight: 700 }}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                <Text type="secondary" style={{ fontSize: 11 }}>{kpi.delta}</Text>
              </Text>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Map + Alerts row */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} lg={16}>
          <Card
            title={<><EnvironmentOutlined style={{ color: '#00A86B' }} /> 湖南省环境质量一张图</>}
            size="small"
            bodyStyle={{ padding: 8, height: 380 }}
            extra={<Tag color="blue">14市州 AQI 热力图</Tag>}
          >
            <HunanMapChart
              aqiData={realtime.map(d => ({ city: d.city, aqi: d.aqi, level: d.level }))}
              forecastData={forecast}
              rankingData={ranking}
            />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card
            title={<><AlertOutlined style={{ color: '#F59E0B' }} /> 实时告警</>}
            size="small"
            bodyStyle={{ padding: '8px 12px', height: 380, overflow: 'auto' }}
            extra={<Tag color="red">{alerts.length} 条</Tag>}
          >
            <List
              size="small"
              dataSource={alerts}
              renderItem={(item) => (
                <List.Item style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <div style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>
                        <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', backgroundColor: SEV_COLORS[item.severity], marginRight: 6 }} />
                        <Text strong style={{ fontSize: 13 }}>{item.title}</Text>
                      </span>
                      <Text type="secondary" style={{ fontSize: 11 }}>{item.time}</Text>
                    </div>
                    <Text type="secondary" style={{ fontSize: 12, marginLeft: 12 }}>{item.desc}</Text>
                  </div>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      {/* Charts + Tables row */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title={<><CloudOutlined style={{ color: '#3B82F6' }} /> 全省PM2.5趋势 & 优良天数</>} size="small">
            <ReactEChartsCore echarts={echarts} option={trendOption} style={{ height: 220 }} />
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title={<><SafetyCertificateOutlined style={{ color: '#8B5CF6' }} /> 综合评分仪表盘</>} size="small">
            <ReactEChartsCore echarts={echarts} option={gaugeOption} style={{ height: 220 }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={8}>
          <Card
            title={<><TeamOutlined style={{ color: '#00A86B' }} /> Agent 运行状态</>}
            size="small"
            extra={<Tag color="green">{MOCK_AGENTS.filter(a => a.status === 'online').length} 在线</Tag>}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {MOCK_AGENTS.map((agent) => (
                <div key={agent.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <Text strong style={{ fontSize: 13 }}>{agent.name}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 11 }}>{agent.dept}</Text>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <StatusBadge status={agent.status} pulse={agent.status === 'busy'} />
                    <br />
                    <Text type="secondary" style={{ fontSize: 11 }}>任务{agent.tasks} | 成功率{agent.successRate}</Text>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card title="14市州空气质量排名" size="small" extra={<Tag color="green">{ranking[0]?.date?.substring(0, 10) || ''}</Tag>}>
            <Table
              dataSource={ranking}
              rowKey="city"
              size="small"
              pagination={false}
              loading={loading}
              columns={[
                { title: '#', key: 'rank', width: 40, render: (_, r: EnvRankingItem) => (
                  <Tag color={r.rank <= 3 ? 'gold' : 'default'}>{r.rank}</Tag>
                )},
                { title: '市州', dataIndex: 'city', key: 'city', width: 80 },
                { title: 'AQI', dataIndex: 'aqi', key: 'aqi', width: 50,
                  render: (v: number) => <Text style={{ color: v > 75 ? '#DC2626' : v > 50 ? '#F59E0B' : '#10B981', fontWeight: 700 }}>{v}</Text> },
                { title: '等级', dataIndex: 'level', key: 'level', width: 50,
                  render: (v: string) => <Tag color={v === '优' ? 'green' : v === '良' ? 'blue' : 'orange'}>{v}</Tag> },
                { title: '首要', dataIndex: 'primary', key: 'primary', width: 55,
                  render: (v: string) => <Text style={{ fontSize: 11 }}>{v || '-'}</Text> },
              ]}
            />
          </Card>
        </Col>

        <Col xs={24} lg={6}>
          <Card title="待审批列表" size="small" extra={<Tag color="orange">12 件</Tag>}>
            <List
              size="small"
              dataSource={[
                { id: 'AP-001', title: '排污许可变更', dept: '长沙XX公司', level: 'L2' },
                { id: 'AP-002', title: '环评报告审批', dept: '岳阳XX项目', level: 'L3' },
                { id: 'AP-003', title: '辐射安全许可', dept: '衡阳XX医院', level: 'L2' },
              ]}
              renderItem={(item) => (
                <List.Item style={{ padding: '6px 0' }}>
                  <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <Text style={{ fontSize: 13 }}>{item.title}</Text>
                      <br/><Text type="secondary" style={{ fontSize: 11 }}>{item.dept}</Text>
                    </div>
                    <Tag color={item.level === 'L3' ? 'red' : 'orange'}>{item.level}</Tag>
                  </div>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default CommandCockpit;
