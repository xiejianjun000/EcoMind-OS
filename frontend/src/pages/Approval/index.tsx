import React, { useState } from 'react';
import {
  Row, Col, Card, Table, Tag, Typography, Space, Button, Select, Descriptions, List, Statistic, Divider, Modal,
} from 'antd';
import {
  AuditOutlined, CheckOutlined, CloseOutlined, ClockCircleOutlined,
  SafetyCertificateOutlined, FileProtectOutlined, SearchOutlined,
} from '@ant-design/icons';
import PageHeader from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';

const { Title, Text } = Typography;

type ApprovalLevel = 'L1' | 'L2' | 'L3';
type ApprovalStatus = 'pending' | 'approved' | 'rejected';
type ApprovalType = '排污许可' | '环评审批' | '辐射安全' | '危废经营许可' | '建设项目验收';

interface ApprovalItem {
  id: string;
  type: ApprovalType;
  applicant: string;
  level: ApprovalLevel;
  status: ApprovalStatus;
  submitTime: string;
  deadline: string;
  urgency: 'urgent' | 'normal' | 'low';
  aiPrediction?: { score: number; issues: string[] };
}

const MOCK_APPROVALS: ApprovalItem[] = [
  { id: 'AP-2026-001', type: '排污许可', applicant: '长沙XX化工有限公司', level: 'L2', status: 'pending', submitTime: '2026-05-25 10:30', deadline: '2026-06-08', urgency: 'normal', aiPrediction: { score: 0.88, issues: ['需补充应急预案'] } },
  { id: 'AP-2026-002', type: '环评审批', applicant: '岳阳XX基础设施项目', level: 'L3', status: 'pending', submitTime: '2026-05-24 15:00', deadline: '2026-06-24', urgency: 'urgent', aiPrediction: { score: 0.72, issues: ['公众参与材料不完整', '生态影响评估需补充'] } },
  { id: 'AP-2026-003', type: '辐射安全', applicant: '衡阳XX人民医院', level: 'L2', status: 'pending', submitTime: '2026-05-23 09:15', deadline: '2026-06-06', urgency: 'normal', aiPrediction: { score: 0.95, issues: [] } },
  { id: 'AP-2026-004', type: '危废经营许可', applicant: '株洲XX环保科技公司', level: 'L3', status: 'approved', submitTime: '2026-05-20 11:00', deadline: '2026-06-03', urgency: 'low' },
  { id: 'AP-2026-005', type: '建设项目验收', applicant: '郴州XX矿山治理项目', level: 'L1', status: 'rejected', submitTime: '2026-05-18 08:30', deadline: '2026-05-31', urgency: 'urgent' },
  { id: 'AP-2026-006', type: '排污许可', applicant: '湘潭XX电镀厂', level: 'L2', status: 'pending', submitTime: '2026-05-25 14:00', deadline: '2026-06-08', urgency: 'urgent', aiPrediction: { score: 0.65, issues: ['废水处理工艺存疑', '排污总量超标'] } },
];

const Approval: React.FC = () => {
  const [selected, setSelected] = useState<ApprovalItem | null>(null);
  const [filter, setFilter] = useState<string>('pending');

  const filtered = MOCK_APPROVALS.filter(a => filter === 'all' || a.status === filter);

  const columns = [
    { title: '审批编号', dataIndex: 'id', key: 'id', width: 130, render: (v: string) => <Text code>{v}</Text> },
    { title: '类型', dataIndex: 'type', key: 'type', width: 110,
      render: (v: ApprovalType) => {
        const colors: Record<ApprovalType, string> = { '排污许可': 'green', '环评审批': 'blue', '辐射安全': 'orange', '危废经营许可': 'red', '建设项目验收': 'purple' };
        return <Tag color={colors[v]}>{v}</Tag>;
      } },
    { title: '申请单位', dataIndex: 'applicant', key: 'applicant', ellipsis: true },
    { title: '安全级别', dataIndex: 'level', key: 'level', width: 80,
      render: (v: ApprovalLevel) => <Tag color={v === 'L3' ? 'red' : v === 'L2' ? 'orange' : 'green'}>{v} {v === 'L3' ? '会签' : v === 'L2' ? '双因子' : '单签'}</Tag> },
    { title: '状态', dataIndex: 'status', key: 'status', width: 80,
      render: (v: ApprovalStatus) => <StatusBadge status={v} /> },
    { title: '紧急', dataIndex: 'urgency', key: 'urgency', width: 60,
      render: (v: string) => v === 'urgent' ? <Tag color="red">紧急</Tag> : null },
    { title: '提交时间', dataIndex: 'submitTime', key: 'submitTime', width: 140 },
  ];

  const stats = { pending: MOCK_APPROVALS.filter(a => a.status === 'pending').length, approved: MOCK_APPROVALS.filter(a => a.status === 'approved').length, rejected: MOCK_APPROVALS.filter(a => a.status === 'rejected').length };

  return (
    <div>
      <PageHeader
        title="审批中心"
        icon={<AuditOutlined style={{ color: '#0E7490' }} />}
        breadcrumbs={[{ title: '业务工作台', path: '/' }, { title: '审批中心' }]}
        extra={
          <Space>
            <Select value={filter} onChange={setFilter} style={{ width: 120 }}>
              <Select.Option value="pending">待我审批</Select.Option>
              <Select.Option value="approved">已通过</Select.Option>
              <Select.Option value="rejected">已驳回</Select.Option>
              <Select.Option value="all">全部</Select.Option>
            </Select>
          </Space>
        }
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} md={6}>
          <Card size="small"><Statistic title="待审批" value={stats.pending} valueStyle={{ color: '#F59E0B' }} prefix={<ClockCircleOutlined />} /></Card>
        </Col>
        <Col xs={24} md={6}>
          <Card size="small"><Statistic title="已通过" value={stats.approved} valueStyle={{ color: '#10B981' }} prefix={<CheckOutlined />} /></Card>
        </Col>
        <Col xs={24} md={6}>
          <Card size="small"><Statistic title="已驳回" value={stats.rejected} valueStyle={{ color: '#DC2626' }} prefix={<CloseOutlined />} /></Card>
        </Col>
        <Col xs={24} md={6}>
          <Card size="small"><Statistic title="平均时限" value="2.3h" suffix="/件" prefix={<ClockCircleOutlined />} /></Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={15}>
          <Card size="small" bodyStyle={{ padding: '12px 0 0' }}>
            <Table
              dataSource={filtered}
              columns={columns}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 8 }}
              onRow={(r) => ({ onClick: () => setSelected(r), style: { cursor: 'pointer', background: selected?.id === r.id ? '#e6f7ff' : undefined } })}
            />
          </Card>
        </Col>

        <Col xs={24} lg={9}>
          {selected ? (
            <Card size="small" title={
              <Space><AuditOutlined /> {selected.id}</Space>
            } extra={
              selected.status === 'pending' ? (
                <Space>
                  <Button size="small" type="primary" danger icon={<CloseOutlined />}>驳回</Button>
                  <Button size="small" type="primary" icon={<CheckOutlined />} style={{ background: '#10B981', borderColor: '#10B981' }}>通过</Button>
                </Space>
              ) : null
            }>
              <Descriptions column={1} size="small" bordered style={{ marginBottom: 12 }}>
                <Descriptions.Item label="审批类型">{selected.type}</Descriptions.Item>
                <Descriptions.Item label="申请单位">{selected.applicant}</Descriptions.Item>
                <Descriptions.Item label="安全级别">
                  <Tag color={selected.level === 'L3' ? 'red' : 'orange'}>{selected.level}级</Tag>
                  {selected.level === 'L1' && '（单签）'}
                  {selected.level === 'L2' && '（双因子认证）'}
                  {selected.level === 'L3' && '（多部门会签+区块链存证）'}
                </Descriptions.Item>
                <Descriptions.Item label="提交时间">{selected.submitTime}</Descriptions.Item>
                <Descriptions.Item label="审批期限">{selected.deadline}</Descriptions.Item>
              </Descriptions>

              {selected.aiPrediction && (
                <Card size="small" style={{ background: '#f0f5ff', marginBottom: 12 }}>
                  <Title level={5} style={{ color: '#3B82F6', margin: 0 }}>
                    <SearchOutlined /> AI预审意见
                  </Title>
                  <div style={{ marginTop: 8 }}>
                    <Text>综合评分: </Text>
                    <Text strong style={{ fontSize: 18, color: selected.aiPrediction.score >= 0.85 ? '#10B981' : '#F59E0B' }}>
                      {(selected.aiPrediction.score * 100).toFixed(0)}%
                    </Text>
                    {selected.aiPrediction.issues.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <Text type="secondary">需关注问题:</Text>
                        {selected.aiPrediction.issues.map((issue, i) => (
                          <div key={i} style={{ marginTop: 4 }}>
                            <Tag color="orange">⚠ {issue}</Tag>
                          </div>
                        ))}
                      </div>
                    )}
                    {selected.aiPrediction.issues.length === 0 && (
                      <div style={{ marginTop: 8 }}>
                        <Tag color="green">✅ 未发现明显问题</Tag>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              <Card size="small" title="申请材料" style={{ marginBottom: 12 }}>
                <List size="small" dataSource={['申请表', '监测报告', '公众参与材料', '环评文件']}
                  renderItem={(item, i) => (
                    <List.Item style={{ padding: '4px 0', cursor: 'pointer' }}>
                      <FileProtectOutlined style={{ marginRight: 8, color: '#3B82F6' }} />
                      <Text>{item}</Text>
                      {i === 2 && selected.aiPrediction?.issues.includes('公众参与材料不完整') && <Tag color="orange" style={{ marginLeft: 'auto' }}>需补充</Tag>}
                      {i === 3 && selected.aiPrediction?.issues.includes('生态影响评估需补充') && <Tag color="orange" style={{ marginLeft: 'auto' }}>需补充</Tag>}
                      <Tag color="green" style={{ marginLeft: i < 2 ? 'auto' : undefined }}>✓</Tag>
                    </List.Item>
                  )}
                />
              </Card>
            </Card>
          ) : (
            <Card size="small">
              <div style={{ padding: 40, textAlign: 'center', color: '#999' }}>
                <AuditOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                <br /><Text type="secondary">选择审批单查看详情和AI预审意见</Text>
              </div>
            </Card>
          )}
        </Col>
      </Row>
    </div>
  );
};

export default Approval;
