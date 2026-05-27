import React from 'react';
import { Card, Table, Tag, Typography, Space, Button } from 'antd';
import { UserOutlined, PlusOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import PageHeader from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';

const { Text } = Typography;

const MOCK_USERS = [
  { id: 'U001', name: '张厅长', role: '系统管理员', dept: '厅领导', threeRoles: '系统管理员', status: 'online', lastLogin: '2026-05-26 14:30' },
  { id: 'U002', name: '李安全', role: '安全保密员', dept: '信息安全处', threeRoles: '安全保密员', status: 'online', lastLogin: '2026-05-26 13:15' },
  { id: 'U003', name: '王审计', role: '安全审计员', dept: '督察办', threeRoles: '安全审计员', status: 'online', lastLogin: '2026-05-26 12:00' },
  { id: 'U004', name: '赵执法', role: '执法人员', dept: '生态环境执法局', threeRoles: '—', status: 'online', lastLogin: '2026-05-26 14:00' },
  { id: 'U005', name: '钱监测', role: '监测人员', dept: '生态环境监测处', threeRoles: '—', status: 'offline', lastLogin: '2026-05-25 17:30' },
  { id: 'U006', name: '孙审批', role: '审批人员', dept: '环评与排放管理处', threeRoles: '—', status: 'online', lastLogin: '2026-05-26 10:00' },
];

const Users: React.FC = () => {
  return (
    <div>
      <PageHeader
        title="用户管理"
        icon={<UserOutlined style={{ color: '#0E7490' }} />}
        breadcrumbs={[{ title: '系统管理', path: '/' }, { title: '用户管理' }]}
        extra={<Button type="primary" icon={<PlusOutlined />}>添加用户</Button>}
      />

      <Card size="small" bodyStyle={{ padding: 0 }}>
        <Table
          dataSource={MOCK_USERS}
          rowKey="id"
          size="small"
          columns={[
            { title: '姓名', dataIndex: 'name', width: 100, render: (v: string) => <Text strong>{v}</Text> },
            { title: '角色', dataIndex: 'role', width: 120, render: (v: string) => <Tag color={v.includes('管理') ? 'red' : v.includes('安全') ? 'orange' : 'blue'}>{v}</Tag> },
            { title: '部门', dataIndex: 'dept', width: 160 },
            { title: '三员分立', dataIndex: 'threeRoles', width: 120, render: (v: string) => v !== '—' ? <Tag color="purple"><SafetyCertificateOutlined /> {v}</Tag> : <Text type="secondary">—</Text> },
            { title: '状态', dataIndex: 'status', width: 80, render: (v: string) => <StatusBadge status={v as 'online' | 'offline'} /> },
            { title: '最后登录', dataIndex: 'lastLogin', width: 160 },
            { title: '操作', width: 120, render: () => <Space size="small"><Button size="small" type="link">编辑</Button><Button size="small" type="link" danger>禁用</Button></Space> },
          ]}
        />
      </Card>
    </div>
  );
};

export default Users;
