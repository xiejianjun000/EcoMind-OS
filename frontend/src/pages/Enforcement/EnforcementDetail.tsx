import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Descriptions, Tag, Button, Select, Input, Space, Spin, message, Result,
} from 'antd';
import {
  ArrowLeftOutlined, SwapOutlined, ThunderboltOutlined,
} from '@ant-design/icons';
import PageHeader from '@/components/PageHeader';
import TimelineView from '@/components/TimelineView';
import { enforcementApi } from '@/services/api';
import type { EnforcementCase, CaseStage } from '@/services/types';

const STAGE_OPTIONS: { label: string; value: CaseStage }[] = [
  { label: '线索', value: '线索' },
  { label: '受理', value: '受理' },
  { label: '立案', value: '立案' },
  { label: '调查', value: '调查' },
  { label: '告知', value: '告知' },
  { label: '决定', value: '决定' },
  { label: '执行', value: '执行' },
  { label: '归档', value: '归档' },
];

const STAGE_COLOR: Record<CaseStage, string> = {
  '线索': 'default', '受理': 'lime', '立案': 'blue', '调查': 'processing',
  '告知': 'warning', '决定': 'orange', '执行': 'purple', '归档': 'success',
};

const EnforcementDetail: React.FC = () => {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [caseData, setCaseData] = useState<EnforcementCase | null>(null);
  const [targetStage, setTargetStage] = useState<CaseStage | undefined>();
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!caseId) return;
    (async () => {
      setLoading(true);
      try {
        const result = await enforcementApi.getCase(caseId);
        setCaseData(result);
      } catch {
        message.error('获取案件详情失败');
      } finally {
        setLoading(false);
      }
    })();
  }, [caseId]);

  const handleTransition = async () => {
    if (!targetStage || !caseId) return;
    setSubmitting(true);
    try {
      const updated = await enforcementApi.transitionCase(caseId, {
        target_stage: targetStage,
        comment,
        operator: '当前用户',
      });
      setCaseData(updated);
      setTargetStage(undefined);
      setComment('');
      message.success(`案件已流转至「${targetStage}」`);
    } catch (err: any) {
      message.error(err?.message || '流转失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (!caseData) return <Result status="404" title="案件不存在" extra={<Button onClick={() => navigate('/enforcement')}>返回列表</Button>} />;

  const timelineEvents = caseData.timeline?.map((t) => ({
    id: t.id,
    time: t.time,
    title: t.action || t.stage,
    description: t.comment || `${t.operator} · ${t.stage}`,
  })) || [];

  return (
    <div>
      <PageHeader
        title={`案件 ${caseData.case_number}`}
        icon={<ThunderboltOutlined style={{ color: '#DC2626' }} />}
        breadcrumbs={[
          { title: '业务工作台', path: '/enforcement' },
          { title: '案件详情' },
        ]}
        extra={
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/enforcement')}>
            返回列表
          </Button>
        }
      />

      <Card size="small" title="基本信息" style={{ marginBottom: 16 }}>
        <Descriptions column={2} size="small" bordered>
          <Descriptions.Item label="案件编号">{caseData.case_number}</Descriptions.Item>
          <Descriptions.Item label="案件标题">{caseData.title}</Descriptions.Item>
          <Descriptions.Item label="企业名称">{caseData.enterprise_name}</Descriptions.Item>
          <Descriptions.Item label="信用代码">{caseData.credit_code || '—'}</Descriptions.Item>
          <Descriptions.Item label="违法行为">{caseData.violation}</Descriptions.Item>
          <Descriptions.Item label="所属城市">{caseData.city}</Descriptions.Item>
          <Descriptions.Item label="当前阶段">
            <Tag color={STAGE_COLOR[caseData.stage]}>{caseData.stage}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="严重程度">
            <Tag color={caseData.severity === '高' ? 'red' : caseData.severity === '中' ? 'orange' : 'blue'}>
              {caseData.severity}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="承办人">{caseData.officers?.join('、') || '—'}</Descriptions.Item>
          <Descriptions.Item label="源">{caseData.source}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{new Date(caseData.created_at).toLocaleString('zh-CN')}</Descriptions.Item>
          <Descriptions.Item label="更新时间">{new Date(caseData.updated_at).toLocaleString('zh-CN')}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card size="small" title="阶段流转" style={{ marginBottom: 16 }}>
        <Space>
          <Select
            style={{ width: 160 }}
            placeholder="选择目标阶段"
            value={targetStage}
            onChange={setTargetStage}
            options={STAGE_OPTIONS.filter((o) => o.value !== caseData.stage)}
          />
          <Input.TextArea
            style={{ width: 300 }}
            rows={2}
            placeholder="审批意见（选填）"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <Button
            type="primary"
            icon={<SwapOutlined />}
            loading={submitting}
            disabled={!targetStage}
            onClick={handleTransition}
          >
            提交流转
          </Button>
        </Space>
      </Card>

      <Card size="small" title="案件时间线">
        {timelineEvents.length > 0 ? (
          <TimelineView events={timelineEvents} />
        ) : (
          <div style={{ color: '#999', textAlign: 'center', padding: 24 }}>暂无双办记录</div>
        )}
      </Card>
    </div>
  );
};

export default EnforcementDetail;
