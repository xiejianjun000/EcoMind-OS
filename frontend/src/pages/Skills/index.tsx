import React from 'react';
import { Row, Col, Card, Table, Tag, Typography, Space, Button, List, Select } from 'antd';
import { ThunderboltOutlined, ExperimentOutlined, SafetyCertificateOutlined, AuditOutlined, FileTextOutlined, BarChartOutlined } from '@ant-design/icons';
import PageHeader from '@/components/PageHeader';

const { Title, Text } = Typography;

const SKILLS_DATA = [
  { name: '环境监测技能', category: 'environment', triggers: ['监测', 'AQI', '水质', '噪声'], tools: ['query_environment_data', 'generate_report'], agents: ['监测分析智能体', '大气治理智能体', '水环境治理智能体'], priority: 10 },
  { name: '碳排放管理', category: 'carbon', triggers: ['碳排放', '碳配额', '减排', '碳中和'], tools: ['query_emission_data', 'search_regulation'], agents: ['大气治理智能体'], priority: 10 },
  { name: '执法辅助决策', category: 'enforcement', triggers: ['执法', '违法', '处罚', '超标'], tools: ['search_regulation', 'submit_approval'], agents: ['执法办案智能体'], priority: 8 },
  { name: '审批流程辅助', category: 'approval', triggers: ['审批', '许可', '环评'], tools: ['submit_approval', 'search_regulation'], agents: ['环评审批智能体'], priority: 8 },
  { name: '报告自动生成', category: 'report', triggers: ['报告', '日报', '周报', '月报'], tools: ['generate_report'], agents: ['全部智能体'], priority: 5 },
  { name: 'AI安全审计', category: 'security', triggers: ['安全', '审计', '漏洞'], tools: ['search_regulation'], agents: ['全部智能体'], priority: 9 },
];

const DEPT_SKILLS = [
  { dept: '生态环境执法局', agent: '执法办案智能体', skills: ['执法辅助决策', '环境监测技能', '报告自动生成'] },
  { dept: '生态环境监测处', agent: '监测分析智能体', skills: ['环境监测技能', '报告自动生成', 'AI安全审计'] },
  { dept: '环评与排放管理处', agent: '环评审批智能体', skills: ['审批流程辅助', 'AI安全审计'] },
  { dept: '大气与气候变化处', agent: '大气治理智能体', skills: ['碳排放管理', '环境监测技能', '报告自动生成'] },
  { dept: '水生态环境处', agent: '水环境治理智能体', skills: ['环境监测技能', '报告自动生成'] },
  { dept: '法规与标准处', agent: '法规标准智能体', skills: ['执法辅助决策', '审批流程辅助', 'AI安全审计'] },
];

const CAT_ICONS: Record<string, React.ReactNode> = {
  environment: <ExperimentOutlined />,
  carbon: <BarChartOutlined />,
  enforcement: <ThunderboltOutlined />,
  approval: <AuditOutlined />,
  report: <FileTextOutlined />,
  security: <SafetyCertificateOutlined />,
};

const Skills: React.FC = () => {
  return (
    <div>
      <PageHeader
        title="技能配置"
        icon={<ThunderboltOutlined style={{ color: '#8B5CF6' }} />}
        breadcrumbs={[{ title: '智能体管理', path: '/' }, { title: '技能配置' }]}
        extra={<Button type="primary">+ 创建自定义技能</Button>}
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card size="small" title="📦 技能库 (ECC格式)" bodyStyle={{ padding: 0 }}>
            <Table
              dataSource={SKILLS_DATA}
              rowKey="name"
              size="small"
              pagination={false}
              columns={[
                { title: '技能名称', dataIndex: 'name', width: 160, render: (v: string, r: typeof SKILLS_DATA[0]) => <Space>{CAT_ICONS[r.category]}<Text strong>{v}</Text></Space> },
                { title: '触发词', dataIndex: 'triggers', width: 220, render: (v: string[]) => v.map(t => <Tag key={t} size="small">{t}</Tag>) },
                { title: '绑定工具', dataIndex: 'tools', width: 200, render: (v: string[]) => v.map(t => <Tag key={t} color="blue" size="small">{t}</Tag>) },
                { title: '绑定智能体', dataIndex: 'agents', width: 200, render: (v: string[]) => v.map(a => <Tag key={a} color="purple" size="small">{a}</Tag>) },
                { title: '优先级', dataIndex: 'priority', width: 70 },
              ]}
            />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card size="small" title="🔗 部门-智能体-技能绑定" bodyStyle={{ padding: '8px 0', maxHeight: 400, overflow: 'auto' }}>
            {DEPT_SKILLS.map((item, i) => (
              <div key={i} style={{ padding: '8px 12px', borderBottom: '1px solid #f0f0f0' }}>
                <Text strong style={{ fontSize: 13 }}>{item.dept}</Text>
                <br />
                <Tag color="purple" size="small">{item.agent}</Tag>
                <div style={{ marginTop: 4 }}>
                  {item.skills.map(s => <Tag key={s} size="small" color="green">{s}</Tag>)}
                </div>
              </div>
            ))}
          </Card>
          <Card size="small" title="🧠 Instincts 全局规则" style={{ marginTop: 16 }}>
            <List size="small" dataSource={[
              '绝不编造环境监测数据',
              '数值引用必须有来源',
              '不确定信息标注"待核实"',
              '执法建议标注"AI辅助生成"',
              '不得建议违法或规避监管的行为',
            ]} renderItem={(item) => <List.Item style={{ padding: '4px 0' }}><Text style={{ fontSize: 12 }}>🔴 {item}</Text></List.Item>} />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Skills;
