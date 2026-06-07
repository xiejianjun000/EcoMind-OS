/**
 * 日历 API 服务 — 环境监测任务调度 · 会议管理 · 执法排班
 *
 * 对接后端 /api/calendar 路由（calendar_service.py）
 */

import { safeCall } from './api'

export interface CalendarEvent {
  id: string
  title: string
  event_type: 'task' | 'meeting' | 'enforcement' | 'approval' | 'report'
  start_time: string
  end_time: string
  all_day: boolean
  description: string
  location: string
  assignee: string
  department: string
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  recurrence: string
  related_id: string
  tags: string[]
  created_at: string
  updated_at: string
}

export interface WorkdayResult {
  date?: string
  is_workday?: boolean
  weekday?: number
  weekday_name?: string
  error?: string
}

export interface WorkdayAddResult {
  start_date?: string
  days?: number
  result_date?: string
  weekday?: number
  error?: string
}

export interface WorkdayCountResult {
  start_date?: string
  end_date?: string
  workdays?: number
  total_days?: number
  error?: string
}

export interface EventStats {
  period: { start: string; end: string }
  total_events: number
  by_type: Record<string, number>
  by_status: Record<string, number>
  by_department: Record<string, number>
  by_priority: Record<string, number>
}

interface ApiResponse<T> {
  code: number
  data: T
  total?: number
  message?: string
}

const BASE = '/api/calendar'

async function request<T>(url: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const resp = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`HTTP ${resp.status}: ${text}`)
  }
  return resp.json()
}

export const calendarApi = {
  /** 查询日历事件，支持按日期范围/类型/部门/负责人/状态过滤 */
  listEvents: async (params?: {
    start_date?: string
    end_date?: string
    event_type?: string
    department?: string
    assignee?: string
    status?: string
  }): Promise<{ data: CalendarEvent[]; total: number }> => {
    const qs = new URLSearchParams()
    if (params?.start_date) qs.set('start_date', params.start_date)
    if (params?.end_date) qs.set('end_date', params.end_date)
    if (params?.event_type) qs.set('event_type', params.event_type)
    if (params?.department) qs.set('department', params.department)
    if (params?.assignee) qs.set('assignee', params.assignee)
    if (params?.status) qs.set('status', params.status)
    const query = qs.toString()
    const res = await safeCall(() => request<CalendarEvent[]>(`${BASE}/events${query ? `?${query}` : ''}`))
    return { data: res?.data ?? [], total: res?.total ?? 0 }
  },

  /** 获取单个事件详情 */
  getEvent: async (eventId: string): Promise<CalendarEvent | null> => {
    const res = await safeCall(() => request<CalendarEvent>(`${BASE}/events/${eventId}`))
    return res?.data ?? null
  },

  /** 创建日历事件 */
  createEvent: async (data: Partial<CalendarEvent>): Promise<CalendarEvent | null> => {
    const res = await safeCall(() =>
      request<CalendarEvent>(`${BASE}/events`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    )
    return res?.data ?? null
  },

  /** 更新日历事件 */
  updateEvent: async (eventId: string, data: Partial<CalendarEvent>): Promise<CalendarEvent | null> => {
    const res = await safeCall(() =>
      request<CalendarEvent>(`${BASE}/events/${eventId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    )
    return res?.data ?? null
  },

  /** 删除日历事件 */
  deleteEvent: async (eventId: string): Promise<boolean> => {
    const res = await safeCall(() =>
      request<null>(`${BASE}/events/${eventId}`, { method: 'DELETE' }),
    )
    return res?.code === 200
  },

  /** 判断是否为工作日 */
  checkWorkday: async (date: string): Promise<WorkdayResult | null> => {
    const res = await safeCall(() => request<WorkdayResult>(`${BASE}/workday?date=${date}`))
    return res?.data ?? null
  },

  /** 计算加工作日后的日期 */
  addWorkdays: async (startDate: string, days: number): Promise<WorkdayAddResult | null> => {
    const res = await safeCall(() =>
      request<WorkdayAddResult>(`${BASE}/workday/add?start_date=${startDate}&days=${days}`),
    )
    return res?.data ?? null
  },

  /** 计算两个日期之间的工作日数 */
  countWorkdays: async (startDate: string, endDate: string): Promise<WorkdayCountResult | null> => {
    const res = await safeCall(() =>
      request<WorkdayCountResult>(`${BASE}/workday/count?start_date=${startDate}&end_date=${endDate}`),
    )
    return res?.data ?? null
  },

  /** 获取指定年份节假日 */
  getHolidays: async (year: number): Promise<Record<string, string[]> | null> => {
    const res = await safeCall(() => request<Record<string, string[]>>(`${BASE}/holidays/${year}`))
    return res?.data ?? null
  },

  /** 获取事件统计 */
  getStats: async (startDate: string, endDate: string): Promise<EventStats | null> => {
    const res = await safeCall(() =>
      request<EventStats>(`${BASE}/stats?start_date=${startDate}&end_date=${endDate}`),
    )
    return res?.data ?? null
  },
}
