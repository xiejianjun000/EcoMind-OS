/**
 * Mermaid 图表渲染器 — v7.0
 * 灵感来源: WorkBuddy Mermaid 渲染
 * 支持: 流程图、时序图、甘特图、类图、状态图、饼图
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Button, message } from 'antd';
import { CopyOutlined, ExpandOutlined, CompressOutlined, ReloadOutlined } from '@ant-design/icons';

interface Props {
  chart: string;
  className?: string;
}

let mermaidInitialized = false;

async function ensureMermaid() {
  if (mermaidInitialized) return (window as any).mermaid;
  const mermaid = (await import('mermaid')).default;
  mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose', fontFamily: 'inherit' });
  mermaidInitialized = true;
  (window as any).mermaid = mermaid;
  return mermaid;
}

const MermaidRenderer: React.FC<Props> = ({ chart, className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const idRef = useRef(`mermaid-${Math.random().toString(36).slice(2, 9)}`);

  const renderChart = useCallback(async () => {
    if (!containerRef.current) return;
    setLoading(true); setError(null);
    try {
      const mermaid = await ensureMermaid();
      const { svg } = await mermaid.render(idRef.current, chart);
      containerRef.current.innerHTML = svg;
    } catch (e: any) {
      setError(e.message || '渲染失败');
      containerRef.current.innerHTML = '';
    } finally { setLoading(false); }
  }, [chart]);

  useEffect(() => { renderChart(); }, [renderChart]);

  const handleCopy = () => {
    navigator.clipboard.writeText(chart).then(() => message.success('已复制图表代码'));
  };

  return (
    <div className={`mermaid-block relative rounded-lg border my-3 ${className}`} style={{ background: '#fafafa' }}>
      <div className="flex items-center justify-between px-3 py-1.5 border-b" style={{ background: '#f0f0f0' }}>
        <span className="text-xs text-gray-500 font-medium">📊 Mermaid 图表</span>
        <div className="flex gap-1">
          <Button type="text" size="small" icon={<CopyOutlined />} onClick={handleCopy} />
          <Button type="text" size="small" icon={<ReloadOutlined />} onClick={renderChart} />
          <Button type="text" size="small" icon={expanded ? <CompressOutlined /> : <ExpandOutlined />} onClick={() => setExpanded(!expanded)} />
        </div>
      </div>
      <div className="p-4 flex justify-center overflow-auto" style={{ maxHeight: expanded ? 'none' : '500px' }}>
        {loading && <div className="text-gray-400 text-sm py-8">加载图表中...</div>}
        {error && <div className="text-red-500 text-sm py-4">图表渲染失败: {error}</div>}
        <div ref={containerRef} className="mermaid-svg-container" />
      </div>
    </div>
  );
};

export default MermaidRenderer;
