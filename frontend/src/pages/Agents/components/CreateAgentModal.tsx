/**
 * 创建 Agent 弹窗
 */
import React from 'react';
import { Modal, Form, Input, Select, InputNumber, Switch } from 'antd';
import type { AgentCreateRequest, AgentProvider } from '@/services/types';

interface CreateAgentModalProps {
  open: boolean;
  onCancel: () => void;
  onOk: (values: AgentCreateRequest) => Promise<void>;
  loading: boolean;
}

const providerOptions: Array<{ value: AgentProvider; label: string }> = [
  { value: 'qwen', label: 'Qwen (通义千问)' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'glm', label: 'GLM (智谱)' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'kimi', label: 'Kimi (月之暗面)' },
  { value: 'yi', label: 'Yi (零一万物)' },
];

const modelMap: Record<string, string[]> = {
  qwen: ['qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen3-72b', 'qwen3-14b'],
  deepseek: ['deepseek-chat', 'deepseek-reasoner', 'deepseek-671b'],
  glm: ['glm-4', 'glm-4-9b'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  anthropic: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
  kimi: ['moonshot-v1-8k', 'moonshot-v1-32k'],
  yi: ['yi-large', 'yi-medium', 'yi-spark'],
};

const CreateAgentModal: React.FC<CreateAgentModalProps> = ({ open, onCancel, onOk, loading }) => {
  const [form] = Form.useForm<AgentCreateRequest>();
  const selectedProvider = Form.useWatch('provider', form);

  const handleOk = async () => {
    const values = await form.validateFields();
    await onOk(values);
    form.resetFields();
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  return (
    <Modal
      title="创建 Agent"
      open={open}
      onOk={handleOk}
      onCancel={handleCancel}
      confirmLoading={loading}
      width={600}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          provider: 'qwen',
          model: 'qwen-max',
          soul: 'default',
          temperature: 0.7,
          max_tokens: 4096,
          max_iterations: 25,
          taiji_verify_enabled: true,
        }}
      >
        <Form.Item
          name="name"
          label="Agent 名称"
          rules={[{ required: true, message: '请输入 Agent 名称' }]}
        >
          <Input placeholder="例如：政务审批助手" />
        </Form.Item>

        <Form.Item name="description" label="描述">
          <Input.TextArea rows={2} placeholder="Agent 功能描述" />
        </Form.Item>

        <Form.Item name="provider" label="LLM 提供商" rules={[{ required: true }]}>
          <Select options={providerOptions} />
        </Form.Item>

        <Form.Item name="model" label="模型" rules={[{ required: true }]}>
          <Select>
            {(modelMap[selectedProvider ?? 'qwen'] ?? ['qwen-max']).map((m) => (
              <Select.Option key={m} value={m}>
                {m}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item name="soul" label="Soul 人格标识">
          <Input placeholder="default" />
        </Form.Item>

        <Form.Item name="temperature" label="生成温度">
          <InputNumber min={0} max={2} step={0.1} className="w-full" />
        </Form.Item>

        <Form.Item name="max_tokens" label="最大 Token 数">
          <InputNumber min={1} max={131072} className="w-full" />
        </Form.Item>

        <Form.Item name="taiji_verify_enabled" label="启用防幻觉验证" valuePropName="checked">
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CreateAgentModal;
