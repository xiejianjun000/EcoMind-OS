/**
 * 模型配置面板 — 浏览器端管理大模型 API Key
 *
 * 支持:
 *   - DeepSeek / 通义千问 / GLM 云端 API
 *   - Ollama 本地推理 (国产 CPU: 鲲鹏/飞腾/龙芯)
 *   - Key 热切换，保存即生效，无需重启
 */
import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Select, Switch, Button, Tag, Space, Typography, message, Alert, Descriptions, Divider } from 'antd';
import {
  CloudOutlined, DesktopOutlined, ApiOutlined, CheckCircleOutlined,
  CloseCircleOutlined, ThunderboltOutlined, KeyOutlined, SaveOutlined,
} from '@ant-design/icons';
import {
  getModelConfig, saveModelConfig, getActiveApiKey,
  hasRealModel, type ModelProviderConfig,
} from '@/services/modelConfig';

const { Title, Text, Paragraph } = Typography;

const ModelConfigTab: React.FC = () => {
  const [config, setConfig] = useState(() => getModelConfig());
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [form] = Form.useForm();

  const activeProvider = config.providers.find(p => p.id === config.activeProvider);

  useEffect(() => {
    const p = config.providers.find(p => p.id === config.activeProvider);
    if (p) {
      form.setFieldsValue({
        apiKey: p.apiKey,
        baseUrl: p.baseUrl,
        model: p.model,
        provider: config.activeProvider,
      });
    }
  }, [config.activeProvider, config.providers, form]);

  const handleProviderChange = (providerId: string) => {
    const updated = { ...config, activeProvider: providerId };
    setConfig(updated);
    saveModelConfig(updated);
    message.success(`已切换到 ${config.providers.find(p => p.id === providerId)?.name}`);
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    setSaving(true);

    const updated = { ...config };
    const provider = updated.providers.find(p => p.id === config.activeProvider);
    if (provider) {
      provider.apiKey = values.apiKey || '';
      provider.baseUrl = values.baseUrl || provider.baseUrl;
      provider.model = values.model || provider.model;
      provider.enabled = !!values.apiKey;
    }
    updated.providers = [...updated.providers];

    setConfig(updated);
    saveModelConfig(updated);
    setSaving(false);
    message.success('配置已保存，立即生效');
  };

  const handleTest = async () => {
    const key = getActiveApiKey();
    if (!key) {
      setTestResult({ ok: false, msg: '请先填写并保存 API Key' });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const isDev = import.meta.env.DEV;
      const baseUrl = activeProvider?.baseUrl || 'https://api.deepseek.com';
      const endpoint = isDev ? '/deepseek' : baseUrl;

      const response = await fetch(`${endpoint}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: activeProvider?.model || 'deepseek-chat',
          messages: [{ role: 'user', content: '你好，请用一句话介绍你自己。' }],
          max_tokens: 50,
          stream: false,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const reply = data.choices?.[0]?.message?.content || '';
        setTestResult({ ok: true, msg: `✅ 连接成功！模型回复: "${reply.slice(0, 80)}..."` });
      } else {
        const errData = await response.json().catch(() => ({}));
        const errMsg = (errData as any)?.error?.message || `HTTP ${response.status}`;
        setTestResult({ ok: false, msg: `❌ 连接失败: ${errMsg}` });
      }
    } catch (err: any) {
      setTestResult({ ok: false, msg: `❌ 网络错误: ${err.message}` });
    }
    setTesting(false);
  };

  const providerOptions = config.providers.map(p => ({
    value: p.id,
    label: (
      <Space>
        {p.type === 'local' ? <DesktopOutlined /> : <CloudOutlined />}
        {p.name}
        {p.enabled && <Tag color="green" style={{ fontSize: 10 }}>已配置</Tag>}
      </Space>
    ),
  }));

  return (
    <div className="space-y-4 max-w-3xl">
      {/* 当前状态 */}
      <Alert
        type={hasRealModel() ? 'success' : 'warning'}
        message={
          hasRealModel()
            ? `🟢 真实模型已连接 — ${activeProvider?.name} (${activeProvider?.model})`
            : '🟡 当前为 Mock 模拟模式 — 请配置 API Key 启用真实推理'
        }
        showIcon
      />

      {/* 模型选择 */}
      <Card size="small" title={<><ThunderboltOutlined /> 模型选择</>}>
        <Select
          value={config.activeProvider}
          onChange={handleProviderChange}
          options={providerOptions}
          style={{ width: '100%' }}
          size="large"
        />
      </Card>

      {/* API Key 配置 */}
      <Card size="small" title={<><KeyOutlined /> API 配置</>}>
        <Form form={form} layout="vertical">
          <Form.Item
            name="apiKey"
            label="API Key"
            extra="Key 保存在浏览器 localStorage，仅本地使用"
          >
            <Input.Password
              placeholder="粘贴你的 API Key..."
              size="large"
              prefix={<ApiOutlined />}
            />
          </Form.Item>

          <Form.Item name="baseUrl" label="API 地址">
            <Input placeholder="https://api.deepseek.com" />
          </Form.Item>

          <Form.Item name="model" label="模型">
            <Select
              options={
                config.activeProvider === 'deepseek'
                  ? [
                      { value: 'deepseek-chat', label: 'DeepSeek-V3 (通用对话)' },
                      { value: 'deepseek-reasoner', label: 'DeepSeek-R1 (深度推理)' },
                    ]
                  : config.activeProvider === 'qwen'
                  ? [
                      { value: 'qwen-max', label: 'Qwen-Max' },
                      { value: 'qwen-plus', label: 'Qwen-Plus' },
                      { value: 'qwen-turbo', label: 'Qwen-Turbo' },
                    ]
                  : config.activeProvider === 'glm'
                  ? [{ value: 'glm-4', label: 'GLM-4' }]
                  : config.activeProvider === 'local-ollama'
                  ? [
                      { value: 'qwen2.5:7b', label: 'Qwen2.5 7B (通用)' },
                      { value: 'qwen2.5:14b', label: 'Qwen2.5 14B' },
                      { value: 'qwen2.5:32b', label: 'Qwen2.5 32B' },
                      { value: 'deepseek-r1:7b', label: 'DeepSeek-R1 7B' },
                      { value: 'deepseek-r1:14b', label: 'DeepSeek-R1 14B' },
                    ]
                  : []
              }
            />
          </Form.Item>

          <Space>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving}>
              保存配置
            </Button>
            <Button icon={<ThunderboltOutlined />} onClick={handleTest} loading={testing}>
              测试连接
            </Button>
          </Space>
        </Form>

        {testResult && (
          <Alert
            type={testResult.ok ? 'success' : 'error'}
            message={testResult.msg}
            style={{ marginTop: 12 }}
            showIcon
          />
        )}
      </Card>

      {/* 国产 CPU 本地部署说明 */}
      <Card size="small" title={<><DesktopOutlined /> 国产 CPU 本地推理 (Ollama)</>}>
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="鲲鹏 920 (ARM64)">
            <Text code>curl -fsSL https://ollama.com/install.sh | sh</Text>
            <br />
            <Text code>ollama pull qwen2.5:14b</Text>
          </Descriptions.Item>
          <Descriptions.Item label="飞腾 S2500 (ARM64)">
            <Text code># 同上，ARM64 架构通用</Text>
          </Descriptions.Item>
          <Descriptions.Item label="龙芯 3A6000 (LoongArch)">
            <Text code># 需源码编译 Ollama，或使用 llama.cpp</Text>
            <br />
            <Text code>git clone https://github.com/ollama/ollama && cd ollama && go build .</Text>
          </Descriptions.Item>
          <Descriptions.Item label="Ollama 地址">
            默认 http://localhost:11434（选择「Ollama 本地推理」后自动使用）
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  );
};

export default ModelConfigTab;
