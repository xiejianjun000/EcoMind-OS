/**
 * 部门智能体绑定管理页面 — 湖南省生态环境厅 19 部门 × AI智能体
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Card, Table, Tag, Button, Space, Typography, message, Tooltip, Row, Col, Statistic,
} from 'antd';
import {
  ReloadOutlined, ThunderboltOutlined, CheckCircleOutlined,
  ExclamationCircleOutlined, ClockCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { departmentApi } from '@/services/api';
import { DEFAULT_DEPT_AGENTS } from '@/services/types';
import type { DepartmentAgentBinding } from '@/services/types';
import PageHeader from '@/components/PageHeader';

const { Text } = Typography;

const priorityColor: Record<string, string> = {
  P0: '#DC2626', P1: '#D97706', P2: '#2563EB', P3: '#6B7280',
};

const priorityLabel: Record<string, string> = {
  P0: '🔴 核心业务', P1: '🟡 综合协调', P2: '🟢 专业保障', P3: '⚪ 内部管理',
};

interface DeptRow extends DepartmentAgentBinding {
  status: 'running' | 'stopped' | 'uninitialized';
  agentId?: string;
  color?: string;
  emoji?: string;
}

const DepartmentsPage: React.FC = () => {
  const [data, setData] = useState<DeptRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(false);

  const fetchBindings = useCallback(async () => {
    setLoading(true);
    try {
      const bindings = await departmentApi.listBindings();
      const merged = DEFAULT_DEPT_AGENTS.map((def) => {
        const remote = bindings.find((b: any) => b.department === def.department);
        return {
          ...def, status: remote?.status || 'uninitialized',
          agentId: remote?.agentId, color: remote?.color || '#475569', emoji: remote?.emoji || '',
        } as DeptRow;
      });
      setData(merged);
    } catch {
      setData(DEFAULT_DEPT_AGENTS.map((d) => ({ ...d, status: 'uninitialized' as const })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchBindings(); }, [fetchBindings]);

  const handleInitAll = async () => {
    setInitializing(true);
    try {
      const result = await departmentApi.initAll();
      message.success(`成功初始化 ${result.initialized} 个部门智能体`);
      fetchBindings();
    } catch {
      message.warning('后端未启动，使用本地配置');
      setData((prev) => prev.map((d) => ({ ...d, status: 'running' as const, agentId: `${d.agentKey}-001` })));
      message.success('已使用本地配置初始化 19 个部门智能体');
    }
    setInitializing(false);
  };

  const runningCount = data.filter((d) => d.status === 'running').length;
  const stoppedCount = data.filter((d) => d.status === 'stopped').length;
  const uninitCount = data.filter((d) => d.status === 'uninitialized').length;

  const columns: ColumnsType<DeptRow> = [
    {
      title: '优先级', dataIndex: 'priority', width: 120,
      render: (p: string) => (
        <Tag color={priorityColor[p]} style={{ fontWeight: 700 }}>{p} — {priorityLabel[p]?.split(' ')[1]}</Tag>
      ),
      sorter: (a, b) => ({ P0: 0, P1: 1, P2: 2, P3: 3 }[a.priority] ?? 4) - ({ P0: 0, P1: 1, P2: 2, P3: 3 }[b.priority] ?? 4),
      defaultSortOrder: 'ascend' as const,
    },
    {
      title: '部门', dataIndex: 'department', width: 200,
      render: (dept: string, record) => <Space><Text>{record.emoji}</Text><Text strong>{dept}</Text></Space>,
    },
    {
      title: '智能体', dataIndex: 'agentName', width: 160,
      render: (name: string) => <Text>{name}</Text>,
    },
    {
      title: '绑定技能', dataIndex: 'skills', width: 280,
      render: (skills: string[]) => (
        <Space size={[4, 4]} wrap>
          {skills.map((s) => <Tag key={s} color="blue" style={{ fontSize: 11 }}>{s.replace(/-/g, ' ')}</Tag>)}
        </Space>
      ),
    },
    {
      title: '模型', dataIndex: 'model', width: 140,
      render: (m: string) => <Tag color="purple">{m}</Tag>,
    },
    {
      title: '状态', dataIndex: 'status', width: 120,
      render: (s: string, record) => {
        const config: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
          running: { color: 'green', icon: <CheckCircleOutlined />, label: '运行中' },
          stopped: { color: 'orange', icon: <ExclamationCircleOutlined />, label: '已停止' },
          uninitialized: { color: 'default', icon: <ClockCircleOutlined />, label: '未初始化' },
        };
        const c = config[s] || config.uninitialized;
        return (
          <Tooltip title={record.agentId ? `ID: ${record.agentId}` : '点击上方按钮初始化'}>
            <Tag icon={c.icon} color={c.color}>{c.label}</Tag>
          </Tooltip>
        );
      },
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="部门智能体绑定"
        icon={<ThunderboltOutlined style={{ color: '#7C3AED' }} />}
        breadcrumbs={[{ title: '智能体管理', path: '/agents' }, { title: '部门绑定' }]}
      />
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card size="small"><Statistic title="已运行" value={runningCount} suffix={`/ ${data.length}`} valueStyle={{ color: '#10B981' }} prefix={<CheckCircleOutlined />} /></Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small"><Statistic title="未初始化" value={uninitCount} valueStyle={{ color: uninitCount > 0 ? '#F59E0B' : '#6B7280' }} prefix={<ClockCircleOutlined />} /></Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small"><Statistic title="已停止" value={stoppedCount} valueStyle={{ color: '#EF4444' }} prefix={<ExclamationCircleOutlined />} /></Card>
        </Col>
      </Row>
      <Card size="small">
        <Space>
          <Button type="primary" icon={<ThunderboltOutlined />} onClick={handleInitAll} loading={initializing} disabled={runningCount === data.length}>
            一键初始化全部19部门
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchBindings} loading={loading}>刷新</Button>
        </Space>
      </Card>
      <Card>
        <Table<DeptRow> columns={columns} dataSource={data} rowKey="department" loading={loading} pagination={false} size="middle" scroll={{ x: 1100 }} />
      </Card>
      <Card size="small">
        <Space size={24}>
          {Object.entries(priorityLabel).map(([key, label]) => (
            <Space key={key} size={4}>
              <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, backgroundColor: priorityColor[key] }} />
              <Text type="secondary" style={{ fontSize: 12 }}>{label}</Text>
            </Space>
          ))}
        </Space>
      </Card>
    </div>
  );
};

export default DepartmentsPage;
