import React from 'react';
import { Row, Col, Card, Table, Tag, Typography, Button, Space, DatePicker, Select } from 'antd';
import { FileTextOutlined, DownloadOutlined, EyeOutlined, BarChartOutlined } from '@ant-design/icons';
import PageHeader from '@/components/PageHeader';

const { Title, Text } = Typography;

const REPORT_TYPES = [
  { key: 'daily', label: '监测日报', color: 'blue' },
  { key: 'weekly', label: '执法周报', color: 'purple' },
  { key: 'monthly', label: '碳排放月报', color: 'green' },
  { key: 'eia', label: '环评报告', color: 'orange' },
  { key: 'annual', label: '年度公报', color: 'red' },
];

const MOCK_REPORTS = [
  { id: 'RPT-001', name: '2026年5月26日环境监测日报', type: 'daily', dept: '监测处', time: '2026-05-26 08:00', status: 'generated' },
  { id: 'RPT-002', name: '2026年第21周执法工作周报', type: 'weekly', dept: '执法局', time: '2026-05-24', status: 'generated' },
  { id: 'RPT-003', name: '2026年4月湖南省碳排放月报', type: 'monthly', dept: '大气处', time: '2026-05-05', status: 'generated' },
  { id: 'RPT-004', name: '长沙XX项目环评报告书', type: 'eia', dept: '环评处', time: '2026-05-20', status: 'review' },
  { id: 'RPT-005', name: '2025年湖南省生态环境状况公报', type: 'annual', dept: '综合处', time: '2026-03-15', status: 'published' },
];

const Reports: React.FC = () => {
  return (
    <div>
      <PageHeader
        title="报告生成"
        icon={<BarChartOutlined style={{ color: '#8B5CF6' }} />}
        breadcrumbs={[{ title: '业务工作台', path: '/' }, { title: '报告生成' }]}
        extra={
          <Space>
            <Button type="primary" icon={<FileTextOutlined />}>
              AI生成报告
            </Button>
          </Space>
        }
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card size="small" bodyStyle={{ padding: '12px 0 0' }}>
            <div style={{ padding: '0 12px 12px', display: 'flex', gap: 8 }}>
              <Select defaultValue="all" style={{ width: 120 }}>
                <Select.Option value="all">全部类型</Select.Option>
                {REPORT_TYPES.map(r => <Select.Option key={r.key} value={r.key}>{r.label}</Select.Option>)}
              </Select>
              <DatePicker.RangePicker placeholder={['开始日期', '结束日期']} />
            </div>
            <Table
              dataSource={MOCK_REPORTS}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 8 }}
              columns={[
                { title: '编号', dataIndex: 'id', width: 100, render: (v: string) => <Text code>{v}</Text> },
                { title: '报告名称', dataIndex: 'name', ellipsis: true },
                { title: '类型', dataIndex: 'type', width: 100, render: (v: string) => {
                  const t = REPORT_TYPES.find(r => r.key === v);
                  return <Tag color={t?.color}>{t?.label}</Tag>;
                }},
                { title: '生成部门', dataIndex: 'dept', width: 90 },
                { title: '生成时间', dataIndex: 'time', width: 160 },
                { title: '状态', dataIndex: 'status', width: 90, render: (v: string) => {
                  const ms: Record<string, { color: string; text: string }> = { generated: { color: 'blue', text: '已生成' }, review: { color: 'orange', text: '待审核' }, published: { color: 'green', text: '已发布' } };
                  return <Tag color={ms[v]?.color}>{ms[v]?.text}</Tag>;
                }},
                { title: '操作', width: 120, render: () => <Space size="small"><Button size="small" icon={<EyeOutlined />} type="link">查看</Button><Button size="small" icon={<DownloadOutlined />} type="link">下载</Button></Space> },
              ]}
            />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card size="small" title="📊 报告类型统计">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {REPORT_TYPES.map(r => (
                <div key={r.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Space><Tag color={r.color}>{r.label}</Tag></Space>
                  <Text>{Math.floor(Math.random() * 50 + 10)} 份</Text>
                </div>
              ))}
            </div>
          </Card>
          <Card size="small" title="🤖 AI模板" style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {['监测日报模板 v2.1', '执法周报模板 v1.5', '碳排放月报模板 v3.0', '环评报告通用模板 v2.0'].map((t, i) => (
                <div key={i} style={{ padding: '8px 12px', background: '#f9fafb', borderRadius: 6, cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 13 }}>{t}</Text>
                  <FileTextOutlined style={{ color: '#3B82F6' }} />
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Reports;
