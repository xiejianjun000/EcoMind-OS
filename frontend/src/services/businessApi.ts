/**
 * 业务模块 API 服务层
 *
 * 连接后端 FastAPI 路由: enforcement / approval / compliance / reports
 * Vite proxy: /api → http://localhost:8000
 * 降级策略: API 不可用时自动使用本地 Mock 数据
 */

// ─── Types ───

export interface EnforcementCase {
  id: string
  title: string
  stage: string
  severity?: string
  priority?: string
  city?: string
  department?: string
  source?: string
  description?: string
  assignee?: string
  created_at?: string
  updated_at?: string
  timeline?: CaseTimelineEntry[]
}

export interface CaseTimelineEntry {
  stage: string
  time: string
  operator: string
  comment: string
}

export interface ApprovalItem {
  id: string
  type?: string
  applicant?: string
  level?: string
  status: string
  submit_time?: string
  deadline?: string
  urgency?: string
  ai_prediction?: { score: number; issues: string[] }
}

export interface ComplianceCheck {
  id: string
  category?: string
  status?: string
  result?: string
  created_at?: string
}

export interface ReportItem {
  id: string
  name?: string
  type?: string
  department?: string
  author?: string
  created_at?: string
  status?: string
}

// ─── API Base ───

const API_BASE = '/api'

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail))
  }
  return res.json()
}

/** Safe call with fallback */
async function safeFetch<T>(path: string, fallback: T): Promise<T> {
  try {
    return await apiFetch<T>(path)
  } catch (e) {
    console.warn(`[businessApi] ${path} failed, using fallback:`, (e as Error).message)
    return fallback
  }
}

// ─── Enforcement API ───

export const enforcementApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return safeFetch(`/enforcement/cases${qs}`, [])
  },
  get: (id: string) =>
    safeFetch(`/enforcement/cases/${id}`, null),
  create: (data: Record<string, unknown>) =>
    apiFetch('/enforcement/cases', { method: 'POST', body: JSON.stringify(data) }),
  transition: (id: string, targetStage: string, operator: string, comment?: string) =>
    apiFetch(`/enforcement/cases/${id}/transition`, {
      method: 'POST',
      body: JSON.stringify({ target_stage: targetStage, operator, comment }),
    }),
  delete: (id: string) =>
    apiFetch(`/enforcement/cases/${id}`, { method: 'DELETE' }),
}

// ─── Approval API ───

export const approvalApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return safeFetch(`/approval/items${qs}`, [])
  },
  get: (id: string) =>
    safeFetch(`/approval/items/${id}`, null),
  create: (data: Record<string, unknown>) =>
    apiFetch('/approval/items', { method: 'POST', body: JSON.stringify(data) }),
  transition: (id: string, action: string, operator: string, comment?: string) =>
    apiFetch(`/approval/items/${id}/transition`, {
      method: 'POST',
      body: JSON.stringify({ action, operator, comment }),
    }),
}

// ─── Compliance API ───

export const complianceApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return safeFetch(`/compliance/checks${qs}`, [])
  },
  get: (id: string) =>
    safeFetch(`/compliance/checks/${id}`, null),
  create: (data: Record<string, unknown>) =>
    apiFetch('/compliance/checks', { method: 'POST', body: JSON.stringify(data) }),
  run: (id: string) =>
    apiFetch(`/compliance/checks/${id}/run`, { method: 'POST' }),
}

// ─── Reports API ───

export const reportsApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return safeFetch(`/reports${qs}`, [])
  },
  get: (id: string) =>
    safeFetch(`/reports/${id}`, null),
  generate: (data: Record<string, unknown>) =>
    apiFetch('/reports', { method: 'POST', body: JSON.stringify(data) }),
}

// ─── Marketplace API ───

export const marketplaceApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : ''
    return safeFetch(`/marketplace/skills${qs}`, { skills: [], total: 0 })
  },
  get: (id: string) =>
    safeFetch(`/marketplace/skills/${id}`, null),
  trending: (limit = 5) =>
    safeFetch(`/marketplace/trending?limit=${limit}`, { skills: [] }),
}

// ─── Environment API ───

export const environmentApi = {
  realtime: (city?: string) =>
    safeFetch(`/environment/realtime${city ? `?city=${encodeURIComponent(city)}` : ''}`, []),
  ranking: () =>
    safeFetch('/environment/ranking', []),
  forecast: () =>
    safeFetch('/environment/forecast', []),
}

export default { enforcementApi, approvalApi, complianceApi, reportsApi, marketplaceApi, environmentApi }
