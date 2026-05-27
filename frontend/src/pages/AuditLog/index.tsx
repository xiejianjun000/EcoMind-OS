import React, { useState } from 'react';
import { Card, Table, Tag, Typography, Space, Input, DatePicker, Button, Select, Drawer } from 'antd';
import { SearchOutlined, ExportOutlined, SecurityScanOutlined } from '@ant-design/icons';
import PageHeader from '@/components/PageHeader';

const { Text } = Typography;
const { RangePicker } = DatePicker;

interface AuditEntry {
  id: string;
  timestamp: string;
  operator: string;
  action: string;
  detail: string;
  ip: string;
  result: 'success' | 'failure' | 'warning';
  level: string;
}

const MOCK_AUDIT: AuditEntry[] = [
  { id: '1', timestamp: '2026-05-26 14:35:22', operator: '张执法', action: '查看案件详情', detail: '查看 HN-ENF-2026-001', ip: '192.168.1.100', result: 'success', level: 'L1' },
  { id: '2', timestamp: '2026-05-26 14:30:15', operator: '李审批', action: '审批通过', detail: 'AP-2026-003 辐射安全许可', ip: '192.168.1.101', result: 'success', level: 'L2' },
  { id: '3', timestamp: '2026-05-26 14:28:09', operator: '王安全', action: '异常检测', detail: 'VERIFY拦截幻觉输出 置信度0.38', ip: '10.0.0.1', result: 'warning', level: 'L4' },
  { id: '4', timestamp: '2026-05-26 14:22:03', operator: 'admin', action: '模型切换', detail: 'DeepSeek → Qwen-Max (自动降级)', ip: '10.0.0.5', result: 'success', level: 'L1' },
  { id: '5', timestamp: '2026-05-26 14:15:40', operator: '赵监测', action: '数据查询', detail: '导出长沙PM2.5 24h趋势', ip: '192.168.2.50', result: 'success', level: 'L1' },
  { id: '6', timestamp: '2026-05-26 14:08:12', operator: '外部用户', action: '登录失败', detail: '连续3次密码错误（账户锁定15分钟）', ip: '61.157.xxx.xxx', result: 'failure', level: 'L1' },
  { id: '7', timestamp: '2026-05-26 13:55:30', operator: '陈督察', action: '生成督察报告', detail: '生成 2026年5月督察月报', ip: '192.168.1.55', result: 'success', level: 'L1' },
  { id: '8', timestamp: '2026-05-26 13:42:18', operator: '李审批', action: '驳回审批', detail: 'AP-2026-005 材料不齐全', ip: '192.168.1.101', result: 'success', level: 'L2' },
];

const AuditLog: React.FC = () => {
  const [selected, setSelected] = useState<AuditEntry | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const columns = [
    { title: '时间', dataIndex: 'timestamp', key: 'timestamp', width: 170 },
    { title: '操作人', dataIndex: 'operator', key: 'operator', width: 90 },
    { title: '操作', dataIndex: 'action', key: 'action', width: 120, render: (v: string) => <Text strong>{v}</Text> },
    { title: '详情', dataIndex: 'detail', key: 'detail', ellipsis: true },
    { title: '安全层', dataIndex: 'level', key: 'level', width: 60, render: (v: string) => <Tag color={v === 'L4' ? 'red' : 'blue'}>{v}</Tag> },
    { title: '结果', dataIndex: 'result', key: 'result', width: 70,
      render: (v: string) => <Tag color={v === 'success' ? 'green' : v === 'warning' ? 'orange' : 'red'}>{v}</Tag> },
  ];

  const showDetail = (entry: AuditEntry) => {
    setSelected(entry);
    setDrawerOpen(true);
  };

  return (
    <div>
      <PageHeader
        title="审计日志"
        icon={<SecurityScanOutlined style={{ color: '#0E7490' }} />}
        breadcrumbs={[{ title: '安全治理', path: '/' }, { title: '审计日志' }]}
        extra={
          <Space>
            <Button icon={<ExportOutlined />}>导出CSV</Button>
            <Button icon={<ExportOutlined />}>导出PDF</Button>
          </Space>
        }
      />

      <Card size="small" bodyStyle={{ padding: '12px 0 0' }}>
        <div style={{ padding: '0 12px 12px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Input prefix={<SearchOutlined />} placeholder="搜索操作/详情..." style={{ width: 240 }} allowClear />
          <RangePicker style={{ width: 240 }} placeholder={['开始时间', '结束时间']} />
          <Select defaultValue="all" style={{ width: 120 }}>
            <Select.Option value="all">全部操作</Select.Option>
            <Select.Option value="login">登录</Select.Option>
            <Select.Option value="data">数据操作</Select.Option>
            <Select.Option value="approval">审批</Select.Option>
            <Select.Option value="security">安全事件</Select.Option>
          </Select>
          <Select defaultValue="all" style={{ width: 120 }}>
            <Select.Option value="all">全部分层</Select.Option>
            <Select.Option value="L1">L1输入护栏</Select.Option>
            <Select.Option value="L2">L2策略护栏</Select.Option>
            <Select.Option value="L3">L3输出验证</Select.Option>
            <Select.Option value="L4">L4幻觉检测</Select.Option>
            <Select.Option value="L5">L5审计追踪</Select.Option>
          </Select>
        </div>
        <Table
          dataSource={MOCK_AUDIT}
          columns={columns}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条记录` }}
          onRow={(r) => ({ onClick: () => showDetail(r), style: { cursor: 'pointer' } })}
        />
      </Card>

      <Drawer
        title="审计详情"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={500}
      >
        {selected && (
          <div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                {[
                  ['日志ID', selected.id],
                  ['时间戳', selected.timestamp],
                  ['操作人', selected.operator],
                  ['IP地址', selected.ip],
                  ['操作类型', selected.action],
                  ['安全层级', selected.level],
                  ['执行结果', selected.result],
                  ['操作详情', selected.detail],
                ].map(([label, value], i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 500, color: '#6B7280', width: 100 }}>{label}</td>
                    <td style={{ padding: '8px 12px' }}>
                      {label === '执行结果' ? (
                        <Tag color={value === 'success' ? 'green' : value === 'warning' ? 'orange' : 'red'}>{value}</Tag>
                      ) : (
                        <Text>{value}</Text>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: 16, padding: 12, background: '#f5f5f5', borderRadius: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>请求原始数据 (JSON):</Text>
              <pre style={{ fontSize: 11, marginTop: 4, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
{JSON.stringify({ action: selected.action, detail: selected.detail, ip: selected.ip, safetyChain: selected.level, timestamp: selected.timestamp }, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default AuditLog;
