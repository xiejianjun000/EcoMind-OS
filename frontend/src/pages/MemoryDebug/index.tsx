import React, { useState } from 'react';
import { Card, Button, Select, Switch, Tag, Space, Table, Statistic, Divider, Progress, Empty, Modal, Descriptions, Badge } from 'antd';
import { PlayCircleOutlined, SettingOutlined, DeleteOutlined, MoonOutlined } from '@ant-design/icons';
import { useMemoryStore } from '@/store/memoryStore';
import { useExpertStore } from '@/store/expertStore';
import type { LongTermMemory, DreamDiaryEntry } from '@/types/memory';
import type { ColumnsType } from 'antd/es/table';

const MemoryDebugPage: React.FC = () => {
  const { config, diaryEntries, longTermMemories, dreamingStatus, phaseDetails, stats, toggleDreaming, runDreaming, clearAgentMemory } = useMemoryStore();
  const { experts } = useExpertStore();
  const [selectedAgent, setSelectedAgent] = useState('ecomind');
  const [showConfig, setShowConfig] = useState(false);

  const agentMemories = longTermMemories.filter(m => m.agentId === selectedAgent);
  const agentDiaries = diaryEntries.filter(d => d.agentId === selectedAgent);

  const handleRunDreaming = async () => {
    await runDreaming(selectedAgent);
  };

  const memoryColumns: ColumnsType<LongTermMemory> = [
    { title: '类型', dataIndex: 'type', key: 'type', width: 80, render: (t: string) => {
      const colors: Record<string, string> = { fact: 'blue', insight: 'green', relationship: 'purple', preference: 'orange', alert: 'red' };
      return <Tag color={colors[t] || 'default'}>{t}</Tag>;
    }},
    { title: '内容', dataIndex: 'content', key: 'content', ellipsis: true },
    { title: '置信度', dataIndex: 'confidence', key: 'confidence', width: 80, render: (c: number) => `${(c * 100).toFixed(0)}%` },
    { title: '召回次数', dataIndex: 'recallCount', key: 'recallCount', width: 80 },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 140, render: (t: string) => new Date(t).toLocaleDateString('zh-CN') },
  ];

  const diaryColumns: ColumnsType<DreamDiaryEntry> = [
    { title: '日期', dataIndex: 'date', key: 'date', width: 100 },
    { title: '阶段', dataIndex: 'phase', key: 'phase', width: 60, render: (p: string) => <Tag color={p === 'deep' ? 'blue' : 'cyan'}>{p}</Tag> },
    { title: '摘要', dataIndex: 'summary', key: 'summary', ellipsis: true },
    { title: '关键发现', dataIndex: 'keyFindings', key: 'keyFindings', render: (f: string[]) => f.join(', ') },
    { title: '评分', dataIndex: 'score', key: 'score', width: 60, render: (s: number) => `${(s * 100).toFixed(0)}%` },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><MoonOutlined className="text-indigo-500" />记忆与梦境系统</h1>
          <p className="text-gray-500 text-sm mt-1">长期记忆管理 · 自动化回顾 · 知识沉淀</p>
        </div>
        <Space>
          <Select value={selectedAgent} onChange={setSelectedAgent} style={{ width: 180 }} options={experts.map(e => ({ label: e.displayName, value: e.id }))} />
          <Button icon={<SettingOutlined />} onClick={() => setShowConfig(true)}>配置</Button>
        </Space>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card size="small"><Statistic title="长期记忆" value={stats.totalMemories} suffix="条" /></Card>
        <Card size="small"><Statistic title="梦境日记" value={diaryEntries.length} suffix="篇" /></Card>
        <Card size="small"><Statistic title="平均置信度" value={(stats.averageConfidence * 100).toFixed(1)} suffix="%" /></Card>
        <Card size="small"><Statistic title="最后回顾" value={stats.lastDreamingAt ? new Date(stats.lastDreamingAt).toLocaleDateString('zh-CN') : '从未'} /></Card>
      </div>

      <Card className="mb-6" size="small">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Switch checked={config.enabled} onChange={toggleDreaming} />
            <span className="font-medium">梦境自动回顾</span>
            <Tag color={config.enabled ? 'green' : 'default'}>{config.enabled ? '已启用' : '已禁用'}</Tag>
          </div>
          <Button type="primary" icon={<PlayCircleOutlined />} onClick={handleRunDreaming} loading={dreamingStatus === 'running'} disabled={!config.enabled}>
            {dreamingStatus === 'running' ? '回顾中...' : '立即回顾'}
          </Button>
        </div>
        {phaseDetails && (
          <div className="mt-4">
            <Divider />
            <div className="flex gap-6">
              <div className="flex-1">
                <div className="text-sm font-medium mb-2"><Badge status={phaseDetails.phase === 'light' && phaseDetails.status === 'running' ? 'processing' : 'success'} /> <Tag color="cyan">浅层梦境</Tag></div>
                <Progress percent={phaseDetails.phase === 'light' && phaseDetails.status === 'running' ? 50 : 100} size="small" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium mb-2"><Badge status={phaseDetails.phase === 'deep' && phaseDetails.status === 'running' ? 'processing' : phaseDetails.phase === 'deep' ? 'success' : 'default'} /> <Tag color="blue">深层梦境</Tag></div>
                <Progress percent={phaseDetails.phase === 'deep' ? (phaseDetails.status === 'completed' ? 100 : 50) : 0} size="small" />
              </div>
            </div>
          </div>
        )}
      </Card>

      <Card title={`长期记忆 (${agentMemories.length})`} className="mb-6" size="small"
        extra={<Button size="small" danger icon={<DeleteOutlined />} onClick={() => clearAgentMemory(selectedAgent)}>清除记忆</Button>}
      >
        {agentMemories.length === 0 ? <Empty description="暂无长期记忆" /> : <Table dataSource={agentMemories} columns={memoryColumns} rowKey="id" size="small" pagination={{ pageSize: 8 }} />}
      </Card>

      <Card title={`梦境日记 (${agentDiaries.length})`} size="small">
        {agentDiaries.length === 0 ? <Empty description="暂无梦境日记" /> : <Table dataSource={agentDiaries} columns={diaryColumns} rowKey="id" size="small" expandable={{
          expandedRowRender: (r) => (
            <div className="p-4">
              <Descriptions column={2} size="small">
                <Descriptions.Item label="摘要">{r.summary}</Descriptions.Item>
                <Descriptions.Item label="评分">{(r.score * 100).toFixed(0)}%</Descriptions.Item>
              </Descriptions>
              <div className="mt-2"><span className="text-xs font-medium">关键发现:</span><ul className="text-sm mt-1">{r.keyFindings.map((f,i) => <li key={i}>• {f}</li>)}</ul></div>
              {r.actionableItems.length > 0 && <div className="mt-2"><span className="text-xs font-medium">行动建议:</span><ul className="text-sm mt-1">{r.actionableItems.map((a,i) => <li key={i} className="text-blue-600">→ {a}</li>)}</ul></div>}
            </div>
          ),
        }} pagination={{ pageSize: 5 }} />}
      </Card>

      <Modal title="梦境配置" open={showConfig} onCancel={() => setShowConfig(false)} onOk={() => setShowConfig(false)} width={500}>
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="启用状态"><Switch checked={config.enabled} onChange={toggleDreaming} /></Descriptions.Item>
          <Descriptions.Item label="执行频率">{config.frequency}</Descriptions.Item>
          <Descriptions.Item label="时区">{config.timezone}</Descriptions.Item>
          <Descriptions.Item label="浅层回顾天数">{config.lightPhase.lookbackDays} 天</Descriptions.Item>
          <Descriptions.Item label="浅层条数上限">{config.lightPhase.limit}</Descriptions.Item>
          <Descriptions.Item label="深层条数上限">{config.deepPhase.limit}</Descriptions.Item>
          <Descriptions.Item label="深层最低评分">{config.deepPhase.minScore}</Descriptions.Item>
          <Descriptions.Item label="深层最低召回">{config.deepPhase.minRecallCount} 次</Descriptions.Item>
        </Descriptions>
      </Modal>
    </div>
  );
};

export default MemoryDebugPage;
