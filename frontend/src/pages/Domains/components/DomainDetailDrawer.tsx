/**
 * 业务域详情抽屉
 */
import React from 'react';
import { Drawer, Descriptions, Tag, Typography, Space } from 'antd';
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';

const { Paragraph, Title, Text } = Typography;

export interface DomainInfo {
  id: string;
  name: string;
  description: string;
  icon: string;
  coverage: 'full' | 'partial' | 'none';
  agentCount: number;
  workflowCount: number;
  knowledgeBases: string[];
  capabilities: string[];
  lastUpdated: string;
}

interface DomainDetailDrawerProps {
  open: boolean;
  domain: DomainInfo | null;
  onClose: () => void;
}

const coverageConfig = {
  full: { color: 'green', label: '✅ 完整覆盖', icon: <CheckCircleOutlined /> },
  partial: { color: 'orange', label: '🔶 部分覆盖', icon: <ExclamationCircleOutlined /> },
  none: { color: 'red', label: '❌ 未覆盖', icon: <CloseCircleOutlined /> },
};

const DomainDetailDrawer: React.FC<DomainDetailDrawerProps> = ({ open, domain, onClose }) => {
  if (!domain) return null;

  const coverage = coverageConfig[domain.coverage];

  return (
    <Drawer
      title={
        <Space>
          <span className="text-2xl">{domain.icon}</span>
          <span>{domain.name}</span>
        </Space>
      }
      open={open}
      onClose={onClose}
      width={520}
    >
      <div className="space-y-6">
        {/* 基本信息 */}
        <div>
          <Title level={5}>基本信息</Title>
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="业务域">{domain.name}</Descriptions.Item>
            <Descriptions.Item label="覆盖状态">
              <Tag color={coverage.color} icon={coverage.icon}>
                {coverage.label}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="描述">{domain.description}</Descriptions.Item>
            <Descriptions.Item label="Agent 数量">{domain.agentCount}</Descriptions.Item>
            <Descriptions.Item label="工作流数量">{domain.workflowCount}</Descriptions.Item>
            <Descriptions.Item label="最近更新">{domain.lastUpdated}</Descriptions.Item>
          </Descriptions>
        </div>

        {/* 知识库 */}
        <div>
          <Title level={5}>知识库</Title>
          {domain.knowledgeBases.length === 0 ? (
            <Text type="secondary">暂无知识库</Text>
          ) : (
            <div className="flex flex-wrap gap-2">
              {domain.knowledgeBases.map((kb, idx) => (
                <Tag key={idx} color="blue">
                  {kb}
                </Tag>
              ))}
            </div>
          )}
        </div>

        {/* 核心能力 */}
        <div>
          <Title level={5}>核心能力</Title>
          {domain.capabilities.length === 0 ? (
            <Text type="secondary">暂无能力定义</Text>
          ) : (
            <div className="flex flex-wrap gap-2">
              {domain.capabilities.map((cap, idx) => (
                <Tag key={idx} color="cyan">
                  {cap}
                </Tag>
              ))}
            </div>
          )}
        </div>
      </div>
    </Drawer>
  );
};

export default DomainDetailDrawer;
