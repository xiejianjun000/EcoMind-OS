/** Base list query parameters */
export interface ListParams {
  limit?: number;
  offset?: number;
}

/** Deployment mode */
export type DeployMode = 'local' | 'cloud' | 'hybrid';

// ============================================================
// Agent Types
// ============================================================

export type AgentStatus = 'running' | 'stopped' | 'paused' | 'error';
export type AgentTier = 'opus' | 'sonnet' | 'haiku';
export type AgentProvider = 'deepseek' | 'qwen' | 'glm' | 'openai' | 'anthropic';
/** 19个部门名称 */
export type DepartmentName =
  | '办公室' | '综合协调处' | '法规与标准处' | '科技与财务处' | '宣传教育与对外合作处'
  | '生态环境执法局' | '生态环境监测处' | '环境影响评价与排放管理处'
  | '大气环境与应对气候变化处' | '水生态环境处' | '土壤生态环境处'
  | '省生态环境保护督察办公室' | '生态环境保护督察二处' | '生态环境保护督察三处'
  | '固体废物与化学品处' | '核与辐射管理处' | '自然生态保护处'
  | '人事处' | '厅直属机关党委';

export interface AgentCreateRequest {
  name: string;
  description?: string;
  provider: AgentProvider;
  model: string;
  soul?: string;
  temperature?: number;
  max_tokens?: number;
  max_iterations?: number;
  tier?: AgentTier;
  taiji_verify_enabled?: boolean;
  tools?: string[];
  metadata?: Record<string, unknown>;
  /** 🆕 部门绑定 */
  department?: DepartmentName;
}

export interface AgentResponse {
  agent_id: string;
  name: string;
  description?: string;
  status: AgentStatus;
  provider: AgentProvider;
  model: string;
  soul?: string;
  temperature?: number;
  max_tokens?: number;
  max_iterations?: number;
  tier?: AgentTier;
  taiji_verify_enabled?: boolean;
  tools?: string[];
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  /** 🆕 部门绑定 */
  department?: DepartmentName;
  /** 🆕 绑定的技能 */
  skills?: string[];
}

export interface AgentListResponse {
  agents: AgentResponse[];
  total: number;
}

export interface AgentMessageRequest {
  message: string;
  session_id?: string;
  system_message?: string;
  /** 🆕 部门上下文 */
  department?: DepartmentName;
}

export interface AgentMessageResponse {
  agent_id: string;
  message: string;
  iterations?: number;
  tools_used?: string[];
  hallucination_risk?: number;
  status: string;
  session_id?: string;
}

export interface AgentUpdateStatusRequest {
  status: AgentStatus;
}

// ============================================================
// Workflow Types
// ============================================================

export type WorkflowStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface WorkflowCreateRequest {
  name: string;
  description?: string;
  nodes?: unknown[];
  edges?: unknown[];
}

export interface WorkflowResponse {
  workflow_id: string;
  name: string;
  description?: string;
  status: WorkflowStatus;
  nodes?: unknown[];
  edges?: unknown[];
  created_at: string;
  updated_at: string;
}

export interface WorkflowListResponse {
  workflows: WorkflowResponse[];
  total: number;
}

export interface WorkflowExecuteRequest {
  initial_state?: Record<string, unknown>;
}

export interface WorkflowExecuteResponse {
  workflow_id: string;
  status: WorkflowStatus;
  result?: unknown;
}

// ============================================================
// Security Types
// ============================================================

export type SecurityEventType = 'intrusion' | 'malware' | 'policy_violation' | 'anomaly' | 'data_leak' | 'other';
export type SecuritySeverity = 'low' | 'medium' | 'high' | 'critical';

export interface SecurityEvent {
  id: string;
  eventType: SecurityEventType;
  severity: SecuritySeverity;
  description: string;
  timestamp: string;
}

export interface SecurityEventListResponse {
  events: SecurityEvent[];
  total: number;
}

// ─── Approval Types ───

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface ApprovalResponse {
  approval_id: string;
  title: string;
  applicant: string;
  type: string;
  level: 'L1' | 'L2' | 'L3';
  status: ApprovalStatus;
  submitted_at: string;
  resolved_at?: string;
}

export interface ApprovalListResponse {
  approvals: ApprovalResponse[];
  total: number;
}

export interface ApprovalActionRequest {
  comment?: string;
}

// ─── Audit Types ───

export interface AuditTrailResponse {
  records: AuditRecord[];
  total: number;
}

export interface AuditRecord {
  id: string;
  timestamp: string;
  operator: string;
  action: string;
  detail: string;
  result: 'success' | 'failure' | 'warning';
  level: string;
}

// ============================================================
// Model Types
// ============================================================

export type ModelProvider = 'deepseek' | 'qwen' | 'glm' | 'yi' | 'openai';
export type ModelTier = 'opus' | 'sonnet' | 'haiku';

export interface ModelInfo {
  name: string;
  provider: ModelProvider;
  tier: ModelTier;
  status: 'active' | 'inactive' | 'error';
  avg_latency_ms?: number;
  success_rate?: number;
}

export interface ModelListResponse {
  models: ModelInfo[];
  active_count: number;
  total_count: number;
}

export interface ModelHealthResponse {
  models: ModelInfo[];
}

export interface ModelRouteRequest {
  task: string;
  tier?: ModelTier;
  provider?: ModelProvider;
}

export interface ModelRouteResponse {
  model: string;
  provider: string;
  tier: ModelTier;
  reason: string;
}

export interface ModelConfigResponse {
  active_provider: string;
  available_models: string[];
  tier_configs: Record<string, { model: string; temperature: number }>;
}

// ============================================================
// Department & Agent Binding Types
// ============================================================

/** 部门智能体绑定信息 */
export interface DepartmentAgentBinding {
  department: DepartmentName;
  agentName: string;
  agentKey: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  skills: string[];
  model: string;
}

/** 所有19个部门的智能体默认绑定 */
export const DEFAULT_DEPT_AGENTS: DepartmentAgentBinding[] = [
  // P0
  { department: '生态环境执法局', agentName: '执法办案智能体', agentKey: 'enforcement-agent', priority: 'P0', skills: ['enforcement-decision', 'environment-monitoring', 'report-generation'], model: 'deepseek-671B' },
  { department: '生态环境监测处', agentName: '监测分析智能体', agentKey: 'monitoring-agent', priority: 'P0', skills: ['environment-monitoring', 'report-generation', 'security-audit'], model: 'deepseek-671B' },
  { department: '环境影响评价与排放管理处', agentName: '环评审批智能体', agentKey: 'eia-approval-agent', priority: 'P0', skills: ['approval-workflow', 'security-audit'], model: 'deepseek-671B' },
  { department: '大气环境与应对气候变化处', agentName: '大气治理智能体', agentKey: 'air-climate-agent', priority: 'P0', skills: ['carbon-emission', 'environment-monitoring', 'report-generation'], model: 'deepseek-671B' },
  { department: '水生态环境处', agentName: '水环境治理智能体', agentKey: 'water-agent', priority: 'P0', skills: ['environment-monitoring', 'report-generation'], model: 'deepseek-671B' },
  { department: '土壤生态环境处', agentName: '土壤治理智能体', agentKey: 'soil-agent', priority: 'P0', skills: ['environment-monitoring', 'report-generation'], model: 'deepseek-671B' },
  // P1
  { department: '办公室', agentName: '政务综合智能体', agentKey: 'office-agent', priority: 'P1', skills: ['report-generation', 'approval-workflow'], model: 'deepseek-671B' },
  { department: '综合协调处', agentName: '综合协调智能体', agentKey: 'coordination-agent', priority: 'P1', skills: ['environment-monitoring', 'report-generation'], model: 'deepseek-671B' },
  { department: '法规与标准处', agentName: '法规标准智能体', agentKey: 'regulation-agent', priority: 'P1', skills: ['enforcement-decision', 'approval-workflow', 'security-audit'], model: 'deepseek-671B' },
  { department: '科技与财务处', agentName: '科技财务智能体', agentKey: 'tech-finance-agent', priority: 'P1', skills: ['report-generation'], model: 'deepseek-671B' },
  { department: '宣传教育与对外合作处', agentName: '宣传合作智能体', agentKey: 'education-agent', priority: 'P1', skills: ['report-generation'], model: 'deepseek-671B' },
  // P2
  { department: '省生态环境保护督察办公室', agentName: '督察一智能体', agentKey: 'inspection-1-agent', priority: 'P2', skills: ['enforcement-decision', 'report-generation'], model: 'deepseek-671B' },
  { department: '生态环境保护督察二处', agentName: '督察二智能体', agentKey: 'inspection-2-agent', priority: 'P2', skills: ['enforcement-decision', 'report-generation'], model: 'deepseek-671B' },
  { department: '生态环境保护督察三处', agentName: '督察三智能体', agentKey: 'inspection-3-agent', priority: 'P2', skills: ['enforcement-decision', 'report-generation'], model: 'deepseek-671B' },
  { department: '固体废物与化学品处', agentName: '固废管理智能体', agentKey: 'solidwaste-agent', priority: 'P2', skills: ['environment-monitoring', 'approval-workflow'], model: 'deepseek-671B' },
  { department: '核与辐射管理处', agentName: '核辐射安全智能体', agentKey: 'nuclear-agent', priority: 'P2', skills: ['security-audit', 'approval-workflow'], model: 'deepseek-671B' },
  { department: '自然生态保护处', agentName: '生态保护智能体', agentKey: 'ecology-agent', priority: 'P2', skills: ['environment-monitoring', 'report-generation'], model: 'deepseek-671B' },
  // P3
  { department: '人事处', agentName: '人事管理智能体', agentKey: 'hr-agent', priority: 'P3', skills: ['report-generation'], model: 'deepseek-671B' },
  { department: '厅直属机关党委', agentName: '党建智能体', agentKey: 'party-agent', priority: 'P3', skills: ['report-generation'], model: 'deepseek-671B' },
];

// ============================================================
// Enforcement Case Types
// ============================================================

export type CaseStage = '线索' | '受理' | '立案' | '调查' | '告知' | '决定' | '执行' | '归档';

export type CaseSource = '在线监测' | '群众举报' | '日常巡查' | '上级交办' | '其他';

export type CaseSeverity = '高' | '中' | '低';

export interface TimelineEntry {
  id: string;
  time: string;
  stage: CaseStage;
  operator: string;
  action: string;
  comment?: string;
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  uploaded_at: string;
}

export interface EnforcementCase {
  id: string;
  case_number: string;
  title: string;
  source: CaseSource;
  stage: CaseStage;
  severity: CaseSeverity;
  enterprise_name: string;
  credit_code: string;
  legal_person: string;
  violation: string;
  city: string;
  officers: string[];
  timeline: TimelineEntry[];
  created_at: string;
  updated_at: string;
}

export interface EnforcementCaseCreateRequest {
  title: string;
  source: CaseSource;
  severity: CaseSeverity;
  enterprise_name: string;
  credit_code?: string;
  legal_person?: string;
  violation: string;
  city: string;
  officers?: string[];
}

export interface EnforcementCaseTransitionRequest {
  target_stage: CaseStage;
  comment?: string;
  operator: string;
}

export interface EnforcementCaseListParams {
  stage?: CaseStage;
  severity?: CaseSeverity;
  city?: string;
  keyword?: string;
  limit?: number;
  offset?: number;
}
