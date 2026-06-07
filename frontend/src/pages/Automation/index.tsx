/**
 * Automation — 任务中心 (Coze 级升级 v8.0)
 *
 * 参考: Coze Desktop /job + /task/:taskId + /plan/:taskId
 * 新增: 邮箱触发、执行配额、运行历史、MCP工具链、日志步骤
 */
import React, { useState, useMemo } from 'react';
import {
  Card, Button, Table, Tag, Space, Modal, Form, Input, Select,
  Switch, Popconfirm, Empty, Tabs, Badge, Tooltip, Row, Col,
  Statistic, Descriptions, Timeline, Steps, Drawer, Segmented,
  Typography, Progress, message,
} from 'antd';
import {
  PlusOutlined, PlayCircleOutlined, PauseCircleOutlined,
  DeleteOutlined, ClockCircleOutlined, HistoryOutlined,
  ThunderboltOutlined, SyncOutlined, CheckCircleOutlined,
  CloseCircleOutlined, MailOutlined, SendOutlined,
  EyeOutlined, SettingOutlined, CodeOutlined,
  DashboardOutlined, ApiOutlined, ReloadOutlined,
  ExclamationCircleOutlined, InboxOutlined,
} from '@ant-design/icons';
import { useAutomationStore, formatScheduleDisplay } from '@/store/automationStore';
import { useExpertStore } from '@/store/expertStore';
import { useChatStore } from '@/store/chatStore';
import { useNavigate } from 'react-router-dom';
import {
  AUTOMATION_TEMPLATES,
  type AutomationTask,
  type AutomationRun,
  type TriggerConfig,
  type AutomationStatus,
} from '@/types/automation';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text, Paragraph } = Typography;

// ─── 状态配置 ───
const statusConfig: Record<string, { color: string; text: string; icon: React.ReactNode }> = {
  active: { color: 'green', text: '运行中', icon: <SyncOutlined spin /> },
  paused: { color: 'orange', text: '已暂停', icon: <PauseCircleOutlined /> },
  ended: { color: 'default', text: '已归档', icon: <CheckCircleOutlined /> },
  failed: { color: 'red', text: '故障', icon: <CloseCircleOutlined /> },
};

const runStatusConfig: Record<string, { color: string; text: string }> = {
  scheduled: { color: 'default', text: '已排期' },
  queued: { color: 'processing', text: '排队中' },
  in_progress: { color: 'processing', text: '执行中' },
  succeeded: { color: 'success', text: '成功' },
  failed: { color: 'error', text: '失败' },
  interrupted: { color: 'warning', text: '中断' },
  missed: { color: 'default', text: '错过' },
};

// ─── 触发类型图标 ───
const triggerIcon = (t: TriggerConfig) => {
  if (t.type === 'email') return <MailOutlined />;
  if (t.type === 'webhook') return <ApiOutlined />;
  if (t.type === 'manual') return <PlayCircleOutlined />;
  return <ClockCircleOutlined />;
};

// ─── 主组件 ───
const AutomationPage: React.FC = () => {
  const store = useAutomationStore();
  const { experts } = useExpertStore();
  const { createSession } = useChatStore();
  const navigate = useNavigate();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<AutomationTask | null>(null);
  const [activeTab, setActiveTab] = useState('active');
  const [selectedTask, setSelectedTask] = useState<AutomationTask | null>(null);
  const [detailDrawer, setDetailDrawer] = useState(false);
  const [runHistoryTask, setRunHistoryTask] = useState<AutomationTask | null>(null);
  const [form] = Form.useForm();

  // ─── 过滤 ───
  const filteredTasks = useMemo(() => {
    if (activeTab === 'active') return store.tasks.filter(t => t.status === 'active' || t.status === 'paused');
    if (activeTab === 'archived') return store.tasks.filter(t => t.status === 'ended' || t.status === 'failed');
    return store.tasks;
  }, [store.tasks, activeTab]);

  const activeCount = store.tasks.filter(t => t.status === 'active').length;
  const pausedCount = store.tasks.filter(t => t.status === 'paused').length;
  const totalRunsToday = useMemo(() => {
    const today = new Date().toDateString();
    return Object.values(store.runs).flat().filter(r => new Date(r.startedAt).toDateString() === today).length;
  }, [store.runs]);

  const successRate = useMemo(() => {
    const allRuns = Object.values(store.runs).flat();
    if (allRuns.length === 0) return 100;
    const succeeded = allRuns.filter(r => r.status === 'succeeded').length;
    return Math.round((succeeded / allRuns.length) * 100);
  }, [store.runs]);

  // ─── 操作 ───
  const handleCreate = () => {
    setEditingTask(null);
    form.resetFields();
    form.setFieldsValue({ trigger: { type: 'cron', cron: '0 8 * * *', timezone: 'Asia/Shanghai' } });
    setModalOpen(true);
  };

  const handleEdit = (task: AutomationTask) => {
    setEditingTask(task);
    form.setFieldsValue(task);
    setModalOpen(true);
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    if (editingTask) {
      store.updateTask(editingTask.id, values);
      message.success('任务已更新');
    } else {
      store.createTask(values);
      message.success('任务已创建');
    }
    setModalOpen(false);
  };

  const handleRun = (task: AutomationTask) => {
    store.runTaskNow(task.id);
    const sessionId = createSession({
      title: `🤖 ${task.name}`,
      expertId: task.expertId || 'ecomind',
      expertName: experts.find(e => e.id === task.expertId)?.displayName || 'EcoMind',
    });
    message.info('任务已触发，查看执行日志...');
    navigate(`/chat/${sessionId}`);
  };

  const handleTemplate = (tid: string) => {
    store.createFromTemplate(tid);
    message.success('已从模板创建任务');
  };

  const openDetail = (task: AutomationTask) => {
    setSelectedTask(task);
    setDetailDrawer(true);
  };

  const openRunHistory = (task: AutomationTask) => {
    setRunHistoryTask(task);
  };

  // ─── 表格列 ───
  const columns: ColumnsType<AutomationTask> = [
    {
      title: '任务名称', dataIndex: 'name', key: 'name', width: 200,
      render: (text: string, record) => (
        <div>
          <div className="font-medium cursor-pointer hover:text-primary" onClick={() => openDetail(record)}>
            {triggerIcon(record.trigger)} {text}
          </div>
          {record.description && <Text type="secondary" className="text-xs">{record.description}</Text>}
        </div>
      ),
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: (s: string) => { const c = statusConfig[s]; return <Tag color={c?.color} icon={c?.icon}>{c?.text}</Tag>; },
    },
    {
      title: '触发方式', key: 'trigger', width: 180,
      render: (_, record) => (
        <Tooltip title={record.trigger.cron || ''}>
          <Space size={4}>
            {triggerIcon(record.trigger)}
            <Text className="text-xs">{formatScheduleDisplay(record.trigger)}</Text>
          </Space>
        </Tooltip>
      ),
    },
    { title: '运行次数', key: 'runs', width: 80, align: 'center', render: (_, r) => r.totalRuns },
    {
      title: '配额', key: 'quota', width: 100,
      render: (_, r) => r.quota ? (
        <Progress
          percent={Math.round((r.quota.currentDayRuns / r.quota.maxRunsPerDay) * 100)}
          size="small"
          format={() => `${r.quota!.currentDayRuns}/${r.quota!.maxRunsPerDay}`}
        />
      ) : <Text className="text-xs text-gray-300">无限制</Text>,
    },
    {
      title: '上次运行', key: 'lastRun', width: 140,
      render: (_, r) => r.lastRunAt ? (
        <div>
          <Text className="text-xs">{new Date(r.lastRunAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</Text>
          {r.lastRunStatus && <Tag style={{ fontSize: 10, marginLeft: 4 }} color={runStatusConfig[r.lastRunStatus]?.color}>{runStatusConfig[r.lastRunStatus]?.text}</Tag>}
        </div>
      ) : <Text className="text-xs text-gray-300">—</Text>,
    },
    {
      title: '操作', key: 'actions', width: 200, fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="立即执行"><Button size="small" type="primary" icon={<PlayCircleOutlined />} onClick={() => handleRun(record)} /></Tooltip>
          <Tooltip title={record.status === 'active' ? '暂停' : '恢复'}><Button size="small" icon={record.status === 'active' ? <PauseCircleOutlined /> : <PlayCircleOutlined />} onClick={() => store.toggleTaskStatus(record.id)} /></Tooltip>
          <Button size="small" icon={<EyeOutlined />} onClick={() => openDetail(record)} />
          <Popconfirm title="删除？" onConfirm={() => store.deleteTask(record.id)}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm>
        </Space>
      ),
    },
  ];

  // ─── 运行历史列 ───
  const runColumns: ColumnsType<AutomationRun> = [
    { title: '时间', dataIndex: 'startedAt', width: 160, render: (t: string) => new Date(t).toLocaleString('zh-CN') },
    { title: '触发', dataIndex: 'triggerType', width: 80, render: (t: string) => <Tag>{t === 'email' ? '📧 邮件' : t === 'manual' ? '👆 手动' : '⏰ 定时'}</Tag> },
    { title: '状态', dataIndex: 'status', width: 80, render: (s: string) => { const c = runStatusConfig[s]; return <Tag color={c?.color}>{c?.text}</Tag>; } },
    { title: '耗时', key: 'duration', width: 80, render: (_, r) => r.finishedAt ? `${Math.round((new Date(r.finishedAt).getTime() - new Date(r.startedAt).getTime()) / 1000)}s` : '—' },
    {
      title: '日志', key: 'log', ellipsis: true,
      render: (_, r) => r.logSteps?.length ? (
        <Text className="text-xs text-gray-400">{r.logSteps[r.logSteps.length - 1]?.message}</Text>
      ) : <Text className="text-xs text-gray-300">—</Text>,
    },
  ];

  // ─── 渲染 ───
  return (
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto" style={{ height: '100%', overflow: 'auto' }}>
      {/* 顶部 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <DashboardOutlined /> 任务中心
          </Title>
          <Text type="secondary">定时任务 · 邮件触发 · 智能体调度 · 执行监控</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => setActiveTab('active')}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>创建任务</Button>
        </Space>
      </div>

      {/* 统计卡片 */}
      <Row gutter={12} className="mb-4">
        <Col xs={12} sm={6}><Card size="small"><Statistic title="活跃任务" value={activeCount} prefix={<SyncOutlined />} valueStyle={{ color: '#1677ff' }} /></Card></Col>
        <Col xs={12} sm={6}><Card size="small"><Statistic title="已暂停" value={pausedCount} prefix={<PauseCircleOutlined />} valueStyle={{ color: '#fa8c16' }} /></Card></Col>
        <Col xs={12} sm={6}><Card size="small"><Statistic title="今日执行" value={totalRunsToday} prefix={<ThunderboltOutlined />} /></Card></Col>
        <Col xs={12} sm={6}><Card size="small"><Statistic title="成功率" value={successRate} suffix="%" prefix={<CheckCircleOutlined />} valueStyle={{ color: successRate >= 95 ? '#52c41a' : '#fa8c16' }} /></Card></Col>
      </Row>

      {/* 快速模板 */}
      <Card size="small" title="📋 快速模板" className="mb-4">
        <div className="flex flex-wrap gap-2">
          {AUTOMATION_TEMPLATES.map(tmpl => (
            <Button key={tmpl.id} size="small"
              icon={tmpl.category === 'email' ? <MailOutlined /> : <ThunderboltOutlined />}
              onClick={() => handleTemplate(tmpl.id)}
            >
              {tmpl.name}
            </Button>
          ))}
        </div>
      </Card>

      {/* Tab切换 */}
      <Tabs activeKey={activeTab} onChange={setActiveTab}
        items={[
          {
            key: 'active',
            label: <Space size={4}><SyncOutlined spin />活跃 ({activeCount + pausedCount})</Space>,
            children: filteredTasks.length === 0 ? (
              <Empty description="暂无活跃任务" className="py-12">
                <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>创建第一个任务</Button>
              </Empty>
            ) : (
              <Table dataSource={filteredTasks} columns={columns} rowKey="id" size="middle" pagination={{ pageSize: 10 }} scroll={{ x: 1000 }} />
            ),
          },
          {
            key: 'archived',
            label: <Space size={4}><HistoryOutlined />已归档</Space>,
            children: <Table dataSource={filteredTasks} columns={columns} rowKey="id" size="middle" pagination={{ pageSize: 10 }} scroll={{ x: 1000 }} />,
          },
          runHistoryTask ? {
            key: 'history',
            label: <Space size={4}><HistoryOutlined />运行历史 — {runHistoryTask.name}</Space>,
            children: (
              <div>
                <Button size="small" className="mb-3" onClick={() => setRunHistoryTask(null)}>← 返回任务列表</Button>
                {!store.runs[runHistoryTask.id]?.length ? (
                  <Empty description="暂无运行记录" />
                ) : (
                  <Table dataSource={store.runs[runHistoryTask.id] || []} columns={runColumns} rowKey="id" size="small" pagination={{ pageSize: 15 }} />
                )}
              </div>
            ),
          } : undefined,
        ].filter(Boolean) as any}
      />

      {/* ─── 创建/编辑 Modal ─── */}
      <Modal
        title={editingTask ? '编辑任务' : '创建任务'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        width={640}
        destroyOnClose
      >
        <Form form={form} layout="vertical" size="small">
          <Form.Item name="name" label="任务名称" rules={[{ required: true }]}>
            <Input placeholder="例如: 每日空气质量报告" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input placeholder="任务用途和场景" />
          </Form.Item>

          <Text strong className="block mb-2" style={{ fontSize: 13 }}>触发方式</Text>
          <Form.Item name={['trigger', 'type']} label="触发类型" initialValue="cron">
            <Select options={[
              { label: '⏰ 定时 (Cron)', value: 'cron' },
              { label: '📧 邮件触发', value: 'email' },
              { label: '👆 手动触发', value: 'manual' },
            ]} />
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(prev, cur) => prev?.trigger?.type !== cur?.trigger?.type}>
            {({ getFieldValue }) => {
              const triggerType = getFieldValue(['trigger', 'type']);
              if (triggerType === 'cron') return (
                <>
                  <Form.Item name={['trigger', 'cron']} label="Cron 表达式" initialValue="0 8 * * *">
                    <Input placeholder="0 8 * * * (每天8点)" />
                  </Form.Item>
                </>
              );
              if (triggerType === 'email') return (
                <>
                  <Form.Item name={['trigger', 'emailFilter', 'subject']} label="主题关键词">
                    <Input placeholder="包含此关键词的邮件触发任务" />
                  </Form.Item>
                  <Form.Item name={['trigger', 'emailFilter', 'from']} label="发件人">
                    <Input placeholder="指定发件人 (可选)" />
                  </Form.Item>
                  <Form.Item name={['trigger', 'emailFilter', 'hasAttachment']} label="仅含附件" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </>
              );
              return null;
            }}
          </Form.Item>

          <Form.Item name="expertId" label="执行智能体">
            <Select allowClear placeholder="选择执行的AI专家"
              options={experts.map(e => ({ label: `${e.displayName} (${e.category})`, value: e.id }))} />
          </Form.Item>
          <Form.Item name="promptTemplate" label="Prompt 模板" rules={[{ required: true }]}>
            <Input.TextArea rows={4} placeholder="输入发送给AI的提示词模板..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* ─── 任务详情 Drawer ─── */}
      <Drawer
        title={selectedTask?.name || '任务详情'}
        open={detailDrawer}
        onClose={() => setDetailDrawer(false)}
        width={480}
        extra={
          <Space>
            <Button icon={<PlayCircleOutlined />} type="primary" onClick={() => { handleRun(selectedTask!); setDetailDrawer(false); }}>立即执行</Button>
            <Button icon={<HistoryOutlined />} onClick={() => { setRunHistoryTask(selectedTask); setDetailDrawer(false); }}>运行历史</Button>
          </Space>
        }
      >
        {selectedTask && (
          <div className="space-y-4">
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="状态">
                <Tag color={statusConfig[selectedTask.status]?.color}>{statusConfig[selectedTask.status]?.text}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="触发">
                {triggerIcon(selectedTask.trigger)} {formatScheduleDisplay(selectedTask.trigger)}
              </Descriptions.Item>
              <Descriptions.Item label="执行智能体" span={2}>
                {experts.find(e => e.id === selectedTask.expertId)?.displayName || '未指定'}
              </Descriptions.Item>
              <Descriptions.Item label="总执行次数">{selectedTask.totalRuns}</Descriptions.Item>
              <Descriptions.Item label="上次执行">
                {selectedTask.lastRunAt ? new Date(selectedTask.lastRunAt).toLocaleString('zh-CN') : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间" span={2}>{new Date(selectedTask.createdAt).toLocaleString('zh-CN')}</Descriptions.Item>
            </Descriptions>

            {selectedTask.quota && (
              <Card size="small" title="执行配额">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <Text>今日</Text>
                    <Text>{selectedTask.quota.currentDayRuns}/{selectedTask.quota.maxRunsPerDay}</Text>
                  </div>
                  <Progress percent={Math.round((selectedTask.quota.currentDayRuns / selectedTask.quota.maxRunsPerDay) * 100)} size="small" />
                  <div className="flex justify-between text-xs">
                    <Text>本月</Text>
                    <Text>{selectedTask.quota.currentMonthRuns}/{selectedTask.quota.maxRunsPerMonth}</Text>
                  </div>
                  <Progress percent={Math.round((selectedTask.quota.currentMonthRuns / selectedTask.quota.maxRunsPerMonth) * 100)} size="small" />
                </div>
              </Card>
            )}

            {selectedTask.toolSteps?.length ? (
              <Card size="small" title="MCP 工具链">
                <Steps direction="vertical" size="small"
                  items={selectedTask.toolSteps.map((ts, i) => ({
                    title: ts.toolName,
                    description: ts.description,
                    status: 'process' as const,
                  }))}
                />
              </Card>
            ) : null}

            <Card size="small" title="Prompt 模板">
              <Paragraph className="text-xs" style={{ background: '#f5f5f5', padding: 8, borderRadius: 4, whiteSpace: 'pre-wrap' }}>
                {selectedTask.promptTemplate}
              </Paragraph>
            </Card>

            {selectedTask.notifyChannels?.length ? (
              <Card size="small" title="通知渠道">
                {selectedTask.notifyChannels.filter(c => c.enabled).map(c => (
                  <Tag key={c.type}>{c.type === 'email' ? '📧 邮件' : c.type === 'in_app' ? '📱 站内' : c.type}</Tag>
                ))}
              </Card>
            ) : null}

            <Space>
              <Button icon={<SettingOutlined />} onClick={() => { handleEdit(selectedTask); setDetailDrawer(false); }}>编辑</Button>
              <Popconfirm title="删除？" onConfirm={() => { store.deleteTask(selectedTask.id); setDetailDrawer(false); }}>
                <Button danger icon={<DeleteOutlined />}>删除</Button>
              </Popconfirm>
            </Space>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default AutomationPage;
