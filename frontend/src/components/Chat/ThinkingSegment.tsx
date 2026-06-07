/**
 * Thinking Segment 思考链可视化 — v7.0
 * 灵感来源: QClaw RenderThinkingSegment
 * 可折叠的 AI 推理过程展示
 */
import React, { useState } from 'react';
import { Collapse, Badge } from 'antd';
import { BulbOutlined, CaretRightOutlined } from '@ant-design/icons';

interface Props {
  thinking: string;
  isStreaming?: boolean;
  className?: string;
}

const ThinkingSegment: React.FC<Props> = ({ thinking, isStreaming, className = '' }) => {
  const [expanded, setExpanded] = useState(false);

  if (!thinking && !isStreaming) return null;

  const content = thinking || '正在思考中...';

  return (
    <div className={`thinking-segment my-2 ${className}`}>
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors"
        style={{ background: 'linear-gradient(135deg, #f6ffed, #e6f7ff)', border: '1px solid #d9f7be' }}
        onClick={() => setExpanded(!expanded)}
      >
        <BulbOutlined style={{ color: '#faad14' }} />
        <span className="font-medium text-gray-700">AI 思考过程</span>
        {isStreaming && <Badge status="processing" text={<span className="text-xs text-gray-400">思考中...</span>} />}
        <CaretRightOutlined className={`ml-auto transition-transform text-xs ${expanded ? 'rotate-90' : ''}`} />
      </div>
      {expanded && (
        <div className="mt-1 px-4 py-3 rounded-lg text-sm text-gray-600 leading-relaxed whitespace-pre-wrap" style={{ background: '#fafafa', border: '1px solid #f0f0f0' }}>
          {content}
        </div>
      )}
    </div>
  );
};

export default ThinkingSegment;
