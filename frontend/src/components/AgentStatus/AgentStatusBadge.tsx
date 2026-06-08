/**
 * AgentStatusBadge — 智能体状态徽章
 *
 * 展示单个Agent的在线状态、当前任务、进度、能力标签。
 * 支持 compact（图标+Tooltip）和 full（卡片）两种模式。
 */
import React, { useState } from 'react';

// ─── 类型 ──────────────────────────────────────────────────────

export interface AgentTask {
  task_id: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  estimated_remaining_sec: number;
  tools_used: string[];
}

export interface AgentStatus {
  agent_id: string;
  display_name: string;
  category: string;
  safety_level: string;
  status: 'healthy' | 'busy' | 'degraded' | 'down' | 'starting';
  uptime_sec: number;
  last_heartbeat_sec_ago: number;
  current_task: AgentTask | null;
  task_history_count: number;
  total_completed: number;
  total_failed: number;
  capabilities: string[];
  tools_available: string[];
  version: string;
}

export interface AgentStatusSummary {
  total: number;
  healthy: number;
  busy: number;
  degraded: number;
  down: number;
  total_tasks_completed: number;
  total_tasks_failed: number;
}

// ─── 状态配置 ─────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { color: string; bg: string; pulse: boolean; label: string; icon: string }> = {
  healthy:   { color: '#22c55e', bg: '#f0fdf4', pulse: false, label: '在线',    icon: '●' },
  busy:      { color: '#f59e0b', bg: '#fffbeb', pulse: true,  label: '执行中',  icon: '◉' },
  degraded:  { color: '#f97316', bg: '#fff7ed', pulse: true,  label: '降级',    icon: '◐' },
  down:      { color: '#ef4444', bg: '#fef2f2', pulse: false, label: '离线',    icon: '○' },
  starting:  { color: '#6366f1', bg: '#eef2ff', pulse: true,  label: '启动中',  icon: '◎' },
};

const CATEGORY_LABELS: Record<string, string> = {
  general: '通用', monitoring: '监测', enforcement: '执法', eia: '环评',
  approval: '许可', biodiversity: '生物多样性', emission: '碳排', emergency: '应急',
  restoration: '修复', inspection: '督察', public: '公众', water: '水资源',
};

const SAFETY_COLORS: Record<string, string> = {
  L1: '#3b82f6', L2: '#f59e0b', L3: '#ef4444',
};

// ─── 工具函数 ─────────────────────────────────────────────────

function formatUptime(sec: number): string {
  if (sec < 60) return `${Math.floor(sec)}秒`;
  if (sec < 3600) return `${Math.floor(sec / 60)}分`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}时${Math.floor((sec % 3600) / 60)}分`;
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  return `${d}天${h}时`;
}

function formatHeartbeatAgo(sec: number): string {
  if (sec < 0) return '—';
  if (sec < 5) return '刚刚';
  if (sec < 60) return `${Math.floor(sec)}秒前`;
  if (sec < 3600) return `${Math.floor(sec / 60)}分钟前`;
  return `${Math.floor(sec / 3600)}小时前`;
}

// ─── 子组件 ───────────────────────────────────────────────────

/** 紧凑模式：状态圆点 + 名称 + Hover 弹出卡片 */
export const AgentStatusDot: React.FC<{ agent: AgentStatus; showLabel?: boolean }> = ({ agent, showLabel = true }) => {
  const [hovered, setHovered] = useState(false);
  const cfg = STATUS_CONFIG[agent.status] ?? STATUS_CONFIG.healthy;

  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'default' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span
        style={{
          display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
          backgroundColor: cfg.color,
          boxShadow: cfg.pulse ? `0 0 6px ${cfg.color}` : undefined,
          animation: cfg.pulse ? 'pulse 1.5s ease-in-out infinite' : undefined,
        }}
      />
      {showLabel && (
        <span style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>
          {agent.display_name}
        </span>
      )}
      {hovered && <AgentTooltip agent={agent} />}
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </span>
  );
};

/** Hover 弹出卡片 */
const AgentTooltip: React.FC<{ agent: AgentStatus }> = ({ agent }) => {
  const cfg = STATUS_CONFIG[agent.status] ?? STATUS_CONFIG.healthy;
  return (
    <div
      style={{
        position: 'absolute', top: 24, left: 0, zIndex: 1000,
        background: '#fff', borderRadius: 10, boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
        border: '1px solid #e5e7eb', padding: 14, minWidth: 240, fontSize: 13,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <strong>{agent.display_name}</strong>
        <span style={{ color: cfg.color, fontWeight: 600 }}>{cfg.label}</span>
      </div>
      <div style={{ color: '#6b7280', marginBottom: 4 }}>
        运行 {formatUptime(agent.uptime_sec)} · 心跳 {formatHeartbeatAgo(agent.last_heartbeat_sec_ago)}
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
        <Tag color={SAFETY_COLORS[agent.safety_level] ?? '#6b7280'}>
          {agent.safety_level}
        </Tag>
        <Tag color="#6b7280">{CATEGORY_LABELS[agent.category] ?? agent.category}</Tag>
      </div>
      {agent.current_task && (
        <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 8, marginTop: 6 }}>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>当前任务</div>
          <div style={{ fontWeight: 500 }}>{agent.current_task.description}</div>
          <ProgressBar progress={agent.current_task.progress} />
        </div>
      )}
      <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 6 }}>
        完成 {agent.total_completed} · 失败 {agent.total_failed}
      </div>
    </div>
  );
};

/** Tag 标签 */
const Tag: React.FC<{ color: string; children: React.ReactNode }> = ({ color, children }) => (
  <span
    style={{
      display: 'inline-block', padding: '1px 7px', borderRadius: 999,
      fontSize: 11, fontWeight: 600, color, backgroundColor: `${color}16`,
      border: `1px solid ${color}30`, margin: '1px',
    }}
  >
    {children}
  </span>
);

/** 进度条 */
const ProgressBar: React.FC<{ progress: number }> = ({ progress }) => {
  const pct = Math.min(100, Math.max(0, Math.round(progress * 100)));
  const color = pct < 30 ? '#f59e0b' : pct < 70 ? '#3b82f6' : '#22c55e';
  return (
    <div style={{ height: 4, background: '#f3f4f6', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
      <div
        style={{
          height: '100%', width: `${pct}%`, background: color,
          borderRadius: 2, transition: 'width 0.5s ease',
        }}
      />
    </div>
  );
};

// ─── 完整卡片模式 ──────────────────────────────────────────────

export const AgentStatusCard: React.FC<{ agent: AgentStatus; compact?: boolean }> = ({ agent, compact = false }) => {
  const cfg = STATUS_CONFIG[agent.status] ?? STATUS_CONFIG.healthy;

  if (compact) {
    return (
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
          background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb',
          transition: 'box-shadow 0.2s', cursor: 'pointer',
        }}
      >
        <span
          style={{
            width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
            backgroundColor: cfg.color,
            boxShadow: cfg.pulse ? `0 0 8px ${cfg.color}` : undefined,
            animation: cfg.pulse ? 'pulse 1.5s ease-in-out infinite' : undefined,
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{agent.display_name}</div>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>
            {agent.current_task
              ? `📋 ${agent.current_task.description}`
              : `空闲 · 完成 ${agent.total_completed} 任务`}
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: 12 }}>
          <div style={{ color: cfg.color, fontWeight: 600 }}>{cfg.label}</div>
          <div style={{ color: '#9ca3af' }}>v{agent.version}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb',
        padding: 18, transition: 'box-shadow 0.2s',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{agent.display_name}</div>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>{agent.agent_id}</div>
        </div>
        <span
          style={{
            padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
            color: cfg.color, backgroundColor: cfg.bg,
            border: `1px solid ${cfg.color}30`,
          }}
        >
          {cfg.icon} {cfg.label}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        <Tag color={SAFETY_COLORS[agent.safety_level] ?? '#6b7280'}>
          安全等级 {agent.safety_level}
        </Tag>
        <Tag color="#6b7280">{CATEGORY_LABELS[agent.category] ?? agent.category}</Tag>
        <Tag color="#8b5cf6">v{agent.version}</Tag>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 13, color: '#4b5563', marginBottom: 12 }}>
        <div>⏱ 运行 {formatUptime(agent.uptime_sec)}</div>
        <div>💓 {formatHeartbeatAgo(agent.last_heartbeat_sec_ago)}</div>
        <div>✅ 完成 {agent.total_completed}</div>
        <div>❌ 失败 {agent.total_failed}</div>
      </div>

      {agent.current_task && (
        <div style={{
          background: '#f8fafc', borderRadius: 8, padding: 12, marginBottom: 12,
          border: '1px solid #e2e8f0',
        }}>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>📋 当前任务</div>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>
            {agent.current_task.description}
          </div>
          <ProgressBar progress={agent.current_task.progress} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 4, color: '#9ca3af' }}>
            <span>{Math.round(agent.current_task.progress * 100)}%</span>
            <span>
              {agent.current_task.estimated_remaining_sec > 0
                ? `预计剩余 ${formatUptime(agent.current_task.estimated_remaining_sec)}`
                : ''}
            </span>
          </div>
          {agent.current_task.tools_used.length > 0 && (
            <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
              {agent.current_task.tools_used.map((t) => (
                <Tag key={t} color="#6366f1">🔧 {t}</Tag>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ fontSize: 12 }}>
        {agent.capabilities.length > 0 && (
          <div style={{ marginBottom: 6 }}>
            <span style={{ color: '#9ca3af' }}>能力：</span>
            {agent.capabilities.map((c, i) => (
              <Tag key={i} color="#06b6d4">{c}</Tag>
            ))}
          </div>
        )}
        {agent.tools_available.length > 0 && (
          <div>
            <span style={{ color: '#9ca3af' }}>工具：</span>
            {agent.tools_available.map((t, i) => (
              <Tag key={i} color="#8b5cf6">{t}</Tag>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── 汇总面板 ──────────────────────────────────────────────────

export const AgentSummaryPanel: React.FC<{
  summary: AgentStatusSummary;
  agents: AgentStatus[];
  onAgentClick?: (agent: AgentStatus) => void;
}> = ({ summary, agents, onAgentClick }) => {
  return (
    <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 16 }}>
        <StatBox label="总数" value={summary.total} color="#6b7280" />
        <StatBox label="在线" value={summary.healthy} color="#22c55e" />
        <StatBox label="执行中" value={summary.busy} color="#f59e0b" />
        <StatBox label="降级" value={summary.degraded} color="#f97316" />
        <StatBox label="离线" value={summary.down} color="#ef4444" />
      </div>

      <div style={{ display: 'flex', gap: 20, marginBottom: 14, fontSize: 13, color: '#6b7280' }}>
        <span>✅ 总完成任务：{summary.total_tasks_completed}</span>
        <span>❌ 总失败任务：{summary.total_tasks_failed}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {agents.map((agent) => (
          <div key={agent.agent_id} onClick={() => onAgentClick?.(agent)}>
            <AgentStatusCard agent={agent} compact />
          </div>
        ))}
      </div>
    </div>
  );
};

const StatBox: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div style={{ textAlign: 'center', padding: '8px 4px', background: `${color}10`, borderRadius: 10, border: `1px solid ${color}20` }}>
    <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
    <div style={{ fontSize: 11, color: '#6b7280' }}>{label}</div>
  </div>
);

export default AgentStatusCard;
