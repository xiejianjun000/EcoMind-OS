/**
 * AgentStatusBar — 智能体状态栏
 *
 * 在 Chat 页面顶部或 Monitor 页面展示所有 12 个 Agent 的实时状态。
 * 紧凑模式：一行彩色圆点 + 汇总统计
 * 展开模式：显示所有 Agent 的紧凑卡片列表
 */
import React, { useState } from 'react';
import { useAgentStatus } from '@/services/agentStatusService';
import type { AgentStatus } from './AgentStatusBadge';
import { AgentStatusDot, AgentStatusCard } from './AgentStatusBadge';

// ─── 状态配置 ─────────────────────────────────────────────────

const STATUS_BAR_CONFIG: Record<string, { color: string; label: string }> = {
  healthy:  { color: '#22c55e', label: '在线' },
  busy:     { color: '#f59e0b', label: '执行中' },
  degraded: { color: '#f97316', label: '降级' },
  down:     { color: '#ef4444', label: '离线' },
  starting: { color: '#6366f1', label: '启动中' },
};

// ─── 组件 ─────────────────────────────────────────────────────

export interface AgentStatusBarProps {
  /** 是否以紧凑一行显示 */
  compact?: boolean;
  /** 最大显示 agent 数（紧凑模式） */
  maxVisible?: number;
  /** 点击 agent 回调 */
  onAgentClick?: (agent: AgentStatus) => void;
  /** 自定义类名 */
  className?: string;
}

export const AgentStatusBar: React.FC<AgentStatusBarProps> = ({
  compact = true,
  maxVisible = 6,
  onAgentClick,
  className = '',
}) => {
  const { agents, summary, loading, error, lastUpdated, refresh } = useAgentStatus(15000);
  const [expanded, setExpanded] = useState(false);

  if (error && agents.length === 0) {
    return (
      <div
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 12px', borderRadius: 8,
          background: '#fef2f2', border: '1px solid #fecaca',
          fontSize: 12, color: '#dc2626',
        }}
        className={className}
      >
        <span>⚠ Agent 状态获取失败</span>
        <button
          onClick={refresh}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#dc2626', textDecoration: 'underline', fontSize: 11,
          }}
        >
          重试
        </button>
      </div>
    );
  }

  if (compact) {
    // 一行紧凑模式：彩色圆点 + 总计数
    const visibleAgents = agents.slice(0, maxVisible);
    const remaining = agents.length - maxVisible;

    return (
      <div
        className={className}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '4px 12px', borderRadius: 8,
          background: 'var(--color-bg-subtle, #f8fafc)', border: '1px solid var(--color-border, #e2e8f0)',
          fontSize: 12, cursor: 'pointer', userSelect: 'none',
          transition: 'background 0.15s',
        }}
        onClick={() => setExpanded(!expanded)}
        title="点击展开智能体状态详情"
      >
        {/* 加载动画 */}
        {loading && agents.length === 0 ? (
          <span style={{ color: '#9ca3af' }}>⏳ 加载中...</span>
        ) : (
          <>
            {/* 状态圆点 */}
            <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
              {visibleAgents.map((agent) => {
                const cfg = STATUS_BAR_CONFIG[agent.status] ?? STATUS_BAR_CONFIG.healthy;
                return (
                  <span
                    key={agent.agent_id}
                    title={`${agent.display_name}: ${cfg.label}`}
                    style={{
                      display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
                      backgroundColor: cfg.color,
                      boxShadow: agent.status === 'busy' || agent.status === 'degraded'
                        ? `0 0 4px ${cfg.color}` : undefined,
                    }}
                  />
                );
              })}
              {remaining > 0 && (
                <span style={{ color: '#9ca3af', fontSize: 10, marginLeft: 2 }}>
                  +{remaining}
                </span>
              )}
            </div>

            {/* 统计摘要 */}
            <span style={{ color: '#64748b', whiteSpace: 'nowrap' }}>
              <span style={{ color: '#22c55e', fontWeight: 600 }}>{summary.healthy}</span>
              <span style={{ color: '#94a3b8' }}>/</span>
              <span style={{ color: '#6b7280', fontWeight: 600 }}>{summary.total}</span>
              <span style={{ color: '#94a3b8', marginLeft: 4 }}>在线</span>
            </span>

            {/* 任务统计 */}
            <span style={{ color: '#94a3b8', whiteSpace: 'nowrap' }}>
              ✅ {summary.total_tasks_completed}
            </span>

            {/* 展开箭头 */}
            <span style={{ color: '#94a3b8', fontSize: 10 }}>
              {expanded ? '▲' : '▼'}
            </span>
          </>
        )}
      </div>
    );
  }

  // 非紧凑：完整列表（用于 Monitor 页面）
  return (
    <div className={className}>
      <AgentSummaryInline
        summary={summary}
        agents={agents}
        loading={loading}
        expanded={expanded}
        onToggle={() => setExpanded(!expanded)}
        onAgentClick={onAgentClick}
        onRefresh={refresh}
      />
    </div>
  );
};

// ─── 内联汇总（非紧凑模式）─────────────────────────────────────

const AgentSummaryInline: React.FC<{
  summary: AgentStatusBarProps extends { summary: any } ? any : any;
  agents: AgentStatus[];
  loading: boolean;
  expanded: boolean;
  onToggle: () => void;
  onAgentClick?: (agent: AgentStatus) => void;
  onRefresh: () => void;
}> = ({ summary, agents, loading, expanded, onToggle, onAgentClick, onRefresh }) => {
  return (
    <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
      {/* 头部 */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px', cursor: 'pointer', userSelect: 'none',
          background: '#f8fafc', borderBottom: expanded ? '1px solid #e5e7eb' : 'none',
        }}
        onClick={onToggle}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>🤖 智能体状态</span>
          <div style={{ display: 'flex', gap: 10, fontSize: 12 }}>
            <StatBadge color="#22c55e" label="在线" value={summary.healthy} />
            <StatBadge color="#f59e0b" label="执行中" value={summary.busy} />
            <StatBadge color="#f97316" label="降级" value={summary.degraded} />
            <StatBadge color="#ef4444" label="离线" value={summary.down} />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#9ca3af' }}>
          {loading && <span>⏳ 刷新中...</span>}
          <span>✅ {summary.total_tasks_completed} 任务</span>
          <span style={{ fontSize: 10 }}>{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* 展开的 Agent 列表 */}
      {expanded && (
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 400, overflow: 'auto' }}>
          {agents.map((agent) => (
            <div key={agent.agent_id} onClick={() => onAgentClick?.(agent)}>
              <AgentStatusCard agent={agent} compact />
            </div>
          ))}
          {agents.length === 0 && !loading && (
            <div style={{ textAlign: 'center', padding: 16, color: '#9ca3af', fontSize: 13 }}>
              暂无 Agent 数据
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── 小工具 ───────────────────────────────────────────────────

const StatBadge: React.FC<{ color: string; label: string; value: number }> = ({ color, label, value }) => (
  <span style={{ color, whiteSpace: 'nowrap' }}>
    <span style={{ fontWeight: 600 }}>{value}</span>
    <span style={{ marginLeft: 2, opacity: 0.7 }}>{label}</span>
  </span>
);

export { useAgentStatus };
