/**
 * API Type Definitions — 与后端 Pydantic Schema 对应的 TypeScript 类型
 */

/* ========== Agent Types ========== */

export type AgentStatus = 'running' | 'paused' | 'stopped' | 'error';

export type AgentProvider = 'openai' | 'anthropic' | 'qwen' | 'glm' | 'kimi' | 'deepseek' | 'yi';

export interface AgentCreateRequest {
  name: string;
  description?: string;
  provider?: AgentProvider;
  model?: string;
  soul?: string;
  temperature?: number;
  max_tokens?: number;
  max_iterations?: number;
  taiji_verify_enabled?: boolean;
  tools?: string[];
  metadata?: Record<string, unknown>;
}

export interface AgentUpdateStatusRequest {
  status: AgentStatus;
}

export interface AgentMessageRequest {
  message: string;
  system_message?: string | null;
  stream?: boolean;
}

export interface AgentResponse {
  agent_id: string;
  name: string;
  description: string;
  status: AgentStatus;
  provider: AgentProvider;
  model: string;
  soul: string;
  temperature: number;
  max_tokens: number;
  max_iterations: number;
  taiji_verify_enabled: boolean;
  tools: string[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AgentListResponse {
  agents: AgentResponse[];
  total: number;
}

export interface AgentMessageResponse {
  agent_id: string;
  message: string;
  iterations: number;
  tools_used: string[];
  hallucination_risk: number;
  status: string;
}

/* ========== Workflow Types ========== */

export type WorkflowStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface WorkflowNodeDefinition {
  name: string;
  node_type: string;
  config: Record<string, unknown>;
}

export interface WorkflowEdgeDefinition {
  source: string;
  target: string;
  condition?: string | null;
}

export interface WorkflowCreateRequest {
  name: string;
  description?: string;
  nodes: WorkflowNodeDefinition[];
  edges?: WorkflowEdgeDefinition[];
  max_iterations?: number;
  timeout_seconds?: number;
  metadata?: Record<string, unknown>;
}

export interface WorkflowExecuteRequest {
  initial_state?: Record<string, unknown>;
  start_node?: string | null;
}

export interface WorkflowResponse {
  workflow_id: string;
  name: string;
  description: string;
  status: WorkflowStatus;
  nodes: WorkflowNodeDefinition[];
  edges: WorkflowEdgeDefinition[];
  max_iterations: number;
  timeout_seconds: number;
  current_node: string | null;
  history: Record<string, unknown>[];
  errors: string[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface WorkflowListResponse {
  workflows: WorkflowResponse[];
  total: number;
}

export interface WorkflowExecuteResponse {
  workflow_id: string;
  status: WorkflowStatus;
  current_node: string | null;
  history: Record<string, unknown>[];
  errors: string[];
}

/* ========== Security Types ========== */

export type SecurityEventSeverity = 'low' | 'medium' | 'high' | 'critical';

export type SecurityEventType =
  | 'hallucination'
  | 'unauthorized_access'
  | 'data_leak'
  | 'injection'
  | 'policy_violation'
  | 'rate_limit'
  | 'compliance'
  | 'encryption';

export type ApprovalStatus =
  | 'draft'
  | 'pending'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'returned'
  | 'cancelled'
  | 'completed';

export interface SecurityEventResponse {
  event_id: string;
  event_type: SecurityEventType;
  severity: SecurityEventSeverity;
  title: string;
  description: string;
  agent_id: string | null;
  source: string;
  metadata: Record<string, unknown>;
  resolved: boolean;
  created_at: string;
}

export interface SecurityEventListResponse {
  events: SecurityEventResponse[];
  total: number;
}

export interface ApprovalStepResponse {
  step_id: string;
  step_name: string;
  approvers: Record<string, string>[];
  required_approvers: number;
  status: ApprovalStatus;
  approved_by: string[];
  rejected_by: string[];
  comments: Record<string, unknown>[];
}

export interface ApprovalResponse {
  approval_id: string;
  title: string;
  description: string;
  requester: string;
  department: string;
  status: ApprovalStatus;
  steps: ApprovalStepResponse[];
  current_step: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ApprovalListResponse {
  approvals: ApprovalResponse[];
  total: number;
}

export interface ApprovalActionRequest {
  approver_id: string;
  comment?: string;
  step_id?: string | null;
}

export interface AuditRecordResponse {
  record_id: string;
  user_id: string;
  action: string;
  resource: string;
  timestamp: string;
  success: boolean;
  details: Record<string, unknown>;
}

export interface AuditTrailResponse {
  records: AuditRecordResponse[];
  total: number;
  chain_valid: boolean;
}

/* ========== Model Types ========== */

export type ModelTier = 'opus' | 'sonnet' | 'haiku';

export type ModelProvider =
  | 'qwen'
  | 'glm'
  | 'deepseek'
  | 'yi'
  | 'chatglm'
  | 'baichuan'
  | 'minicpm'
  | 'internlm'
  | 'aquila'
  | 'skywork'
  | 'openai'
  | 'anthropic'
  | 'local_vllm'
  | 'local_sglang';

export type ModelStatus = 'online' | 'offline' | 'loading' | 'error';

export interface ModelInfo {
  model_id: string;
  model_name: string;
  provider: ModelProvider;
  tier: ModelTier | null;
  status: ModelStatus;
  api_base: string;
  max_tokens: number;
  supports_streaming: boolean;
  supports_tools: boolean;
  latency_ms: number;
  cost_per_1k_tokens: number;
  metadata: Record<string, unknown>;
}

export interface ModelListResponse {
  models: ModelInfo[];
  total: number;
}

export interface ModelHealthResponse {
  healthy: boolean;
  models: Record<string, unknown>[];
  checked_at: string;
}

export interface ModelRouteRequest {
  tier: ModelTier;
  task_type?: string;
  prefer_local?: boolean;
  max_latency_ms?: number | null;
}

export interface ModelRouteResponse {
  routed_model: string;
  provider: ModelProvider;
  tier: ModelTier;
  api_base: string;
  reason: string;
  fallback: string | null;
}

export interface ModelConfigResponse {
  litellm_config_path: string;
  configured_models: string[];
  router_settings: Record<string, unknown>;
  general_settings: Record<string, unknown>;
}

/* ========== Common Types ========== */

export interface ApiError {
  detail: string | Array<{ loc: string[]; msg: string; type: string }>;
}

export interface ListParams {
  limit?: number;
  offset?: number;
}
