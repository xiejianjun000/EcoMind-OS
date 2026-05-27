import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Form, Input, Select, Button, Steps, message,
} from 'antd';
import {
  ArrowLeftOutlined, PlusOutlined, ThunderboltOutlined,
} from '@ant-design/icons';
import PageHeader from '@/components/PageHeader';
import { enforcementApi } from '@/services/api';
import type { EnforcementCaseCreateRequest, CaseSource, CaseSeverity } from '@/services/types';

const SOURCE_OPTIONS: { label: string; value: CaseSource }[] = [
  { label: '在线监测', value: '在线监测' },
  { label: '群众举报', value: '群众举报' },
  { label: '日常巡查', value: '日常巡查' },
  { label: '上级交办', value: '上级交办' },
  { label: '其他', value: '其他' },
];

const SEVERITY_OPTIONS: { label: string; value: CaseSeverity }[] = [
  { label: '高', value: '高' },
  { label: '中', value: '中' },
  { label: '低', value: '低' },
];

const CITY_OPTIONS = [
  '长沙市', '株洲市', '湘潭市', '衡阳市', '邵阳市',
  '岳阳市', '常德市', '张家界市', '益阳市', '郴州市',
  '永州市', '怀化市', '娄底市', '湘西州',
];

const EnforcementCreate: React.FC = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [current, setCurrent] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const steps = [
    { title: '基本信息' },
    { title: '违法事实' },
    { title: '提交立案' },
  ];

  const handleNext = async () => {
    try {
      await form.validateFields();
      setCurrent((prev) => Math.min(prev + 1, steps.length - 1));
    } catch {
      // 表单校验失败
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const data: EnforcementCaseCreateRequest = {
        title: values.title,
        source: values.source,
        severity: values.severity,
        enterprise_name: values.enterprise_name,
        credit_code: values.credit_code,
        legal_person: values.legal_person,
        violation: values.violation,
        city: values.city,
        officers: values.officers || [],
      };
      const result = await enforcementApi.createCase(data);
      message.success(`案件 ${result.case_number} 创建成功`);
      navigate(`/enforcement/${result.id}`);
    } catch (err: any) {
      message.error(err?.message || '创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="新建执法案件"
        icon={<ThunderboltOutlined style={{ color: '#DC2626' }} />}
        breadcrumbs={[
          { title: '业务工作台', path: '/enforcement' },
          { title: '新建案件' },
        ]}
        extra={
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/enforcement')}>
            返回列表
          </Button>
        }
      />

      <Card size="small">
        <Steps current={current} style={{ marginBottom: 24 }}>
          {steps.map((s) => (
            <Steps.Step key={s.title} title={s.title} />
          ))}
        </Steps>

        <Form form={form} layout="vertical" style={{ maxWidth: 600 }}>
          {current === 0 && (
            <>
              <Form.Item name="title" label="案件标题" rules={[{ required: true, message: '请输入案件标题' }]}>
                <Input placeholder="例：某化工企业超标排放废水案" />
              </Form.Item>
              <Form.Item name="enterprise_name" label="企业名称" rules={[{ required: true }]}>
                <Input placeholder="涉案企业全称" />
              </Form.Item>
              <Form.Item name="credit_code" label="统一社会信用代码">
                <Input placeholder="18位信用代码（选填）" maxLength={18} />
              </Form.Item>
              <Form.Item name="legal_person" label="法定代表人">
                <Input placeholder="法人代表姓名（选填）" />
              </Form.Item>
              <Form.Item name="city" label="所属城市" rules={[{ required: true }]}>
                <Select placeholder="选择城市" options={CITY_OPTIONS.map((c) => ({ label: c, value: c }))} />
              </Form.Item>
            </>
          )}

          {current === 1 && (
            <>
              <Form.Item name="source" label="案件来源" rules={[{ required: true }]}>
                <Select placeholder="选择案源" options={SOURCE_OPTIONS} />
              </Form.Item>
              <Form.Item name="severity" label="严重程度" rules={[{ required: true }]}>
                <Select placeholder="选择严重程度" options={SEVERITY_OPTIONS} />
              </Form.Item>
              <Form.Item name="violation" label="违法事实描述" rules={[{ required: true }]}>
                <Input.TextArea rows={4} placeholder="描述违法事实和证据线索" />
              </Form.Item>
              <Form.Item name="officers" label="承办人">
                <Select mode="tags" placeholder="输入承办人姓名后回车" />
              </Form.Item>
            </>
          )}

          {current === 2 && (
            <div style={{ padding: '32px 0', textAlign: 'center' }}>
              <p style={{ fontSize: 16, color: '#666' }}>确认案件信息无误后，点击「提交立案」创建案件</p>
              <p style={{ color: '#999' }}>案件创建后将进入「线索」阶段，可在详情页进行流转操作</p>
            </div>
          )}
        </Form>

        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center', gap: 12 }}>
          {current > 0 && (
            <Button onClick={() => setCurrent((prev) => prev - 1)}>上一步</Button>
          )}
          {current < steps.length - 1 && (
            <Button type="primary" onClick={handleNext}>下一步</Button>
          )}
          {current === steps.length - 1 && (
            <Button type="primary" danger icon={<PlusOutlined />} loading={submitting} onClick={handleSubmit}>
              提交立案
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
};

export default EnforcementCreate;
