/**
 * API Service Layer — 封装所有后端 API 调用
 * 使用 fetch + async/await，统一错误处理
 */

import { message } from 'antd';
import type {
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

  // 204 No Content
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
  /** 列出所有 Agent */
  list: async (params?: {
    status?: string;
    provider?: string;
    limit?: number;
    offset?: number;
  }): Promise<AgentListResponse> => {
    const query = buildQuery(params ?? {});
    return request<AgentListResponse>(`/agents/${query}`);
  },

  /** 创建 Agent */
  create: async (data: AgentCreateRequest): Promise<AgentResponse> => {
    return request<AgentResponse>('/agents/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /** 获取 Agent 详情 */
  get: async (id: string): Promise<AgentResponse> => {
    return request<AgentResponse>(`/agents/${id}`);
  },

  /** 更新 Agent 状态 */
  updateStatus: async (id: string, status: string): Promise<AgentResponse> => {
    const body: AgentUpdateStatusRequest = { status: status as AgentUpdateStatusRequest['status'] };
    return request<AgentResponse>(`/agents/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },

  /** 发送消息给 Agent */
  sendMessage: async (id: string, msg: string): Promise<AgentMessageResponse> => {
    const body: AgentMessageRequest = { message: msg };
    return request<AgentMessageResponse>(`/agents/${id}/message`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
};

/* ========== Workflow API ========== */

export const workflowApi = {
  /** 列出所有工作流 */
  list: async (params?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<WorkflowListResponse> => {
    const query = buildQuery(params ?? {});
    return request<WorkflowListResponse>(`/workflows/${query}`);
  },

  /** 创建工作流 */
  create: async (data: WorkflowCreateRequest): Promise<WorkflowResponse> => {
    return request<WorkflowResponse>('/workflows/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /** 获取工作流详情 */
  get: async (id: string): Promise<WorkflowResponse> => {
    return request<WorkflowResponse>(`/workflows/${id}`);
  },

  /** 执行工作流 */
  execute: async (id: string, data?: WorkflowExecuteRequest): Promise<WorkflowExecuteResponse> => {
    return request<WorkflowExecuteResponse>(`/workflows/${id}/execute`, {
      method: 'POST',
      body: JSON.stringify(data ?? { initial_state: {} }),
    });
  },

  /** 取消工作流 */
  cancel: async (id: string): Promise<WorkflowResponse> => {
    return request<WorkflowResponse>(`/workflows/${id}/cancel`, {
      method: 'POST',
    });
  },
};

/* ========== Security API ========== */

export const securityApi = {
  /** 安全事件列表 */
  events: async (params?: {
    event_type?: string;
    severity?: string;
    resolved?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<SecurityEventListResponse> => {
    const query = buildQuery(params ?? {});
    return request<SecurityEventListResponse>(`/security/events${query}`);
  },

  /** 审批队列 */
  approvals: async (params?: {
    status?: string;
    department?: string;
    user_id?: string;
    limit?: number;
    offset?: number;
  }): Promise<ApprovalListResponse> => {
    const query = buildQuery(params ?? {});
    return request<ApprovalListResponse>(`/security/approvals${query}`);
  },

  /** 审批通过 */
  approve: async (id: string, data: ApprovalActionRequest): Promise<ApprovalResponse> => {
    return request<ApprovalResponse>(`/security/approvals/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /** 审批驳回 */
  reject: async (id: string, data: ApprovalActionRequest): Promise<ApprovalResponse> => {
    return request<ApprovalResponse>(`/security/approvals/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /** 审计日志 */
  auditTrail: async (params?: ListParams): Promise<AuditTrailResponse> => {
    const query = buildQuery(params ?? {});
    return request<AuditTrailResponse>(`/security/audit-trail${query}`);
  },
};

/* ========== Model API ========== */

export const modelApi = {
  /** 列出模型 */
  list: async (params?: {
    provider?: string;
    tier?: string;
  }): Promise<ModelListResponse> => {
    const query = buildQuery(params ?? {});
    return request<ModelListResponse>(`/models/${query}`);
  },

  /** 健康检查 */
  health: async (): Promise<ModelHealthResponse> => {
    return request<ModelHealthResponse>('/models/status');
  },

  /** 模型路由 */
  route: async (data: ModelRouteRequest): Promise<ModelRouteResponse> => {
    return request<ModelRouteResponse>('/models/route', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /** 获取配置 */
  config: async (): Promise<ModelConfigResponse> => {
    return request<ModelConfigResponse>('/models/config');
  },
};

/* ========== 错误处理工具 ========== */

/** 安全地调用 API 并显示错误消息 */
export async function safeCall<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : '未知错误';
    message.error(errorMsg);
    return null;
  }
}
