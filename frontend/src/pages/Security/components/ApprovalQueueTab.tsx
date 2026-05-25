/**
 * 审批队列组件
 */
import React, { useEffect, useState } from 'react';
import { Table, Tag, Button, Space, Modal, Input, Card, Select, Typography, message } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { securityApi, safeCall } from '@/services/api';
import type { ApprovalResponse, ApprovalStatus, ApprovalActionRequest } from '@/services/types';

const { Text } = Typography;

const approvalStatusLabelMap: Record<ApprovalStatus, string> = {
  draft: '草稿',
  pending: '待审批',
  in_review: '审核中',
  approved: '已批准',
  rejected: '已驳回',
  returned: '已退回',
  cancelled: '已取消',
  completed: '已完成',
};

const approvalStatusColorMap: Record<ApprovalStatus, string> = {
  draft: 'default',
  pending: 'blue',
  in_review: 'orange',
  approved: 'green',
  rejected: 'red',
  returned: 'orange',
  cancelled: 'default',
  completed: 'green',
};

interface ApprovalQueueTabProps {
  refreshKey: number;
}

const ApprovalQueueTab: React.FC<ApprovalQueueTabProps> = ({ refreshKey }) => {
  const [approvals, setApprovals] = useState<ApprovalResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);
  const [actionModal, setActionModal] = useState<{
    open: boolean;
    approval: ApprovalResponse | null;
    isApprove: boolean;
  }>({ open: false, approval: null, isApprove: true });
  const [approverId, setApproverId] = useState('');
  const [comment, setComment] = useState('');
  const [actioning, setActioning] = useState(false);

  const fetchApprovals = async () => {
    setLoading(true);
    const result = await safeCall(() => securityApi.approvals({ status: filterStatus }));
    if (result) {
      setApprovals(result.approvals);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchApprovals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, filterStatus]);

  /** 处理审批操作 */
  const handleAction = async () => {
    if (!actionModal.approval || !approverId.trim()) {
      message.warning('请输入审批人标识');
      return;
    }

    const body: ApprovalActionRequest = {
      approver_id: approverId.trim(),
      comment: comment.trim(),
    };

    setActioning(true);
    const result = actionModal.isApprove
      ? await safeCall(() => securityApi.approve(actionModal.approval!.approval_id, body))
      : await safeCall(() => securityApi.reject(actionModal.approval!.approval_id, body));

    if (result) {
      message.success(actionModal.isApprove ? '审批已通过' : '审批已驳回');
      setActionModal({ open: false, approval: null, isApprove: true });
      setApproverId('');
      setComment('');
      fetchApprovals();
    }
    setActioning(false);
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'approval_id',
      key: 'approval_id',
      width: 120,
      render: (text: string) => <Text copyable className="text-xs">{text.slice(0, 12)}</Text>,
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      width: 180,
    },
    {
      title: '申请人',
      dataIndex: 'requester',
      key: 'requester',
      width: 120,
    },
    {
      title: '部门',
      dataIndex: 'department',
      key: 'department',
      width: 120,
      render: (text: string) => text || '—',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: ApprovalStatus) => (
        <Tag color={approvalStatusColorMap[status]}>
          {approvalStatusLabelMap[status]}
        </Tag>
      ),
    },
    {
      title: '当前步骤',
      key: 'current_step',
      width: 90,
      align: 'center' as const,
      render: (_: unknown, record: ApprovalResponse) =>
        `${record.current_step + 1}/${record.steps.length}`,
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
      width: 160,
      fixed: 'right' as const,
      render: (_: unknown, record: ApprovalResponse) => {
        const canAction =
          record.status === 'pending' || record.status === 'in_review';
        return (
          <Space size="small">
            {canAction && (
              <>
                <Button
                  type="link"
                  size="small"
                  icon={<CheckCircleOutlined />}
                  style={{ color: '#52c41a' }}
                  onClick={() =>
                    setActionModal({ open: true, approval: record, isApprove: true })
                  }
                >
                  批准
                </Button>
                <Button
                  type="link"
                  size="small"
                  danger
                  icon={<CloseCircleOutlined />}
                  onClick={() =>
                    setActionModal({ open: true, approval: record, isApprove: false })
                  }
                >
                  驳回
                </Button>
              </>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      <Card size="small" className="mb-4">
        <Space>
          <span>按状态筛选：</span>
          <Select
            placeholder="全部状态"
            value={filterStatus}
            onChange={setFilterStatus}
            allowClear
            style={{ width: 140 }}
            options={Object.entries(approvalStatusLabelMap).map(([value, label]) => ({
              value,
              label,
            }))}
          />
        </Space>
      </Card>

      <Table
        dataSource={approvals}
        columns={columns}
        loading={loading}
        rowKey="approval_id"
        pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `共 ${total} 条` }}
        scroll={{ x: 1000 }}
        size="middle"
      />

      {/* 审批操作弹窗 */}
      <Modal
        title={actionModal.isApprove ? '审批通过' : '审批驳回'}
        open={actionModal.open}
        onOk={handleAction}
        onCancel={() => {
          setActionModal({ open: false, approval: null, isApprove: true });
          setApproverId('');
          setComment('');
        }}
        confirmLoading={actioning}
        okText={actionModal.isApprove ? '确认通过' : '确认驳回'}
      >
        <div className="space-y-4">
          <div>
            <Text strong>审批项：</Text>
            <Text>{actionModal.approval?.title}</Text>
          </div>
          <div>
            <Text strong>审批人标识：</Text>
            <Input
              value={approverId}
              onChange={(e) => setApproverId(e.target.value)}
              placeholder="输入您的审批人标识"
              className="mt-1"
            />
          </div>
          <div>
            <Text strong>审批意见：</Text>
            <Input.TextArea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="可选，输入审批意见"
              rows={3}
              className="mt-1"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ApprovalQueueTab;
