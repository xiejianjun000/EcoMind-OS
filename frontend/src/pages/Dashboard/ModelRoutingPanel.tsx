import React from 'react';
import { Card, Progress, Tag, Typography, Row, Col } from 'antd';
import {
  ExperimentOutlined,
  CloudServerOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import type { ModelInfo } from './mockData';

interface ModelRoutingPanelProps {
  models: ModelInfo[];
}

/** Model type labels and colors */
const modelTypeConfig: Record<ModelInfo['type'], { label: string; color: string }> = {
  llm: { label: 'LLM', color: 'blue' },
  embedding: { label: 'Embedding', color: 'green' },
  rerank: { label: 'Reranker', color: 'orange' },
};

/** Model status color */
const modelStatusColor: Record<ModelInfo['status'], string> = {
  running: '#52c41a',
  idle: '#faad14',
  error: '#ff4d4f',
};

/** Model status label */
const modelStatusLabel: Record<ModelInfo['status'], string> = {
  running: '运行中',
  idle: '空闲',
  error: '异常',
};

/** Model Routing status panel */
const ModelRoutingPanel: React.FC<ModelRoutingPanelProps> = ({ models }) => {
  const avgGpu = Math.round(models.reduce((sum, m) => sum + m.gpuUsage, 0) / models.length);
  const totalQueue = models.reduce((sum, m) => sum + m.queueSize, 0);

  return (
    <Card
      title={
        <div className="flex items-center gap-2">
          <ExperimentOutlined />
          <span>模型路由状态</span>
        </div>
      }
      size="small"
    >
      {/* Summary bar */}
      <div className="flex items-center gap-4 mb-4 p-2 bg-gray-50 dark:bg-gray-800 rounded">
        <div className="flex items-center gap-1.5">
          <CloudServerOutlined />
          <span className="text-sm">模型数: <strong>{models.length}</strong></span>
        </div>
        <div className="flex items-center gap-1.5">
          <ThunderboltOutlined />
          <span className="text-sm">GPU 平均: <strong>{avgGpu}%</strong></span>
        </div>
        <div className="text-sm">队列: <strong>{totalQueue}</strong> 任务</div>
      </div>

      {/* Model list */}
      <Row gutter={[12, 12]}>
        {models.map((model) => {
          const typeConfig = modelTypeConfig[model.type];
          const gpuColor =
            model.gpuUsage > 80 ? '#ff4d4f' : model.gpuUsage > 50 ? '#faad14' : '#52c41a';

          return (
            <Col xs={24} sm={12} key={model.id}>
              <div className="p-3 border border-gray-100 dark:border-gray-800 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <Typography.Text strong className="text-sm">
                    {model.name}
                  </Typography.Text>
                  <div className="flex items-center gap-2">
                    <Tag color={typeConfig.color} className="text-xs">
                      {typeConfig.label}
                    </Tag>
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ backgroundColor: modelStatusColor[model.status] }}
                    />
                    <span className="text-xs text-gray-400">
                      {modelStatusLabel[model.status]}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Progress
                    percent={model.gpuUsage}
                    size="small"
                    strokeColor={gpuColor}
                    format={(percent) => (
                      <span className="text-xs">GPU {percent}%</span>
                    )}
                    className="flex-1 !mb-0"
                  />
                </div>

                {model.queueSize > 0 && (
                  <div className="mt-1 text-xs text-gray-400">
                    推理队列: {model.queueSize} 任务等待
                  </div>
                )}
              </div>
            </Col>
          );
        })}
      </Row>
    </Card>
  );
};

export default ModelRoutingPanel;
