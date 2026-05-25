/**
 * 工作流详情弹窗
 */
import React from 'react';
import { Modal, Descriptions, Tag, Timeline, Typography, Empty } from 'antd';
import type { WorkflowResponse } from '@/services/types';

const { Paragraph } = Typography;

interface WorkflowDetailModalProps {
  open: boolean;
  workflow: WorkflowResponse | null;
  onCancel: () => void;
}

const statusColorMap: Record<string, string> = {
  pending: 'blue',
  running: 'green',
  paused: 'orange',
  completed: 'green',
  failed: 'red',
  cancelled: 'orange',
};

const WorkflowDetailModal: React.FC<WorkflowDetailModalProps> = ({ open, workflow, onCancel }) => {
  if (!workflow) return null;

  return (
    <Modal
      title={`工作流详情：${workflow.name}`}
      open={open}
      onCancel={onCancel}
      footer={null}
      width={700}
    >
      <Descriptions column={2} bordered size="small" className="mb-4">
        <Descriptions.Item label="ID">{workflow.workflow_id}</Descriptions.Item>
        <Descriptions.Item label="状态">
          <Tag color={statusColorMap[workflow.status] ?? 'default'}>{workflow.status}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="描述" span={2}>
          {workflow.description || '—'}
        </Descriptions.Item>
        <Descriptions.Item label="节点数">{workflow.nodes.length}</Descriptions.Item>
        <Descriptions.Item label="边数">{workflow.edges.length}</Descriptions.Item>
        <Descriptions.Item label="当前节点">{workflow.current_node ?? '—'}</Descriptions.Item>
        <Descriptions.Item label="最大迭代">{workflow.max_iterations}</Descriptions.Item>
        <Descriptions.Item label="超时">{workflow.timeout_seconds}s</Descriptions.Item>
        <Descriptions.Item label="创建时间">
          {new Date(workflow.created_at).toLocaleString('zh-CN')}
        </Descriptions.Item>
        <Descriptions.Item label="更新时间">
          {new Date(workflow.updated_at).toLocaleString('zh-CN')}
        </Descriptions.Item>
      </Descriptions>

      {/* 节点列表 */}
      <div className="mb-4">
        <Paragraph strong>节点</Paragraph>
        {workflow.nodes.length === 0 ? (
          <Empty description="暂无节点" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <div className="flex flex-wrap gap-2">
            {workflow.nodes.map((node, idx) => (
              <Tag key={idx} color={node.node_type === 'decision' ? 'blue' : 'default'}>
                {node.name} ({node.node_type})
              </Tag>
            ))}
          </div>
        )}
      </div>

      {/* 执行历史 */}
      <div>
        <Paragraph strong>执行历史</Paragraph>
        {workflow.history.length === 0 ? (
          <Empty description="暂无执行历史" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <Timeline
            items={workflow.history.map((h, idx) => ({
              children: (
                <div className="text-sm">
                  <span className="font-medium">步骤 {idx + 1}</span>
                  <pre className="mt-1 text-xs bg-gray-50 p-2 rounded overflow-auto max-h-32">
                    {JSON.stringify(h, null, 2)}
                  </pre>
                </div>
              ),
            }))}
          />
        )}
      </div>

      {/* 错误信息 */}
      {workflow.errors.length > 0 && (
        <div className="mt-4">
          <Paragraph strong type="danger">
            错误信息
          </Paragraph>
          {workflow.errors.map((err, idx) => (
            <Tag key={idx} color="red">
              {err}
            </Tag>
          ))}
        </div>
      )}
    </Modal>
  );
};

export default WorkflowDetailModal;
