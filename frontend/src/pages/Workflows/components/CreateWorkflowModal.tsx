/**
 * 创建工作流弹窗
 */
import React, { useState } from 'react';
import { Modal, Form, Input, InputNumber, Button, Space, Card, Select } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import type { WorkflowCreateRequest, WorkflowNodeDefinition, WorkflowEdgeDefinition } from '@/services/types';

interface CreateWorkflowModalProps {
  open: boolean;
  onCancel: () => void;
  onOk: (values: WorkflowCreateRequest) => Promise<void>;
  loading: boolean;
}

const nodeTypeOptions = [
  { value: 'action', label: '动作节点' },
  { value: 'decision', label: '决策节点' },
  { value: 'subflow', label: '子流程节点' },
];

const CreateWorkflowModal: React.FC<CreateWorkflowModalProps> = ({ open, onCancel, onOk, loading }) => {
  const [form] = Form.useForm();
  const [nodes, setNodes] = useState<WorkflowNodeDefinition[]>([
    { name: '', node_type: 'action', config: {} },
  ]);
  const [edges, setEdges] = useState<WorkflowEdgeDefinition[]>([]);

  const addNode = () => {
    setNodes([...nodes, { name: '', node_type: 'action', config: {} }]);
  };

  const removeNode = (idx: number) => {
    setNodes(nodes.filter((_, i) => i !== idx));
  };

  const updateNode = (idx: number, field: keyof WorkflowNodeDefinition, value: string) => {
    const updated = [...nodes];
    updated[idx] = { ...updated[idx], [field]: value };
    setNodes(updated);
  };

  const addEdge = () => {
    setEdges([...edges, { source: '', target: '', condition: null }]);
  };

  const removeEdge = (idx: number) => {
    setEdges(edges.filter((_, i) => i !== idx));
  };

  const updateEdge = (idx: number, field: keyof WorkflowEdgeDefinition, value: string | null) => {
    const updated = [...edges];
    updated[idx] = { ...updated[idx], [field]: value };
    setEdges(updated);
  };

  const handleOk = async () => {
    const values = await form.validateFields();

    // 过滤掉空节点
    const validNodes = nodes.filter((n) => n.name.trim());
    const validEdges = edges.filter((e) => e.source.trim() && e.target.trim());

    if (validNodes.length === 0) {
      return;
    }

    await onOk({
      ...values,
      nodes: validNodes,
      edges: validEdges,
    });

    form.resetFields();
    setNodes([{ name: '', node_type: 'action', config: {} }]);
    setEdges([]);
  };

  const handleCancel = () => {
    form.resetFields();
    setNodes([{ name: '', node_type: 'action', config: {} }]);
    setEdges([]);
    onCancel();
  };

  return (
    <Modal
      title="创建工作流"
      open={open}
      onOk={handleOk}
      onCancel={handleCancel}
      confirmLoading={loading}
      width={700}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          max_iterations: 100,
          timeout_seconds: 3600,
        }}
      >
        <Form.Item
          name="name"
          label="工作流名称"
          rules={[{ required: true, message: '请输入工作流名称' }]}
        >
          <Input placeholder="例如：政务审批流" />
        </Form.Item>

        <Form.Item name="description" label="描述">
          <Input.TextArea rows={2} placeholder="工作流功能描述" />
        </Form.Item>

        <Form.Item name="max_iterations" label="最大迭代次数">
          <InputNumber min={1} max={1000} className="w-full" />
        </Form.Item>

        <Form.Item name="timeout_seconds" label="超时秒数">
          <InputNumber min={10} max={86400} className="w-full" />
        </Form.Item>
      </Form>

      {/* 节点配置 */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="font-medium">节点列表</span>
          <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={addNode}>
            添加节点
          </Button>
        </div>
        {nodes.map((node, idx) => (
          <Card size="small" key={idx} className="mb-2">
            <Space className="w-full" style={{ display: 'flex' }}>
              <Input
                placeholder="节点名称"
                value={node.name}
                onChange={(e) => updateNode(idx, 'name', e.target.value)}
                style={{ width: 200 }}
              />
              <Select
                value={node.node_type}
                onChange={(v) => updateNode(idx, 'node_type', v)}
                options={nodeTypeOptions}
                style={{ width: 140 }}
              />
              {nodes.length > 1 && (
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => removeNode(idx)}
                />
              )}
            </Space>
          </Card>
        ))}
      </div>

      {/* 边配置 */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="font-medium">连接边</span>
          <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={addEdge}>
            添加边
          </Button>
        </div>
        {edges.map((edge, idx) => (
          <Card size="small" key={idx} className="mb-2">
            <Space style={{ display: 'flex' }} className="w-full">
              <Input
                placeholder="源节点"
                value={edge.source}
                onChange={(e) => updateEdge(idx, 'source', e.target.value)}
                style={{ width: 160 }}
              />
              <span>→</span>
              <Input
                placeholder="目标节点"
                value={edge.target}
                onChange={(e) => updateEdge(idx, 'target', e.target.value)}
                style={{ width: 160 }}
              />
              <Input
                placeholder="条件（可选）"
                value={edge.condition ?? ''}
                onChange={(e) => updateEdge(idx, 'condition', e.target.value || null)}
                style={{ width: 160 }}
              />
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() => removeEdge(idx)}
              />
            </Space>
          </Card>
        ))}
      </div>
    </Modal>
  );
};

export default CreateWorkflowModal;
