/**
 * API Service Layer — 封装所有后端 API 调用
 * 使用 fetch + async/await，统一错误处理
 */

import { message } from 'antd';
import type {
  EnforcementCase,
  EnforcementCaseCreateRequest,
  EnforcementCaseTransitionRequest,
  EnforcementCaseListParams,
  AgentCreateRequest,
  AgentListResponse,
  AgentMessageRequest,
  AgentMessageResponse,
  AgentResponse,
  AgentUpdateStatusRequest,
  WorkflowCreateRequest,
  WorkflowExecuteRequest,
  WorkflowExecuteResponse,
  WorkflowListResponse,
  WorkflowResponse,
  SecurityEventListResponse,
  ApprovalListResponse,
  ApprovalActionRequest,
  ApprovalResponse,
  AuditTrailResponse,
  ModelListResponse,
  ModelHealthResponse,
  ModelRouteRequest,
  ModelRouteResponse,
  ModelConfigResponse,
  ListParams,
  DepartmentName,
  DepartmentAgentBinding,
} from './types';

/* ========== 基础配置 ========== */

const API_BASE = '/api';

/** 通用请求方法 */
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const config: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  };

  const response = await fetch(url, config);

  if (!response.ok) {
    let errorMsg = `请求失败 (${response.status})`;
    try {
      const errorData = await response.json();
      if (typeof errorData.detail === 'string') {
        errorMsg = errorData.detail;
      } else if (Array.isArray(errorData.detail)) {
        errorMsg = errorData.detail.map((e: { msg: string }) => e.msg).join('; ');
      }
    } catch {
      // JSON 解析失败，使用默认错误消息
    }
    throw new Error(errorMsg);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

/** 构建 URL 查询参数 */
function buildQuery(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  });
  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}

/* ========== Agent API ========== */

export const agentApi = {
  list: async (params?: { status?: string; provider?: string; department?: string; limit?: number; offset?: number }): Promise<AgentListResponse> => {
    const query = buildQuery(params ?? {});
    return request<AgentListResponse>(`/agents/${query}`);
  },

  create: async (data: AgentCreateRequest): Promise<AgentResponse> => {
    return request<AgentResponse>('/agents/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  get: async (id: string): Promise<AgentResponse> => {
    return request<AgentResponse>(`/agents/${id}`);
  },

  updateStatus: async (id: string, status: string): Promise<AgentResponse> => {
    const body: AgentUpdateStatusRequest = { status: status as AgentUpdateStatusRequest['status'] };
    return request<AgentResponse>(`/agents/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },

  sendMessage: async (id: string, msg: string, department?: DepartmentName): Promise<AgentMessageResponse> => {
    const body: AgentMessageRequest = { message: msg, department };
    return request<AgentMessageResponse>(`/agents/${id}/message`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  /** 🆕 按部门获取Agent */
  getByDepartment: async (dept: string): Promise<AgentResponse | null> => {
    try {
      return await request<AgentResponse>(`/agents/department/${dept}`);
    } catch {
      return null;
    }
  },
};

/* ========== Department API 🆕 ========== */

export const departmentApi = {
  /** 获取所有部门智能体绑定 */
  listBindings: async (): Promise<DepartmentAgentBinding[]> => {
    return request<DepartmentAgentBinding[]>('/departments/bindings');
  },

  /** 批量初始化部门智能体 */
  initAll: async (): Promise<{ initialized: number; agents: AgentResponse[] }> => {
    return request<{ initialized: number; agents: AgentResponse[] }>('/departments/init', {
      method: 'POST',
    });
  },

  /** 获取单个部门智能体 */
  getBinding: async (dept: string): Promise<DepartmentAgentBinding> => {
    return request<DepartmentAgentBinding>(`/departments/${dept}`);
  },

  /** 发送消息到部门智能体 */
  sendMessage: async (dept: string, msg: string): Promise<AgentMessageResponse> => {
    return request<AgentMessageResponse>(`/departments/${dept}/message`, {
      method: 'POST',
      body: JSON.stringify({ message: msg }),
    });
  },
};

/* ========== Environment API 🆕 对接湖南省生态环境厅实时数据 ========== */

export interface EnvRealtimeItem {
  city: string;
  aqi: number;
  level: string;
  primary: string;
  time: string;
}

export interface EnvForecastItem {
  city: string;
  date: string;
  aqi: string;
  level: string;
  pm25: string;
  o3: string;
  primary: string;
}

export interface EnvRankingItem {
  city: string;
  aqi: number;
  level: string;
  rank: number;
  primary: string;
  date: string;
}

export const environmentApi = {
  /** 获取实时AQI */
  getRealtime: async (): Promise<EnvRealtimeItem[]> => {
    const res = await request<{ code: number; data: EnvRealtimeItem[]; total: number }>('/environment/realtime');
    return res?.data ?? [];
  },
  /** 获取7天预报 */
  getForecast: async (): Promise<EnvForecastItem[]> => {
    const res = await request<{ code: number; data: EnvForecastItem[]; total: number }>('/environment/forecast');
    return res?.data ?? [];
  },
  /** 获取排名 */
  getRanking: async (date?: string): Promise<EnvRankingItem[]> => {
    const q = date ? `?date=${date}` : '';
    const res = await request<{ code: number; data: EnvRankingItem[]; total: number }>(`/environment/ranking${q}`);
    return res?.data ?? [];
  },
};

/* ========== Workflow API ========== */

export const workflowApi = {
  list: async (params?: { status?: string; limit?: number; offset?: number }): Promise<WorkflowListResponse> => {
    const query = buildQuery(params ?? {});
    return request<WorkflowListResponse>(`/workflows/${query}`);
  },

  create: async (data: WorkflowCreateRequest): Promise<WorkflowResponse> => {
    return request<WorkflowResponse>('/workflows/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  get: async (id: string): Promise<WorkflowResponse> => {
    return request<WorkflowResponse>(`/workflows/${id}`);
  },

  execute: async (id: string, data?: WorkflowExecuteRequest): Promise<WorkflowExecuteResponse> => {
    return request<WorkflowExecuteResponse>(`/workflows/${id}/execute`, {
      method: 'POST',
      body: JSON.stringify(data ?? { initial_state: {} }),
    });
  },

  cancel: async (id: string): Promise<WorkflowResponse> => {
    return request<WorkflowResponse>(`/workflows/${id}/cancel`, {
      method: 'POST',
    });
  },
};

/* ========== Security API ========== */

export const securityApi = {
  events: async (params?: { event_type?: string; severity?: string; resolved?: boolean; limit?: number; offset?: number }): Promise<SecurityEventListResponse> => {
    const query = buildQuery(params ?? {});
    return request<SecurityEventListResponse>(`/security/events${query}`);
  },

  approvals: async (params?: { status?: string; department?: string; user_id?: string; limit?: number; offset?: number }): Promise<ApprovalListResponse> => {
    const query = buildQuery(params ?? {});
    return request<ApprovalListResponse>(`/security/approvals${query}`);
  },

  approve: async (id: string, data: ApprovalActionRequest): Promise<ApprovalResponse> => {
    return request<ApprovalResponse>(`/security/approvals/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  reject: async (id: string, data: ApprovalActionRequest): Promise<ApprovalResponse> => {
    return request<ApprovalResponse>(`/security/approvals/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  auditTrail: async (params?: ListParams): Promise<AuditTrailResponse> => {
    const query = buildQuery(params ?? {});
    return request<AuditTrailResponse>(`/security/audit-trail${query}`);
  },
};

/* ========== Model API ========== */

export const modelApi = {
  list: async (params?: { provider?: string; tier?: string }): Promise<ModelListResponse> => {
    const query = buildQuery(params ?? {});
    return request<ModelListResponse>(`/models/${query}`);
  },

  health: async (): Promise<ModelHealthResponse> => {
    return request<ModelHealthResponse>('/models/status');
  },

  route: async (data: ModelRouteRequest): Promise<ModelRouteResponse> => {
    return request<ModelRouteResponse>('/models/route', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  config: async (): Promise<ModelConfigResponse> => {
    return request<ModelConfigResponse>('/models/config');
  },
};

/* ========== Enforcement API ========== */

export const enforcementApi = {
  listCases: async (params?: EnforcementCaseListParams): Promise<EnforcementCase[]> => {
    const query = buildQuery((params ?? {}) as Record<string, unknown>);
    return request<EnforcementCase[]>(`/enforcement/cases${query}`);
  },

  createCase: async (data: EnforcementCaseCreateRequest): Promise<EnforcementCase> => {
    return request<EnforcementCase>('/enforcement/cases', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getCase: async (id: string): Promise<EnforcementCase> => {
    return request<EnforcementCase>(`/enforcement/cases/${id}`);
  },

  updateCase: async (id: string, data: Partial<EnforcementCaseCreateRequest>): Promise<EnforcementCase> => {
    return request<EnforcementCase>(`/enforcement/cases/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  transitionCase: async (id: string, data: EnforcementCaseTransitionRequest): Promise<EnforcementCase> => {
    return request<EnforcementCase>(`/enforcement/cases/${id}/transition`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  deleteCase: async (id: string): Promise<void> => {
    return request<void>(`/enforcement/cases/${id}`, {
      method: 'DELETE',
    });
  },
};


/* ========== Approval API ========== */

export const approvalApi = {
  list: async (params?: Record<string, unknown>): Promise<any[]> => {
    const query = buildQuery(params ?? {});
    return request<any[]>(\`/approval/items\${query}\`);
  },

  create: async (data: any): Promise<any> => {
    return request<any>('/approval/items', { method: 'POST', body: JSON.stringify(data) });
  },

  get: async (id: string): Promise<any> => {
    return request<any>(\`/approval/items/\${id}\`);
  },

  transition: async (id: string, data: any): Promise<any> => {
    return request<any>(\`/approval/items/\${id}/transition\`, {
      method: 'POST', body: JSON.stringify(data),
    });
  },
};

/* ========== 错误处理工具 ========== */

export async function safeCall<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : '未知错误';
    message.error(errorMsg);
    return null;
  }
}
