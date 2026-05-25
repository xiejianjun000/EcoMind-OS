/**
 * 工作流编排页面 — LangGraph 工作流设计与调试
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Button, Card, Select, Space, Table, Tag, Typography, Popconfirm, Modal, message } from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  PlayCircleOutlined,
  CancelOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { workflowApi, safeCall } from '@/services/api';
import type { WorkflowResponse, WorkflowCreateRequest, WorkflowStatus } from '@/services/types';
import WorkflowStats from './components/WorkflowStats';
import CreateWorkflowModal from './components/CreateWorkflowModal';
import WorkflowDetailModal from './components/WorkflowDetailModal';

const { Title, Text } = Typography;

const statusColorMap: Record<WorkflowStatus, string> = {
  pending: 'blue',
  running: 'green',
  paused: 'orange',
  completed: 'green',
  failed: 'red',
  cancelled: 'orange',
};

const WorkflowsPage: React.FC = () => {
  const { t } = useTranslation();
  const [workflows, setWorkflows] = useState<WorkflowResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [detailWorkflow, setDetailWorkflow] = useState<WorkflowResponse | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);

  /** 加载工作流列表 */
  const fetchWorkflows = useCallback(async () => {
    setLoading(true);
    const result = await safeCall(() => workflowApi.list({ status: filterStatus }));
    if (result) {
      setWorkflows(result.workflows);
    }
    setLoading(false);
  }, [filterStatus]);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  /** 创建工作流 */
  const handleCreate = async (values: WorkflowCreateRequest) => {
    setCreating(true);
    const result = await safeCall(() => workflowApi.create(values));
    if (result) {
      setCreateOpen(false);
      fetchWorkflows();
    }
    setCreating(false);
  };

  /** 执行工作流 */
  const handleExecute = async (id: string) => {
    const result = await safeCall(() => workflowApi.execute(id));
    if (result) {
      message.success(`工作流 ${result.workflow_id} 已启动执行`);
      fetchWorkflows();
    }
  };

  /** 取消工作流 */
  const handleCancel = async (id: string) => {
    const result = await safeCall(() => workflowApi.cancel(id));
    if (result) {
      message.success(`工作流已取消`);
      fetchWorkflows();
    }
  };

  /** 查看详情 */
  const handleViewDetail = async (id: string) => {
    const result = await safeCall(() => workflowApi.get(id));
    if (result) {
      setDetailWorkflow(result);
    }
  };

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 180,
      render: (text: string, record: WorkflowResponse) => (
        <div>
          <div className="font-medium">{text}</div>
          <div className="text-xs text-gray-400">{record.workflow_id.slice(0, 8)}</div>
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: WorkflowStatus) => (
        <Tag color={statusColorMap[status]}>{status}</Tag>
      ),
    },
    {
      title: '步骤数',
      key: 'steps',
      width: 80,
      align: 'center' as const,
      render: (_: unknown, record: WorkflowResponse) => record.nodes.length,
    },
    {
      title: '当前节点',
      dataIndex: 'current_node',
      key: 'current_node',
      width: 120,
      render: (text: string | null) => text ?? '—',
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text: string) => text || '—',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 170,
      render: (text: string) => new Date(text).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right' as const,
      render: (_: unknown, record: WorkflowResponse) => (
        <Space size="small">
          {(record.status === 'pending' || record.status === 'completed' || record.status === 'failed') && (
            <Popconfirm
              title="确定执行该工作流吗？"
              onConfirm={() => handleExecute(record.workflow_id)}
              okText="确定"
              cancelText="取消"
            >
              <Button type="link" size="small" icon={<PlayCircleOutlined />}>
                执行
              </Button>
            </Popconfirm>
          )}
          {record.status === 'running' && (
            <Popconfirm
              title="确定取消该工作流吗？"
              onConfirm={() => handleCancel(record.workflow_id)}
              okText="确定"
              cancelText="取消"
            >
              <Button type="link" size="small" danger icon={<CancelOutlined />}>
                取消
              </Button>
            </Popconfirm>
          )}
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record.workflow_id)}
          >
            详情
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div>
          <Title level={3} style={{ margin: 0 }}>
            {t('workflows.title')}
          </Title>
          <Text type="secondary">{t('workflows.description')}</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchWorkflows}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            创建工作流
          </Button>
        </Space>
      </div>

      {/* 统计卡片 */}
      <WorkflowStats workflows={workflows} loading={loading} />

      {/* 筛选栏 */}
      <Card size="small">
        <Space>
          <span>按状态筛选：</span>
          <Select
            placeholder="全部状态"
            value={filterStatus}
            onChange={setFilterStatus}
            allowClear
            style={{ width: 140 }}
            options={[
              { value: 'pending', label: '待执行' },
              { value: 'running', label: '运行中' },
              { value: 'completed', label: '已完成' },
              { value: 'failed', label: '失败' },
              { value: 'cancelled', label: '已取消' },
            ]}
          />
        </Space>
      </Card>

      {/* 工作流列表 */}
      <Card>
        <Table
          dataSource={workflows}
          columns={columns}
          loading={loading}
          rowKey="workflow_id"
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
          scroll={{ x: 1000 }}
          size="middle"
        />
      </Card>

      {/* 创建工作流弹窗 */}
      <CreateWorkflowModal
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={handleCreate}
        loading={creating}
      />

      {/* 工作流详情弹窗 */}
      <WorkflowDetailModal
        open={!!detailWorkflow}
        workflow={detailWorkflow}
        onCancel={() => setDetailWorkflow(null)}
      />
    </div>
  );
};

export default WorkflowsPage;
