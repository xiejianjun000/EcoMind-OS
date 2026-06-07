/**
 * Agent Status Service — 智能体状态轮询服务
 *
 * 定时从后端 GET /api/agents/status 拉取所有Agent状态，
 * 提供给前端组件使用。支持 React hook 和普通订阅模式。
 */
import { useState, useEffect, useCallback } from 'react';
import type {
  AgentStatus,
  AgentStatusSummary,
  AgentTask,
} from '@/components/AgentStatus/AgentStatusBadge';

// ─── 配置 ─────────────────────────────────────────────────────

const isDev = import.meta.env.DEV;
const API_BASE = isDev ? '' : import.meta.env.VITE_API_BASE || ''; // 生产环境可以用环境变量
const DEFAULT_POLL_INTERVAL_MS = 10_000; // 10秒轮询一次

// ─── 全局状态缓存 ─────────────────────────────────────────────

interface StatusCache {
  agents: AgentStatus[];
  summary: AgentStatusSummary;
  timestamp: number;
  loading: boolean;
  error: string | null;
}

let _cache: StatusCache = {
  agents: [],
  summary: { total: 0, healthy: 0, busy: 0, degraded: 0, down: 0, total_tasks_completed: 0, total_tasks_failed: 0 },
  timestamp: 0,
  loading: false,
  error: null,
};

type Listener = (cache: StatusCache) => void;
const _listeners: Set<Listener> = new Set();

let _pollTimer: ReturnType<typeof setInterval> | null = null;
let _pollingActive = false;

// ─── API 调用 ─────────────────────────────────────────────────

export async function fetchAgentStatus(): Promise<{ agents: AgentStatus[]; summary: AgentStatusSummary }> {
  const resp = await fetch(`${API_BASE}/api/agents/status`);
  if (!resp.ok) {
    throw new Error(`Heartbeat API error: ${resp.status} ${resp.statusText}`);
  }
  const data = await resp.json();
  return {
    agents: data.agents ?? [],
    summary: data.summary ?? { total: 0, healthy: 0, busy: 0, degraded: 0, down: 0, total_tasks_completed: 0, total_tasks_failed: 0 },
  };
}

export async function fetchSingleAgentStatus(agentId: string): Promise<AgentStatus> {
  const resp = await fetch(`${API_BASE}/api/agents/status/${agentId}`);
  if (!resp.ok) {
    throw new Error(`Agent status API error: ${resp.status}`);
  }
  return await resp.json();
}

// ─── 轮询 ─────────────────────────────────────────────────────

export function startPolling(intervalMs: number = DEFAULT_POLL_INTERVAL_MS): void {
  if (_pollingActive) return;
  _pollingActive = true;

  const poll = async () => {
    _cache = { ..._cache, loading: true };
    _notifyAll();
    try {
      const { agents, summary } = await fetchAgentStatus();
      _cache = { agents, summary, timestamp: Date.now(), loading: false, error: null };
    } catch (err: any) {
      _cache = { ..._cache, loading: false, error: err.message ?? 'Unknown error' };
    }
    _notifyAll();
  };

  // 立即拉取一次
  poll();

  // 定时轮询
  _pollTimer = setInterval(poll, intervalMs);
}

export function stopPolling(): void {
  _pollingActive = false;
  if (_pollTimer) {
    clearInterval(_pollTimer);
    _pollTimer = null;
  }
}

export function getCachedStatus(): StatusCache {
  return _cache;
}

// ─── 订阅 ─────────────────────────────────────────────────────

function _notifyAll() {
  _listeners.forEach((fn) => fn(_cache));
}

export function subscribe(listener: Listener): () => void {
  _listeners.add(listener);
  // 立即推送当前缓存
  listener(_cache);
  return () => {
    _listeners.delete(listener);
  };
}

// ─── React Hook ───────────────────────────────────────────────

export interface UseAgentStatusReturn {
  agents: AgentStatus[];
  summary: AgentStatusSummary;
  loading: boolean;
  error: string | null;
  lastUpdated: number;
  refresh: () => Promise<void>;
}

export function useAgentStatus(pollIntervalMs: number = DEFAULT_POLL_INTERVAL_MS): UseAgentStatusReturn {
  const [state, setState] = useState<StatusCache>(_cache);

  useEffect(() => {
    // 启动全局轮询（幂等）
    startPolling(pollIntervalMs);

    // 订阅缓存更新
    const unsub = subscribe(setState);

    return () => {
      unsub();
    };
  }, [pollIntervalMs]);

  const refresh = useCallback(async () => {
    try {
      const { agents, summary } = await fetchAgentStatus();
      _cache = { agents, summary, timestamp: Date.now(), loading: false, error: null };
      _notifyAll();
    } catch (err: any) {
      _cache = { ..._cache, error: err.message ?? 'Unknown error' };
      _notifyAll();
    }
  }, []);

  return {
    agents: state.agents,
    summary: state.summary,
    loading: state.loading,
    error: state.error,
    lastUpdated: state.timestamp,
    refresh,
  };
}

// ─── 便捷导出 ─────────────────────────────────────────────────

export type { AgentStatus, AgentStatusSummary, AgentTask };
