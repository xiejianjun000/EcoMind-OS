import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Table, Tag, Space, Input, Select, DatePicker, Button, message,
} from 'antd';
import {
  PlusOutlined, EyeOutlined, ThunderboltOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import PageHeader from '@/components/PageHeader';
import { enforcementApi } from '@/services/api';
import type { EnforcementCase, CaseStage, CaseSeverity } from '@/services/types';

const { RangePicker } = DatePicker;

const STAGE_OPTIONS: { label: string; value: CaseStage | '' }[] = [
  { label: '全部阶段', value: '' },
  { label: '线索', value: '线索' },
  { label: '受理', value: '受理' },
  { label: '立案', value: '立案' },
  { label: '调查', value: '调查' },
  { label: '告知', value: '告知' },
  { label: '决定', value: '决定' },
  { label: '执行', value: '执行' },
  { label: '归档', value: '归档' },
];

const SEVERITY_OPTIONS: { label: string; value: CaseSeverity | '' }[] = [
  { label: '全部严重程度', value: '' },
  { label: '高', value: '高' },
  { label: '中', value: '中' },
  { label: '低', value: '低' },
];

const CITY_OPTIONS: { label: string; value: string }[] = [
  { label: '全部城市', value: '' },
  { label: '长沙市', value: '长沙市' },
  { label: '株洲市', value: '株洲市' },
  { label: '湘潭市', value: '湘潭市' },
  { label: '衡阳市', value: '衡阳市' },
  { label: '邵阳市', value: '邵阳市' },
  { label: '岳阳市', value: '岳阳市' },
  { label: '常德市', value: '常德市' },
  { label: '张家界市', value: '张家界市' },
  { label: '益阳市', value: '益阳市' },
  { label: '郴州市', value: '郴州市' },
  { label: '永州市', value: '永州市' },
  { label: '怀化市', value: '怀化市' },
  { label: '娄底市', value: '娄底市' },
  { label: '湘西州', value: '湘西州' },
];

const STAGE_COLOR: Record<CaseStage, string> = {
  '线索': 'default',
  '受理': 'lime',
  '立案': 'blue',
  '调查': 'processing',
  '告知': 'warning',
  '决定': 'orange',
  '执行': 'purple',
  '归档': 'success',
};

const SEVERITY_COLOR: Record<CaseSeverity, string> = {
  '高': 'red',
  '中': 'orange',
  '低': 'blue',
};

const EnforcementList: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<EnforcementCase[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  const [filters, setFilters] = useState({
    stage: '' as CaseStage | '',
    severity: '' as CaseSeverity | '',
    city: '',
    keyword: '',
    dateRange: null as [string, string] | null,
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = {
        stage: filters.stage || undefined,
        severity: filters.severity || undefined,
        city: filters.city || undefined,
        keyword: filters.keyword || undefined,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      };
      const result = await enforcementApi.listCases(params as any);
      setData(result);
      setTotal(result.length);
    } catch {
      message.error('获取案件列表失败');
    } finally {
      setLoading(false);
    }
  }, [filters, page, pageSize]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearch = (value: string) => {
    setFilters((prev) => ({ ...prev, keyword: value }));
    setPage(1);
  };

  const columns: ColumnsType<EnforcementCase> = [
    {
      title: '案件编号',
      dataIndex: 'case_number',
      key: 'case_number',
      width: 160,
      ellipsis: true,
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: 220,
      ellipsis: true,
    },
    {
      title: '企业名称',
      dataIndex: 'enterprise_name',
      key: 'enterprise_name',
      width: 200,
      ellipsis: true,
    },
    {
      title: '当前阶段',
      dataIndex: 'stage',
      key: 'stage',
      width: 90,
      render: (v: CaseStage) => <Tag color={STAGE_COLOR[v]}>{v}</Tag>,
    },
    {
      title: '严重程度',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (v: CaseSeverity) => <Tag color={SEVERITY_COLOR[v]}>{v}</Tag>,
    },
    {
      title: '承办人',
      dataIndex: 'officers',
      key: 'officers',
      width: 120,
      ellipsis: true,
      render: (v: string[]) => (v && v.length > 0 ? v.join('、') : '—'),
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 170,
      render: (v: string) => v ? new Date(v).toLocaleString('zh-CN') : '—',
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      fixed: 'right',
      render: (_: unknown, record: EnforcementCase) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/enforcement/${record.id}`);
          }}
        >
          详情
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="执法案件列表"
        icon={<ThunderboltOutlined style={{ color: '#DC2626' }} />}
        breadcrumbs={[{ title: '业务工作台', path: '/enforcement' }, { title: '案件列表' }]}
        extra={
          <Button
            type="primary"
            danger
            icon={<PlusOutlined />}
            onClick={() => navigate('/enforcement/create')}
          >
            新建案件
          </Button>
        }
      />

      <Card size="small" bodyStyle={{ padding: '12px 0 0' }}>
        <div style={{ padding: '0 12px 12px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Select
            style={{ width: 130 }}
            value={filters.stage}
            onChange={(v) => { setFilters((prev) => ({ ...prev, stage: v })); setPage(1); }}
            options={STAGE_OPTIONS}
          />
          <Select
            style={{ width: 140 }}
            value={filters.severity}
            onChange={(v) => { setFilters((prev) => ({ ...prev, severity: v })); setPage(1); }}
            options={SEVERITY_OPTIONS}
          />
          <Select
            style={{ width: 130 }}
            value={filters.city}
            onChange={(v) => { setFilters((prev) => ({ ...prev, city: v })); setPage(1); }}
            options={CITY_OPTIONS}
          />
          <Input.Search
            placeholder="搜索案件编号/标题/企业名称"
            allowClear
            style={{ width: 280 }}
            onSearch={handleSearch}
          />
          <RangePicker
            style={{ width: 260 }}
            placeholder={['开始日期', '结束日期']}
            onChange={(_, dateStrings) => {
              setFilters((prev) => ({
                ...prev,
                dateRange: dateStrings[0] && dateStrings[1] ? [dateStrings[0], dateStrings[1]] : null,
              }));
              setPage(1);
            }}
          />
        </div>
        <Table
          dataSource={data}
          columns={columns}
          rowKey="id"
          size="small"
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: false,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p) => setPage(p),
          }}
          onRow={(record) => ({
            onClick: () => navigate(`/enforcement/${record.id}`),
            style: { cursor: 'pointer' },
          })}
        />
      </Card>
    </div>
  );
};

export default EnforcementList;
