import React, { useMemo } from 'react';
import { Row, Col, Card, Tag, Typography, Progress, List, Space } from 'antd';
import { SafetyCertificateOutlined, CheckCircleOutlined, WarningOutlined, CloseCircleOutlined, SafetyOutlined } from '@ant-design/icons';
import ReactEChartsCore from 'echarts-for-react/lib/core';
import * as echarts from 'echarts/core';
import { RadarChart } from 'echarts/charts';
import { TooltipComponent, LegendComponent, RadarComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import PageHeader from '@/components/PageHeader';

echarts.use([RadarChart, TooltipComponent, LegendComponent, RadarComponent, CanvasRenderer]);

const { Title, Text } = Typography;

const CHAIN_LAYERS = [
  { level: 'L1', name: '输入护栏', desc: 'Prompt注入检测 / PII脱敏', passRate: 99.9, status: 'pass' },
  { level: 'L2', name: '策略护栏', desc: '合规范围检查 / 执法质量', passRate: 99.7, status: 'pass' },
  { level: 'L3', name: '输出验证', desc: '数据真实性 / 法规引用', passRate: 98.2, status: 'warning' },
  { level: 'L4', name: '幻觉检测', desc: '数值合理性 / 不确定性', passRate: 99.1, status: 'pass' },
  { level: 'L5', name: '审计追踪', desc: 'Agent决策日志 / 溯源', passRate: 100, status: 'pass' },
  { level: 'L6', name: '政务审批', desc: 'GOVMCP SM2/SM3/SM4', passRate: 99.5, status: 'pass' },
];

const RECENT_FINDINGS = [
  { title: 'L4 幻觉检测拦截', desc: '执法Agent输出含"可能"3次，置信度0.45', severity: 'medium', time: '14:28' },
  { title: 'L1 输入注入告警', desc: '检测到prompt injection尝试', severity: 'high', time: '12:05' },
  { title: 'L3 输出验证未通过', desc: '引用法条版本过期（2018→2023修正版）', severity: 'medium', time: '10:42' },
  { title: 'L6 国密签名异常', desc: 'SM2证书即将过期（剩余7天）', severity: 'low', time: '09:15' },
];

const Compliance: React.FC = () => {
  const radarOption = useMemo(() => ({
    tooltip: {},
    legend: { data: ['当前得分', '基线要求'] },
    radar: {
      indicator: [
        { name: '输入安全', max: 100 },
        { name: '策略合规', max: 100 },
        { name: '输出质量', max: 100 },
        { name: '幻觉控制', max: 100 },
        { name: '审计完整', max: 100 },
        { name: '政务审批', max: 100 },
      ],
    },
    series: [{
      type: 'radar',
      data: [
        { value: [98, 96, 92, 95, 100, 97], name: '当前得分', areaStyle: { color: 'rgba(0,168,107,0.2)' }, lineStyle: { color: '#00A86B' } },
        { value: [90, 85, 80, 85, 90, 90], name: '基线要求', areaStyle: { color: 'rgba(59,130,246,0.1)' }, lineStyle: { color: '#3B82F6', type: 'dashed' } },
      ],
    }],
  }), []);

  return (
    <div>
      <PageHeader
        title="合规检查"
        icon={<SafetyOutlined style={{ color: '#00A86B' }} />}
        breadcrumbs={[{ title: '安全治理', path: '/' }, { title: '合规检查' }]}
      />

      <Row gutter={[16, 16]}>
        {/* SafetyChain Status */}
        <Col span={24}>
          <Card size="small" title={<><SafetyCertificateOutlined style={{ color: '#00A86B' }} /> SafetyChain 六层实时状态</>}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              {CHAIN_LAYERS.map((layer, idx) => (
                <React.Fragment key={layer.level}>
                  <div style={{ textAlign: 'center', padding: '12px 8px', flex: 1, minWidth: 100 }}>
                    <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>{layer.level}</div>
                    <Progress
                      type="circle"
                      percent={layer.passRate}
                      size={60}
                      strokeColor={layer.status === 'pass' ? '#10B981' : '#F59E0B'}
                      format={(p) => `${p?.toFixed(1)}%`}
                    />
                    <div style={{ marginTop: 4 }}>
                      <Text strong style={{ fontSize: 12 }}>{layer.name}</Text>
                      <br /><Text type="secondary" style={{ fontSize: 10 }}>{layer.desc}</Text>
                    </div>
                  </div>
                  {idx < CHAIN_LAYERS.length - 1 && (
                    <Text style={{ color: '#ccc', fontSize: 20 }}>→</Text>
                  )}
                </React.Fragment>
              ))}
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card size="small" title="安全雷达图">
            <ReactEChartsCore echarts={echarts} option={radarOption} style={{ height: 300 }} />
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card size="small" title="最近安全发现" extra={<Tag color="orange">4 条</Tag>}>
            <List
              size="small"
              dataSource={RECENT_FINDINGS}
              renderItem={(item) => (
                <List.Item style={{ padding: '8px 0' }}>
                  <div style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Space>
                        {item.severity === 'high' ? <CloseCircleOutlined style={{ color: '#DC2626' }} /> :
                         item.severity === 'medium' ? <WarningOutlined style={{ color: '#F59E0B' }} /> :
                         <CheckCircleOutlined style={{ color: '#10B981' }} />}
                        <Text strong style={{ fontSize: 13 }}>{item.title}</Text>
                      </Space>
                      <Text type="secondary" style={{ fontSize: 11 }}>{item.time}</Text>
                    </div>
                    <Text type="secondary" style={{ fontSize: 12, marginLeft: 24 }}>{item.desc}</Text>
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

export default Compliance;
