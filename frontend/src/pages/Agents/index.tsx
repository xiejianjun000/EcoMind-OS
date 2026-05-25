/**
 * Agent 管理页面 — 智能体配置、启停与状态监控
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Button, Space, Typography, Select, Card, Input } from 'antd';
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { agentApi, safeCall } from '@/services/api';
import type { AgentResponse, AgentCreateRequest, AgentStatus } from '@/services/types';
import AgentStats from './components/AgentStats';
import AgentTable from './components/AgentTable';
import CreateAgentModal from './components/CreateAgentModal';
import SendMessageModal from './components/SendMessageModal';

const { Title, Text } = Typography;

const AgentsPage: React.FC = () => {
  const { t } = useTranslation();
  const [agents, setAgents] = useState<AgentResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [messageAgent, setMessageAgent] = useState<AgentResponse | null>(null);

  // 筛选状态
  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);
  const [filterProvider, setFilterProvider] = useState<string | undefined>(undefined);
  const [searchText, setSearchText] = useState('');

  /** 加载 Agent 列表 */
  const fetchAgents = useCallback(async () => {
    setLoading(true);
    const result = await safeCall(() =>
      agentApi.list({ status: filterStatus, provider: filterProvider })
    );
    if (result) {
      let filtered = result.agents;
      if (searchText.trim()) {
        const kw = searchText.trim().toLowerCase();
        filtered = filtered.filter(
          (a) =>
            a.name.toLowerCase().includes(kw) ||
            a.agent_id.toLowerCase().includes(kw) ||
            a.model.toLowerCase().includes(kw)
        );
      }
      setAgents(filtered);
    }
    setLoading(false);
  }, [filterStatus, filterProvider, searchText]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  /** 创建 Agent */
  const handleCreate = async (values: AgentCreateRequest) => {
    setCreating(true);
    const result = await safeCall(() => agentApi.create(values));
    if (result) {
      setCreateOpen(false);
      fetchAgents();
    }
    setCreating(false);
  };

  /** 更新 Agent 状态 */
  const handleStatusChange = async (id: string, status: AgentStatus) => {
    const result = await safeCall(() => agentApi.updateStatus(id, status));
    if (result) {
      fetchAgents();
    }
  };

  /** 发送消息 */
  const handleSendMessage = (agent: AgentResponse) => {
    setMessageAgent(agent);
  };

  return (
    <div className="p-6 space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <Title level={3} style={{ margin: 0 }}>
            {t('agents.title')}
          </Title>
          <Text type="secondary">{t('agents.description')}</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchAgents}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            创建 Agent
          </Button>
        </Space>
      </div>

      {/* 统计卡片 */}
      <AgentStats agents={agents} loading={loading} />

      {/* 筛选栏 */}
      <Card size="small">
        <Space wrap>
          <Input
            placeholder="搜索名称/ID/模型"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 220 }}
            allowClear
          />
          <Select
            placeholder="按状态筛选"
            value={filterStatus}
            onChange={setFilterStatus}
            allowClear
            style={{ width: 140 }}
            options={[
              { value: 'running', label: '运行中' },
              { value: 'paused', label: '已暂停' },
              { value: 'stopped', label: '已停止' },
              { value: 'error', label: '错误' },
            ]}
          />
          <Select
            placeholder="按提供商筛选"
            value={filterProvider}
            onChange={setFilterProvider}
            allowClear
            style={{ width: 160 }}
            options={[
              { value: 'qwen', label: 'Qwen' },
              { value: 'deepseek', label: 'DeepSeek' },
              { value: 'glm', label: 'GLM' },
              { value: 'openai', label: 'OpenAI' },
              { value: 'anthropic', label: 'Anthropic' },
              { value: 'kimi', label: 'Kimi' },
              { value: 'yi', label: 'Yi' },
            ]}
          />
        </Space>
      </Card>

      {/* Agent 列表 */}
      <Card>
        <AgentTable
          agents={agents}
          loading={loading}
          onStatusChange={handleStatusChange}
          onSendMessage={handleSendMessage}
        />
      </Card>

      {/* 创建 Agent 弹窗 */}
      <CreateAgentModal
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={handleCreate}
        loading={creating}
      />

      {/* 发送消息弹窗 */}
      {messageAgent && (
        <SendMessageModal
          open={!!messageAgent}
          agentId={messageAgent.agent_id}
          agentName={messageAgent.name}
          onCancel={() => setMessageAgent(null)}
        />
      )}
    </div>
  );
};

export default AgentsPage;
