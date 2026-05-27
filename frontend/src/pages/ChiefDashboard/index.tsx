/**
 * ChiefDashboard — 处长工作台
 *
 * 以部门第一视角展示:
 *   ① 本部门核心 KPI
 *   ② 本部门智能体状态 + 对话入口
 *   ③ 相关市州环境数据 (与部门业务相关)
 *   ④ 待审批 / 待办任务
 *   ⑤ 部门工作流
 */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Row, Col, Card, Statistic, Tag, Typography, List, Button, Table,
} from 'antd';
import {
  CrownOutlined, RobotOutlined,
  AuditOutlined, EnvironmentOutlined,
  SendOutlined, BarChartOutlined,
} from '@ant-design/icons';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { LineChart, BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { useAuthStore } from '@/store';
import { useDeptStore } from '@/store';
import { DEFAULT_DEPT_AGENTS } from '@/services/types';
import { environmentApi } from '@/services/api';
import type { EnvRealtimeItem } from '@/services/api';
import StatusBadge from '@/components/StatusBadge';

echarts.use([LineChart, BarChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

const { Title, Text } = Typography;

/** 部门与市州的业务关联映射 */
const DEPT_CITY_MAP: Record<string, string[]> = {
  '生态环境执法局': ['长沙市', '湘潭市', '株洲市', '衡阳市', '岳阳市'],
  '生态环境监测处': ['长沙市', '张家界市', '郴州市', '永州市', '怀化市'],
  '环境影响评价与排放管理处': ['长沙市', '岳阳市', '常德市', '益阳市'],
  '大气环境与应对气候变化处': ['长沙市', '株洲市', '湘潭市', '娄底市', '邵阳市'],
  '水生态环境处': ['岳阳市', '常德市', '益阳市', '长沙市', '永州市'],
  '土壤生态环境处': ['衡阳市', '邵阳市', '郴州市', '永州市', '娄底市'],
};

const ChiefDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const { getBinding } = useDeptStore();
  const [realtime, setRealtime] = useState<EnvRealtimeItem[]>([]);

  const department = user?.department || '生态环境监测处';
  const deptBinding = getBinding(department) || DEFAULT_DEPT_AGENTS.find(d => d.department === department);
  const relevantCities = DEPT_CITY_MAP[department] || ['长沙市'];

  const fetchData = useCallback(async () => {
    try {
      const [rt] = await Promise.all([
        environmentApi.getRealtime(),
      ]);
      setRealtime(rt.filter(d => d.city !== '全省'));
    } catch { /* 使用缓存 */ }
  }, []);

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 300000);
    return () => clearInterval(t);
  }, [fetchData]);

  // 关联市州数据
  const relatedData = useMemo(() => {
    return realtime.filter(d => relevantCities.includes(d.city));
  }, [realtime, relevantCities]);

  // 部门KPI
  const deptKPI = useMemo(() => {
    const total = relatedData.length;
    const avgAqi = total > 0 ? Math.round(relatedData.reduce((s, d) => s + d.aqi, 0) / total) : 0;
    const goodCities = relatedData.filter(d => d.level === '优' || d.level === '良').length;
    const alarmCities = relatedData.filter(d => d.level !== '优' && d.level !== '良').length;
    return { avgAqi, goodCities, total, alarmCities };
  }, [relatedData]);

  // 图表: 关联城市 AQI 柱状图
  const cityBarOption = useMemo(() => ({
    tooltip: { trigger: 'axis' },
    grid: { left: 50, right: 20, top: 10, bottom: 30 },
    xAxis: {
      type: 'category',
      data: relatedData.map(d => d.city.replace('市', '').replace('湘西土家族苗族自治州', '湘西州')),
      axisLabel: { fontSize: 10 },
    },
    yAxis: { type: 'value', name: 'AQI', axisLabel: { fontSize: 10 }, splitLine: { lineStyle: { type: 'dashed' } } },
    series: [{
      type: 'bar',
      data: relatedData.map(d => d.aqi),
      itemStyle: {
        color: (params: any) => {
          const v = params.value;
          if (v > 100) return '#EF4444';
          if (v > 75) return '#F97316';
          if (v > 50) return '#F59E0B';
          return '#10B981';
        },
      },
    }],
  }), [relatedData]);

  // 模拟待办
  const todoList = [
    { id: '1', title: `${relevantCities[0]}企业排污许可复审`, type: '审批', level: 'L2' },
    { id: '2', title: `${department}季度监测报告审核`, type: '审核', level: 'L2' },
    { id: '3', title: `${relevantCities[1] || relevantCities[0]}环评材料初审`, type: '审批', level: 'L3' },
  ];

  return (
    <div>
      {/* 头部信息 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>
            <CrownOutlined style={{ marginRight: 8, color: '#F59E0B' }} />
            {department} · 处长工作台
          </Title>
          <Text type="secondary" style={{ marginTop: 4, display: 'block' }}>
            管辖 {relevantCities.length} 个市州 &nbsp;|&nbsp;
            智能体: <Tag color="green">{deptBinding?.agentName || '--'}</Tag>
          </Text>
        </div>
        <div style={{ textAlign: 'right' }}>
          <Text style={{ color: '#00A86B', fontSize: 20, fontWeight: 700 }}>{user?.name}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>数据刷新: {realtime[0]?.time?.substring(11, 16) || '--'}</Text>
        </div>
      </div>

      {/* KPI 行 */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={6}>
          <Card size="small" style={{ borderTop: '3px solid #3B82F6' }}>
            <Statistic title="管辖区域 AQI" value={deptKPI.avgAqi} valueStyle={{ color: deptKPI.avgAqi <= 75 ? '#10B981' : '#F59E0B', fontSize: 24 }} suffix={<Text style={{ fontSize: 12 }}>均值</Text>} />
          </Card>
        </Col>
        <Col xs={6}>
          <Card size="small" style={{ borderTop: '3px solid #10B981' }}>
            <Statistic title="优良城市" value={`${deptKPI.goodCities}/${deptKPI.total}`} valueStyle={{ color: '#10B981', fontSize: 24 }} />
          </Card>
        </Col>
        <Col xs={6}>
          <Card size="small" style={{ borderTop: deptKPI.alarmCities > 0 ? '3px solid #EF4444' : '3px solid #10B981' }}>
            <Statistic title="超标告警" value={deptKPI.alarmCities} valueStyle={{ color: deptKPI.alarmCities > 0 ? '#EF4444' : '#10B981', fontSize: 24 }} suffix={<Text style={{ fontSize: 12 }}>城市</Text>} />
          </Card>
        </Col>
        <Col xs={6}>
          <Card size="small" style={{ borderTop: '3px solid #8B5CF6' }}>
            <Statistic title="待办任务" value={todoList.length} valueStyle={{ color: '#8B5CF6', fontSize: 24 }} suffix={<Text style={{ fontSize: 12 }}>件</Text>} />
          </Card>
        </Col>
      </Row>

      {/* 图表 + Agent + 待办 */}
      <Row gutter={[16, 16]}>
        {/* 管辖城市 AQI */}
        <Col xs={24} lg={12}>
          <Card title={<><BarChartOutlined style={{ color: '#3B82F6' }} /> 管辖城市实时 AQI</>} size="small">
            <ReactEChartsCore echarts={echarts} option={cityBarOption} style={{ height: 200 }} />
          </Card>
        </Col>

        {/* 部门智能体 */}
        <Col xs={24} lg={12}>
          <Card
            title={<><RobotOutlined style={{ color: '#00A86B' }} /> {deptBinding?.agentName || '部门智能体'}</>}
            size="small"
            extra={<StatusBadge status="online" pulse />}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <Text strong>Agent Key: </Text>
                <Tag>{deptBinding?.agentKey || '--'}</Tag>
                <Text strong style={{ marginLeft: 16 }}>模型: </Text>
                <Tag color="blue">{deptBinding?.model || '--'}</Tag>
              </div>
              <div>
                <Text strong>技能: </Text>
                {deptBinding?.skills?.map(s => <Tag key={s} color="green">{s}</Tag>) || <Tag>--</Tag>}
              </div>
              <div>
                <Text strong>优先级: </Text>
                <Tag color={deptBinding?.priority === 'P0' ? 'red' : deptBinding?.priority === 'P1' ? 'orange' : deptBinding?.priority === 'P2' ? 'blue' : 'default'}>
                  {deptBinding?.priority || '--'}
                </Tag>
              </div>
              <Button type="primary" icon={<SendOutlined />} block>
                启动对话
              </Button>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 管辖城市排名表 + 待办 */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card title={<><EnvironmentOutlined style={{ color: '#3B82F6' }} /> 管辖市州空气质量</>} size="small">
            <Table
              dataSource={relatedData}
              rowKey="city"
              size="small"
              pagination={false}
              columns={[
                { title: '城市', dataIndex: 'city', key: 'city', width: 80 },
                { title: 'AQI', dataIndex: 'aqi', key: 'aqi', width: 60,
                  render: (v: number) => <Text style={{ color: v > 75 ? '#EF4444' : v > 50 ? '#F59E0B' : '#10B981', fontWeight: 700 }}>{v}</Text> },
                { title: '等级', dataIndex: 'level', key: 'level', width: 60,
                  render: (v: string) => <Tag color={v === '优' ? 'green' : v === '良' ? 'blue' : 'orange'}>{v}</Tag> },
                { title: '首要', dataIndex: 'primary', key: 'primary', width: 60,
                  render: (v: string) => <Text style={{ fontSize: 11 }}>{v || '-'}</Text> },
                { title: '更新时间', dataIndex: 'time', key: 'time', width: 80,
                  render: (v: string) => <Text style={{ fontSize: 11 }}>{v?.substring(11, 16) || '--'}</Text> },
              ]}
            />
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title={<><AuditOutlined style={{ color: '#F59E0B' }} /> 待办任务</>} size="small" extra={<Tag color="orange">{todoList.length} 件</Tag>}>
            <List
              size="small"
              dataSource={todoList}
              renderItem={item => (
                <List.Item style={{ padding: '8px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                    <div>
                      <Text style={{ fontSize: 13 }}>{item.title}</Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 11 }}>{item.type}</Text>
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

export default ChiefDashboard;
