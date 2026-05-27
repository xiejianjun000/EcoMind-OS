/**
 * CityDashboard — 市州工作台
 *
 * 以属地视角展示:
 *   ① 本市实时空气质量 (AQI + 6项污染物)
 *   ② 7天预报
 *   ③ 本市在省排名
 *   ④ 本市监测站/点位数据
 *   ⑤ 本市历史趋势
 */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Row, Col, Card, Statistic, Tag, Typography, Progress, Table, List,
} from 'antd';
import {
  EnvironmentOutlined, CloudOutlined,
  TrophyOutlined, AlertOutlined, CalendarOutlined,
} from '@ant-design/icons';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { LineChart, GaugeChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { useAuthStore } from '@/store';
import { environmentApi } from '@/services/api';
import type { EnvRealtimeItem, EnvRankingItem, EnvForecastItem } from '@/services/api';

echarts.use([LineChart, GaugeChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

const { Title, Text } = Typography;

/** AQI 等级映射 */
function aqiLevelInfo(aqi: number) {
  if (aqi <= 50) return { label: '优', color: '#10B981' };
  if (aqi <= 100) return { label: '良', color: '#F59E0B' };
  if (aqi <= 150) return { label: '轻度', color: '#F97316' };
  if (aqi <= 200) return { label: '中度', color: '#EF4444' };
  if (aqi <= 300) return { label: '重度', color: '#991B1B' };
  return { label: '严重', color: '#7F1D1D' };
}

const CityDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const cityName = user?.city || '长沙市';

  const [realtime, setRealtime] = useState<EnvRealtimeItem[]>([]);
  const [forecast, setForecast] = useState<EnvForecastItem[]>([]);
  const [ranking, setRanking] = useState<EnvRankingItem[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const [rt, fc, rk] = await Promise.all([
        environmentApi.getRealtime(),
        environmentApi.getForecast(),
        environmentApi.getRanking(),
      ]);
      setRealtime(rt);
      setForecast(fc);
      setRanking(rk);
    } catch { /* cached */ }
  }, []);

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 300000);
    return () => clearInterval(t);
  }, [fetchData]);

  // 本市数据
  const myData = useMemo(() => {
    const rt = realtime.find(d => d.city === cityName) || { aqi: 0, level: '', primary: '', time: '' };
    const fcDays = forecast.filter(d => d.city === cityName).sort((a, b) => a.date.localeCompare(b.date));
    const rk = ranking.find(d => d.city === cityName);
    const levelInfo = aqiLevelInfo(rt.aqi);
    return { rt, fcDays, rk, levelInfo };
  }, [realtime, forecast, ranking, cityName]);

  // 全省城市对比 (取前5+后5)
  const rankContext = useMemo(() => {
    const all = [...ranking].sort((a, b) => a.rank - b.rank);
    const myIdx = all.findIndex(d => d.city === cityName);
    const total = all.length;
    return { all, myIdx, total };
  }, [ranking, cityName]);

  // AQI 仪表盘
  const gaugeOption = useMemo(() => ({
    series: [{
      type: 'gauge',
      startAngle: 200, endAngle: -20,
      center: ['50%', '60%'],
      radius: '85%',
      min: 0, max: 300,
      splitNumber: 10,
      axisLine: {
        lineStyle: {
          width: 14,
          color: [
            [0.17, '#10B981'], [0.33, '#F59E0B'], [0.5, '#F97316'],
            [0.67, '#EF4444'], [0.83, '#991B1B'], [1, '#7F1D1D'],
          ],
        },
      },
      pointer: { length: '70%', width: 6 },
      detail: {
        fontSize: 32, offsetCenter: [0, '85%'],
        formatter: (v: number) => `${v}\n${aqiLevelInfo(v).label}`,
        color: myData.levelInfo.color,
      },
      data: [{ value: myData.rt.aqi, name: `${cityName} 实时 AQI` }],
    }],
  }), [myData, cityName]);

  // 7天预报趋势
  const forecastOption = useMemo(() => {
    const days = myData.fcDays;
    return {
      tooltip: { trigger: 'axis' },
      grid: { left: 50, right: 20, top: 10, bottom: 30 },
      xAxis: {
        type: 'category',
        data: days.map(d => d.date.substring(5)),
        axisLabel: { fontSize: 10 },
      },
      yAxis: { type: 'value', name: 'AQI', axisLabel: { fontSize: 10 }, splitLine: { lineStyle: { type: 'dashed' } } },
      series: [
        {
          name: 'AQI 范围',
          type: 'line',
          data: days.map(d => {
            const parts = d.aqi.split('-');
            const hi = parseInt(parts[1] || parts[0]) || 0;
            return hi;
          }),
          smooth: true,
          areaStyle: { color: 'rgba(59,130,246,0.15)' },
          lineStyle: { color: '#3B82F6' },
          itemStyle: { color: '#3B82F6' },
        },
      ],
    };
  }, [myData]);

  // 排名进度条
  const rankPercent = useMemo(() => {
    if (rankContext.total === 0) return 0;
    return Math.round(((rankContext.total - rankContext.myIdx) / rankContext.total) * 100);
  }, [rankContext]);

  return (
    <div>
      {/* 头部 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            <EnvironmentOutlined style={{ marginRight: 8, color: '#00A86B' }} />
            {cityName} · 生态环境工作台
          </Title>
          <Text type="secondary">数据刷新: {myData.rt.time?.substring(0, 16) || '--'}</Text>
        </div>
        <div style={{ textAlign: 'right' }}>
          <Tag
            color={myData.levelInfo.color === '#10B981' ? 'green' : myData.levelInfo.color === '#F59E0B' ? 'gold' : 'red'}
            style={{ fontSize: 16, padding: '4px 16px' }}
          >
            空气质量: {myData.levelInfo.label}
          </Tag>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>{user?.name}</Text>
        </div>
      </div>

      {/* KPI 行 */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={6}>
          <Card size="small" style={{ borderTop: `3px solid ${myData.levelInfo.color}` }}>
            <Statistic
              title="实时 AQI"
              value={myData.rt.aqi}
              valueStyle={{ color: myData.levelInfo.color, fontSize: 28, fontWeight: 700 }}
              suffix={<Text style={{ fontSize: 14 }}>{myData.levelInfo.label}</Text>}
            />
          </Card>
        </Col>
        <Col xs={6}>
          <Card size="small" style={{ borderTop: '3px solid #3B82F6' }}>
            <Statistic
              title="全省排名"
              value={myData.rk?.rank || '--'}
              valueStyle={{ color: (myData.rk?.rank || 99) <= 3 ? '#F59E0B' : '#3B82F6', fontSize: 28, fontWeight: 700 }}
              suffix={<Text style={{ fontSize: 14 }}>/ 14</Text>}
            />
          </Card>
        </Col>
        <Col xs={6}>
          <Card size="small" style={{ borderTop: '3px solid #8B5CF6' }}>
            <Statistic
              title="首要污染物"
              value={myData.rt.primary || '无'}
              valueStyle={{ color: '#8B5CF6', fontSize: 20 }}
            />
          </Card>
        </Col>
        <Col xs={6}>
          <Card size="small" style={{ borderTop: '3px solid #00A86B' }}>
            <Statistic
              title="明日预报"
              value={myData.fcDays[0]?.aqi || '--'}
              valueStyle={{ color: '#00A86B', fontSize: 20 }}
            />
          </Card>
        </Col>
      </Row>

      {/* 仪表盘 + 排名 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title={<><CloudOutlined style={{ color: '#3B82F6' }} /> 实时 AQI 仪表盘</>} size="small">
            <ReactEChartsCore echarts={echarts} option={gaugeOption} style={{ height: 250 }} />
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title={<><TrophyOutlined style={{ color: '#F59E0B' }} /> 全省排名</>} size="small">
            <div style={{ textAlign: 'center', marginTop: 20 }}>
              <Progress
                type="circle"
                percent={rankPercent}
                format={() => `第 ${myData.rk?.rank || '--'} 名`}
                strokeColor={{ '0%': '#10B981', '100%': '#F59E0B' }}
                width={120}
              />
              <div style={{ marginTop: 16 }}>
                <Text style={{ fontSize: 13 }}>
                  超过全省 <Text strong style={{ color: '#00A86B' }}>{rankPercent}%</Text> 城市
                </Text>
              </div>
              <Table
                dataSource={rankContext.all.slice(0, 5)}
                rowKey="city"
                size="small"
                pagination={false}
                style={{ marginTop: 12 }}
                columns={[
                  { title: '#', key: 'rank', width: 40, render: (_, r: EnvRankingItem) => (
                    <Tag color={r.rank <= 3 ? 'gold' : 'default'}>{r.rank}</Tag>
                  ) },
                  { title: '城市', dataIndex: 'city', key: 'city', width: 70,
                    render: (v: string) => <Text style={{ fontWeight: v === cityName ? 700 : 400, color: v === cityName ? '#00A86B' : undefined }}>{v}</Text> },
                  { title: 'AQI', dataIndex: 'aqi', key: 'aqi', width: 50,
                    render: (v: number) => <Text style={{ color: v > 75 ? '#EF4444' : v > 50 ? '#F59E0B' : '#10B981' }}>{v}</Text> },
                  { title: '等级', dataIndex: 'level', key: 'level', width: 50,
                    render: (v: string) => <Tag color={v === '优' ? 'green' : v === '良' ? 'blue' : 'orange'}>{v}</Tag> },
                ]}
              />
            </div>
          </Card>
        </Col>
      </Row>

      {/* 7天预报 */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={16}>
          <Card title={<><CalendarOutlined style={{ color: '#3B82F6' }} /> 7天空气质量预报</>} size="small">
            <ReactEChartsCore echarts={echarts} option={forecastOption} style={{ height: 200 }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              {myData.fcDays.slice(0, 7).map((d, i) => (
                <Tag key={i} style={{ fontSize: 11 }}>
                  {d.date.substring(5)}: AQI {d.aqi} {d.level}
                </Tag>
              ))}
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title={<><AlertOutlined style={{ color: '#EF4444' }} /> 本市告警</>} size="small">
            <List
              size="small"
              dataSource={[
                { type: 'info', msg: `${cityName} 当前首要污染物: ${myData.rt.primary || '无'}`, color: '#3B82F6' },
                { type: 'warn', msg: myData.rt.aqi > 100 ? `AQI ${myData.rt.aqi} 轻度污染，建议减少户外活动` : '空气质量良好，可以正常户外活动', color: myData.rt.aqi > 100 ? '#F97316' : '#10B981' },
                { type: 'forecast', msg: `明日预报: AQI ${myData.fcDays[0]?.aqi || '--'} (${myData.fcDays[0]?.level || '--'})`, color: '#8B5CF6' },
              ]}
              renderItem={item => (
                <List.Item style={{ padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: item.color, marginTop: 6, flexShrink: 0 }} />
                    <Text style={{ fontSize: 12 }}>{item.msg}</Text>
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

export default CityDashboard;
