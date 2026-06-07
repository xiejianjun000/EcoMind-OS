/**
 * 日历模块 API 服务层
 *
 * 对接后端 /api/calendar 路由
 * 降级策略: API 不可用时自动使用本地 Mock 数据
 */

// ─── Types ───

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
  date: string
  is_workday: boolean
  weekday: number
  weekday_name: string
}

export interface AddWorkdaysResult {
  start_date: string
  days: number
  result_date: string
  weekday: number
}

export interface CountWorkdaysResult {
  start_date: string
  end_date: string
  workdays: number
  total_days: number
}

export interface EventStats {
  period: { start: string; end: string }
  total_events: number
  by_type: Record<string, number>
  by_status: Record<string, number>
  by_department: Record<string, number>
  by_priority: Record<string, number>
}

// ─── Mock Data ───

const MOCK_EVENTS: CalendarEvent[] = [
  {
    id: 'EVT-M001', title: '湘江流域水质监测采样', event_type: 'task',
    start_time: new Date(new Date().setHours(9, 0, 0, 0)).toISOString(),
    end_time: new Date(new Date().setHours(12, 0, 0, 0)).toISOString(),
    all_day: false, description: '湘江长沙段3个监测点水质采样', location: '湘江长沙段',
    assignee: '张监测员', department: '环境监测中心', status: 'in_progress',
    priority: 'high', recurrence: 'none', related_id: '', tags: ['水质', '采样'],
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  },
  {
    id: 'EVT-M002', title: '执法案件推进会', event_type: 'meeting',
    start_time: new Date(new Date().setHours(14, 0, 0, 0)).toISOString(),
    end_time: new Date(new Date().setHours(15, 30, 0, 0)).toISOString(),
    all_day: false, description: '讨论CASE-2026-001案件进展', location: '3楼会议室',
    assignee: '李队长', department: '执法支队', status: 'pending',
    priority: 'high', recurrence: 'none', related_id: 'CASE-2026-001', tags: ['执法', '会议'],
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  },
  {
    id: 'EVT-M003', title: '排污许可证审批截止', event_type: 'approval',
    start_time: new Date(Date.now() + 86400000).toISOString().split('T')[0] + 'T00:00:00',
    end_time: new Date(Date.now() + 86400000).toISOString().split('T')[0] + 'T23:59:59',
    all_day: true, description: 'AP-2026-001 排污许可证审批截止日', location: '',
    assignee: '审批科', department: '环评审批科', status: 'pending',
    priority: 'urgent', recurrence: 'none', related_id: 'AP-2026-001', tags: ['审批', '截止'],
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  },
  {
    id: 'EVT-M004', title: '月度环境监测报告提交', event_type: 'report',
    start_time: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0] + 'T00:00:00',
    end_time: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0] + 'T23:59:59',
    all_day: true, description: '5月份全省环境监测月报提交', location: '',
    assignee: '张监测员', department: '环境监测中心', status: 'pending',
    priority: 'normal', recurrence: 'none', related_id: '', tags: ['报告', '月度'],
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  },
  {
    id: 'EVT-M005', title: '株洲XX企业废气排放突击检查', event_type: 'enforcement',
    start_time: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0] + 'T10:00:00',
    end_time: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0] + 'T16:00:00',
    all_day: false, description: '对株洲XX化工企业开展废气排放突击执法检查', location: '株洲市石峰区',
    assignee: '王执法员', department: '执法支队', status: 'pending',
    priority: 'high', recurrence: 'none', related_id: '', tags: ['执法', '废气', '突击检查'],
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  },
]

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

async function safeFetch<T>(path: string, fallback: T): Promise<T> {
  try {
    return await apiFetch<T>(path)
  } catch (e) {
    console.warn(`[calendarApi] ${path} failed, using fallback:`, (e as Error).message)
    return fallback
  }
}

// ─── Calendar API ───

export const calendarApi = {
  /** 查询日历事件 */
  listEvents: (params?: {
    start_date?: string
    end_date?: string
    event_type?: string
    department?: string
    assignee?: string
    status?: string
  }) => {
    const qs = params ? '?' + new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([_, v]) => v !== undefined))
    ).toString() : ''
    return safeFetch<{ code: number; data: CalendarEvent[]; total: number }>(
      `/calendar/events${qs}`,
      { code: 200, data: MOCK_EVENTS, total: MOCK_EVENTS.length }
    )
  },

  /** 获取事件详情 */
  getEvent: (eventId: string) =>
    safeFetch<{ code: number; data: CalendarEvent | null }>(
      `/calendar/events/${eventId}`,
      { code: 200, data: MOCK_EVENTS.find(e => e.id === eventId) || null }
    ),

  /** 创建事件 */
  createEvent: (data: Partial<CalendarEvent>) =>
    apiFetch<{ code: number; data: CalendarEvent; message: string }>(
      '/calendar/events',
      { method: 'POST', body: JSON.stringify(data) }
    ),

  /** 更新事件 */
  updateEvent: (eventId: string, data: Partial<CalendarEvent>) =>
    apiFetch<{ code: number; data: CalendarEvent; message: string }>(
      `/calendar/events/${eventId}`,
      { method: 'PUT', body: JSON.stringify(data) }
    ),

  /** 删除事件 */
  deleteEvent: (eventId: string) =>
    apiFetch<{ code: number; message: string }>(
      `/calendar/events/${eventId}`,
      { method: 'DELETE' }
    ),

  /** 判断是否为工作日 */
  checkWorkday: (date: string) =>
    safeFetch<{ code: number; data: WorkdayResult }>(
      `/calendar/workday?date=${date}`,
      {
        code: 200,
        data: {
          date,
          is_workday: ![0, 6].includes(new Date(date).getDay()),
          weekday: new Date(date).getDay(),
          weekday_name: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][new Date(date).getDay()],
        },
      }
    ),

  /** 加工作日 */
  addWorkdays: (startDate: string, days: number) =>
    safeFetch<{ code: number; data: AddWorkdaysResult }>(
      `/calendar/workday/add?start_date=${startDate}&days=${days}`,
      { code: 200, data: { start_date: startDate, days, result_date: startDate, weekday: 0 } }
    ),

  /** 计算工作日数 */
  countWorkdays: (startDate: string, endDate: string) =>
    safeFetch<{ code: number; data: CountWorkdaysResult }>(
      `/calendar/workday/count?start_date=${startDate}&end_date=${endDate}`,
      { code: 200, data: { start_date: startDate, end_date: endDate, workdays: 5, total_days: 7 } }
    ),

  /** 事件统计 */
  getStats: (startDate: string, endDate: string) =>
    safeFetch<{ code: number; data: EventStats }>(
      `/calendar/stats?start_date=${startDate}&end_date=${endDate}`,
      {
        code: 200,
        data: {
          period: { start: startDate, end: endDate },
          total_events: MOCK_EVENTS.length,
          by_type: { task: 1, meeting: 1, approval: 1, report: 1, enforcement: 1 },
          by_status: { pending: 4, in_progress: 1 },
          by_department: { '环境监测中心': 2, '执法支队': 2, '环评审批科': 1 },
          by_priority: { high: 2, urgent: 1, normal: 2 },
        },
      }
    ),
}

export default calendarApi
