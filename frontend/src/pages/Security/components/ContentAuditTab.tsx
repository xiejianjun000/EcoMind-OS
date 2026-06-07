/**
 * ContentAuditTab — 内容安全审计 (L1/L2/L3 三级)
 * 从 SecurityAudit 页面提取，作为 Security 页面的子 Tab
 */
import React, { useState, useMemo } from 'react';
import { Card, Table, Tag, Button, Select, Switch, Modal, Descriptions, Statistic, Empty, Input, Badge, Row, Col } from 'antd';
import { SafetyOutlined, CheckCircleOutlined, CloseCircleOutlined, FlagOutlined, ExclamationCircleOutlined, EyeOutlined } from '@ant-design/icons';
import { useSecurityStore } from '@/store/securityStore';
import type { SecurityAuditLog, AuditRule, AuditVerdict, AuditType, ContentSafetyCheck } from '@/types/security';
import type { ColumnsType } from 'antd/es/table';

const verdictConfig: Record<AuditVerdict, { color: string; text: string; icon: React.ReactNode }> = {
  pass: { color: 'green', text: '通过', icon: <CheckCircleOutlined /> },
  flag: { color: 'orange', text: '标记', icon: <FlagOutlined /> },
  block: { color: 'red', text: '拦截', icon: <CloseCircleOutlined /> },
  pending_review: { color: 'blue', text: '待审', icon: <ExclamationCircleOutlined /> },
};

const typeLabels: Record<AuditType, string> = {
  prompt: '用户输入', response: 'AI回复', skill: '技能调用', tool_call: '工具调用', file_access: '文件访问',
};

const ContentAuditTab: React.FC = () => {
  const { auditLogs, rules, stats, addAuditLog, checkContent, toggleRule, refreshStats } = useSecurityStore();
  const [filterType, setFilterType] = useState<AuditType | 'all'>('all');
  const [filterVerdict, setFilterVerdict] = useState<AuditVerdict | 'all'>('all');
  const [selectedLog, setSelectedLog] = useState<SecurityAuditLog | null>(null);
  const [testContent, setTestContent] = useState('');
  const [testResult, setTestResult] = useState<ContentSafetyCheck | null>(null);

  const filteredLogs = useMemo(() => auditLogs.filter(l => {
    if (filterType !== 'all' && l.type !== filterType) return false;
    if (filterVerdict !== 'all' && l.verdict !== filterVerdict) return false;
    return true;
  }), [auditLogs, filterType, filterVerdict]);

  const handleTest = () => {
    if (!testContent.trim()) return;
    const result = checkContent(testContent, 'prompt');
    setTestResult(result);
    addAuditLog({
      type: 'prompt', level: result.riskLevel === 'critical' ? 'L3' : 'L1',
      verdict: result.passed ? 'pass' : 'flag', userId: 'admin',
      contentSummary: testContent.slice(0, 100), contentHash: btoa(testContent).slice(0, 32),
      matchedRules: result.riskCategories, details: result.details,
    });
  };

  const logColumns: ColumnsType<SecurityAuditLog> = [
    { title: '时间', dataIndex: 'createdAt', key: 'createdAt', width: 150, render: (t: string) => new Date(t).toLocaleString('zh-CN') },
    { title: '类型', dataIndex: 'type', key: 'type', width: 80, render: (t: AuditType) => <Tag>{typeLabels[t]}</Tag> },
    { title: '判定', dataIndex: 'verdict', key: 'verdict', width: 80, render: (v: AuditVerdict) => { const c = verdictConfig[v]; return <Tag color={c.color} icon={c.icon}>{c.text}</Tag>; } },
    { title: '等级', dataIndex: 'level', key: 'level', width: 60, render: (l: string) => <Badge color={l === 'L3' ? 'red' : l === 'L2' ? 'orange' : 'green'} text={l} /> },
    { title: '内容摘要', dataIndex: 'contentSummary', key: 'contentSummary', ellipsis: true },
    { title: '规则', dataIndex: 'matchedRules', key: 'matchedRules', width: 80, render: (r: string[]) => <Tag>{r.length} 条</Tag> },
    { title: '操作', key: 'actions', width: 80, render: (_, record) => <Button size="small" icon={<EyeOutlined />} onClick={() => setSelectedLog(record)}>详情</Button> },
  ];

  const ruleColumns: ColumnsType<AuditRule> = [
    { title: '规则名称', dataIndex: 'name', key: 'name' },
    { title: '类型', dataIndex: 'type', key: 'type', width: 80, render: (t: AuditType) => <Tag>{typeLabels[t]}</Tag> },
    { title: '等级', dataIndex: 'level', key: 'level', width: 60 },
    { title: '动作', dataIndex: 'action', key: 'action', width: 60, render: (a: string) => <Tag color={a === 'block' ? 'red' : a === 'flag' ? 'orange' : 'blue'}>{a}</Tag> },
    { title: '匹配模式', dataIndex: 'pattern', key: 'pattern', width: 200, ellipsis: true },
    { title: '状态', dataIndex: 'enabled', key: 'enabled', width: 60, render: (e: boolean, r) => <Switch size="small" checked={e} onChange={() => toggleRule(r.id)} /> },
  ];

  return (
    <div className="space-y-4">
      {/* 统计卡片 */}
      <Row gutter={12}>
        <Col span={4}><Card size="small"><Statistic title="总审计数" value={stats.totalAudits} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="通过" value={stats.byVerdict.pass} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="标记" value={stats.byVerdict.flag} valueStyle={{ color: '#fa8c16' }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="拦截" value={stats.byVerdict.block} valueStyle={{ color: '#f5222d' }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="待审" value={stats.pendingReview} valueStyle={{ color: '#1890ff' }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="规则数" value={rules.length} valueStyle={{ color: '#722ed1' }} /></Card></Col>
      </Row>

      {/* 审计日志 */}
      <Card size="small" title="审计日志">
        <div className="flex gap-3 mb-4">
          <Select size="small" value={filterType} onChange={setFilterType} style={{ width: 120 }}
            options={[{ label: '全部类型', value: 'all' }, ...Object.entries(typeLabels).map(([k, v]) => ({ label: v, value: k }))]} />
          <Select size="small" value={filterVerdict} onChange={setFilterVerdict} style={{ width: 120 }}
            options={[{ label: '全部判定', value: 'all' }, ...Object.entries(verdictConfig).map(([k, v]) => ({ label: v.text, value: k }))]} />
          <Button size="small" icon={<SafetyOutlined />} onClick={refreshStats}>刷新</Button>
        </div>
        {filteredLogs.length === 0 ? <Empty description="暂无审计日志" /> :
          <Table dataSource={filteredLogs} columns={logColumns} rowKey="id" size="small" pagination={{ pageSize: 10 }} />}
      </Card>

      {/* 审计规则 */}
      <Card size="small" title="审计规则配置">
        <Table dataSource={rules} columns={ruleColumns} rowKey="id" size="small" pagination={false} />
      </Card>

      {/* 安全测试 */}
      <Card size="small" title="内容安全测试">
        <Input.TextArea rows={3} value={testContent} onChange={e => setTestContent(e.target.value)} placeholder="输入待测试内容..." />
        <Button type="primary" onClick={handleTest} className="mt-3" icon={<SafetyOutlined />}>执行检查</Button>
        {testResult && (
          <div className="mt-4">
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="结果"><Tag color={testResult.passed ? 'green' : 'red'}>{testResult.passed ? '通过' : '未通过'}</Tag></Descriptions.Item>
              <Descriptions.Item label="风险"><Tag color={testResult.riskLevel === 'critical' ? 'red' : testResult.riskLevel === 'high' ? 'orange' : testResult.riskLevel === 'medium' ? 'gold' : 'green'}>{testResult.riskLevel}</Tag></Descriptions.Item>
              <Descriptions.Item label="详情" span={2}>{testResult.details}</Descriptions.Item>
              {testResult.suggestions && <Descriptions.Item label="建议" span={2}>{testResult.suggestions.join('；')}</Descriptions.Item>}
            </Descriptions>
          </div>
        )}
      </Card>

      {/* 详情 Modal */}
      <Modal title="审计详情" open={!!selectedLog} onCancel={() => setSelectedLog(null)} footer={null} width={600}>
        {selectedLog && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="ID">{selectedLog.id}</Descriptions.Item>
            <Descriptions.Item label="类型"><Tag>{typeLabels[selectedLog.type]}</Tag></Descriptions.Item>
            <Descriptions.Item label="判定"><Tag color={verdictConfig[selectedLog.verdict].color}>{verdictConfig[selectedLog.verdict].text}</Tag></Descriptions.Item>
            <Descriptions.Item label="等级">{selectedLog.level}</Descriptions.Item>
            <Descriptions.Item label="内容">{selectedLog.contentSummary}</Descriptions.Item>
            <Descriptions.Item label="规则">{selectedLog.matchedRules.join(', ') || '无'}</Descriptions.Item>
            <Descriptions.Item label="详情">{selectedLog.details}</Descriptions.Item>
            <Descriptions.Item label="时间">{new Date(selectedLog.createdAt).toLocaleString('zh-CN')}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default ContentAuditTab;
