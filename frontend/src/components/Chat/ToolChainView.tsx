/**
 * ToolChain 工具链可视化 — v7.0
 * 灵感来源: WorkBuddy Tool Cards + QClaw RenderToolChainSegment
 * 展示 AI 调用的工具链步骤、输入输出、状态
 */
import React, { useState } from 'react';
import { Collapse, Tag, Progress, Badge } from 'antd';
import { ToolOutlined, CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined, CodeOutlined, FileTextOutlined, SearchOutlined, DatabaseOutlined, ApiOutlined, SafetyOutlined } from '@ant-design/icons';

export interface ToolStep {
  id: string;
  name: string;
  icon?: string;
  status: 'running' | 'completed' | 'failed' | 'pending';
  input?: string;
  output?: string;
  explanation?: string;
  duration?: number;
  progress?: number;
}

interface Props {
  steps: ToolStep[];
  className?: string;
}

const iconMap: Record<string, React.ReactNode> = {
  code: <CodeOutlined />,
  file: <FileTextOutlined />,
  search: <SearchOutlined />,
  database: <DatabaseOutlined />,
  api: <ApiOutlined />,
  safety: <SafetyOutlined />,
  tool: <ToolOutlined />,
};

const ToolChainView: React.FC<Props> = ({ steps, className = '' }) => {
  const [activeKeys, setActiveKeys] = useState<string[]>([]);

  if (!steps || steps.length === 0) return null;

  const statusIcon = (status: ToolStep['status']) => {
    switch (status) {
      case 'completed': return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'failed': return <CloseCircleOutlined style={{ color: '#f5222d' }} />;
      case 'running': return <LoadingOutlined style={{ color: '#1890ff' }} />;
      default: return <Badge status="default" />;
    }
  };

  const statusColor = (status: ToolStep['status']) => {
    switch (status) { case 'completed': return 'green'; case 'failed': return 'red'; case 'running': return 'blue'; default: return 'default'; }
  };

  const items = steps.map((step, i) => ({
    key: step.id,
    label: (
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-400 w-5">{i + 1}</span>
        <span>{iconMap[step.icon || 'tool'] || iconMap.tool}</span>
        <span className="font-medium text-sm">{step.name}</span>
        <Tag color={statusColor(step.status)} className="ml-auto text-xs">
          {step.status === 'running' ? '执行中' : step.status === 'completed' ? '已完成' : step.status === 'failed' ? '失败' : '等待中'}
        </Tag>
        {step.duration !== undefined && <span className="text-xs text-gray-400">{step.duration}ms</span>}
      </div>
    ),
    children: (
      <div className="space-y-2 pl-12 text-sm">
        {step.input && (
          <div>
            <div className="text-gray-500 mb-1">📥 输入:</div>
            <pre className="bg-gray-50 p-2 rounded text-xs overflow-auto max-h-24">{step.input}</pre>
          </div>
        )}
        {step.output && (
          <div>
            <div className="text-gray-500 mb-1">📤 输出:</div>
            <pre className="bg-gray-50 p-2 rounded text-xs overflow-auto max-h-40">{step.output}</pre>
          </div>
        )}
        {step.progress !== undefined && <Progress percent={step.progress} size="small" />}
        {step.explanation && <div className="text-gray-500 italic">💡 {step.explanation}</div>}
      </div>
    ),
  }));

  return (
    <div className={`tool-chain-view my-3 ${className}`}>
      <div className="flex items-center gap-2 px-3 py-2 border rounded-t-lg bg-gray-50">
        <ToolOutlined className="text-blue-500" />
        <span className="text-sm font-medium">工具调用链 ({steps.length} 步骤)</span>
        <Tag className="ml-auto">{steps.filter(s => s.status === 'completed').length}/{steps.length} 完成</Tag>
      </div>
      <Collapse
        activeKey={activeKeys}
        onChange={keys => setActiveKeys(keys as string[])}
        items={items}
        className="tool-chain-collapse"
        bordered={false}
        style={{ background: '#fff' }}
      />
    </div>
  );
};

export default ToolChainView;
