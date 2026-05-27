/** Department Agent configuration — v6.5 */

export interface AgentMessageResponse {
  id: string;
  content: string;
  agentId: string;
  timestamp: string;
  /** Extended fields for SendMessageModal */
  message?: string;
  iterations?: number;
  tools_used?: string[];
  hallucination_risk?: number;
}

export interface DeptAgentConfig {
  deptId: string;
  deptName: string;
  department: string;
  agentKey: string;
  agentId: string;
  agentName: string;
  icon: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  capabilities: string[];
  skills: string[];
  model: string;
  modelTier: 'opus' | 'sonnet' | 'haiku';
  safetyLevel: 'L1' | 'L2' | 'L3';
  cities: string[];
}

// ─── Agent Management ───

export type AgentProvider = 'qwen' | 'deepseek' | 'glm' | 'openai' | 'anthropic' | 'kimi' | 'yi' | 'local_vllm' | 'local_sglang';

export type AgentStatus = 'running' | 'paused' | 'stopped' | 'error';

export interface AgentCreateRequest {
  name: string;
  description?: string;
  provider: AgentProvider;
  model: string;
  soul?: string;
  temperature?: number;
  max_tokens?: number;
  taiji_verify_enabled?: boolean;
}

export interface AgentResponse {
  agent_id: string;
  name: string;
  description?: string;
  provider: string;
  status: AgentStatus;
  model: string;
  taiji_verify_enabled: boolean;
  soul?: string;
  temperature?: number;
  max_tokens?: number;
  tools: string[];
  created_at: string;
  updated_at?: string;
}

// ─── Approval & Audit ───

export type ApprovalStatus =
  | 'draft'
  | 'pending'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'returned'
  | 'cancelled'
  | 'completed';

export interface ApprovalResponse {
  approval_id: string;
  title: string;
  requester: string;
  department?: string;
  status: ApprovalStatus;
  current_step: number;
  steps: string[];
  created_at: string;
}

export interface ApprovalActionRequest {
  approver_id: string;
  comment: string;
}

export interface AuditRecordResponse {
  record_id: string;
  timestamp: string;
  user_id: string;
  action: string;
  resource: string;
  success: boolean;
  details: Record<string, unknown>;
}

// ─── Department ───

export type DepartmentName =
  | '生态环境执法局'
  | '生态环境监测处'
  | '环境影响评价与排放管理处'
  | '大气环境与应对气候变化处'
  | '水生态环境处'
  | '土壤生态环境处';

/** Simplified binding used by deptStore — structurally compatible with DeptAgentConfig */
export interface DepartmentAgentBinding {
  department: DepartmentName;
  agentId: string;
  agentName?: string;
  agentKey?: string;
  model?: string;
  skills?: string[];
  priority?: string;
}

// ─── Model Management ───

export type ModelTier = 'opus' | 'sonnet' | 'haiku';

export type ModelStatus = 'online' | 'offline' | 'loading' | 'error';

export interface ModelInfo {
  model_id: string;
  model_name: string;
  provider: string;
  tier: ModelTier | null;
  status: ModelStatus;
  latency_ms: number;
  cost_per_1k_tokens: number;
  max_tokens: number;
  supports_streaming: boolean;
  supports_tools: boolean;
}

export interface ModelRouteResponse {
  routed_model: string;
  provider: string;
  tier: ModelTier;
  api_base?: string;
  reason?: string;
  fallback?: string;
}

export interface ModelHealthResponse {
  healthy: boolean;
  models: Array<{ status: string; [key: string]: unknown }>;
}

// ─── Security Events ───

export type SecurityEventType =
  | 'hallucination'
  | 'unauthorized_access'
  | 'data_leak'
  | 'injection'
  | 'policy_violation'
  | 'rate_limit'
  | 'compliance'
  | 'encryption';

export type SecurityEventSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface SecurityEventResponse {
  event_id: string;
  created_at: string;
  event_type: SecurityEventType;
  severity: SecurityEventSeverity;
  title: string;
  description: string;
  source: string;
  resolved: boolean;
}

// ─── Workflow ───

export type WorkflowStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface WorkflowNodeDefinition {
  name: string;
  node_type: 'action' | 'decision' | 'subflow';
  config: Record<string, unknown>;
}

export interface WorkflowEdgeDefinition {
  source: string;
  target: string;
  condition: string | null;
}

export interface WorkflowCreateRequest {
  name: string;
  description?: string;
  max_iterations?: number;
  timeout_seconds?: number;
  nodes: WorkflowNodeDefinition[];
  edges: WorkflowEdgeDefinition[];
}

export interface WorkflowResponse {
  workflow_id: string;
  name: string;
  description?: string;
  status: WorkflowStatus;
  nodes: WorkflowNodeDefinition[];
  edges: WorkflowEdgeDefinition[];
  current_node: string | null;
  max_iterations: number;
  timeout_seconds: number;
  created_at: string;
  updated_at: string;
  history: Record<string, unknown>[];
  errors: string[];
}

// ─── Default Department Agent Configs ───

/** Full department agent configs used by RoleSwitcher + ChiefDashboard */
export const DEFAULT_DEPT_AGENTS: DeptAgentConfig[] = [
  {
    deptId: 'dept_enforcement',
    deptName: '生态环境执法局',
    department: '生态环境执法局',
    agentKey: 'enforcement',
    agentId: 'enforcement',
    agentName: '执法监察专家',
    icon: 'SafetyCertificateOutlined',
    priority: 'P0',
    capabilities: ['取证辅助', '违规判定', '处罚建议', '文书生成'],
    skills: ['智能取证', '违规自动判定', '文书一键生成'],
    model: 'qwen-max',
    modelTier: 'opus',
    safetyLevel: 'L3',
    cities: ['长沙市', '株洲市', '湘潭市'],
  },
  {
    deptId: 'dept_monitoring',
    deptName: '生态环境监测处',
    department: '生态环境监测处',
    agentKey: 'monitoring',
    agentId: 'env-monitoring',
    agentName: '环境监测专家',
    icon: 'LineChartOutlined',
    priority: 'P0',
    capabilities: ['实时数据解读', '异常分析', '趋势预测', '报告生成'],
    skills: ['污染溯源', '趋势预警', '自动报告'],
    model: 'deepseek-chat',
    modelTier: 'sonnet',
    safetyLevel: 'L2',
    cities: ['长沙市', '衡阳市', '邵阳市', '岳阳市'],
  },
  {
    deptId: 'dept_eia',
    deptName: '环境影响评价与排放管理处',
    department: '环境影响评价与排放管理处',
    agentKey: 'eia',
    agentId: 'eia',
    agentName: '环评审批专家',
    icon: 'FileTextOutlined',
    priority: 'P0',
    capabilities: ['技术审查', '合规校验', '报告生成'],
    skills: ['自动审查', '合规比对', '报告稽核'],
    model: 'qwen-plus',
    modelTier: 'opus',
    safetyLevel: 'L3',
    cities: ['长沙市', '常德市', '郴州市'],
  },
  {
    deptId: 'dept_air',
    deptName: '大气环境与应对气候变化处',
    department: '大气环境与应对气候变化处',
    agentKey: 'air',
    agentId: 'carbon',
    agentName: '碳排放专家',
    icon: 'CloudOutlined',
    priority: 'P1',
    capabilities: ['排放计算', '减排方案', '碳足迹分析'],
    skills: ['碳核算', '减排路径规划'],
    model: 'glm-4',
    modelTier: 'sonnet',
    safetyLevel: 'L2',
    cities: ['长沙市', '株洲市', '湘潭市', '娄底市'],
  },
  {
    deptId: 'dept_water',
    deptName: '水生态环境处',
    department: '水生态环境处',
    agentKey: 'water',
    agentId: 'water',
    agentName: '水资源专家',
    icon: 'DropboxOutlined',
    priority: 'P1',
    capabilities: ['水质分析', '水量预测', '污染溯源'],
    skills: ['水质建模', '污染扩散模拟'],
    model: 'gpt-4o-mini',
    modelTier: 'sonnet',
    safetyLevel: 'L2',
    cities: ['长沙市', '岳阳市', '常德市', '益阳市'],
  },
  {
    deptId: 'dept_soil',
    deptName: '土壤生态环境处',
    department: '土壤生态环境处',
    agentKey: 'soil',
    agentId: 'soil',
    agentName: '土壤治理专家',
    icon: 'ExperimentOutlined',
    priority: 'P1',
    capabilities: ['土壤检测', '污染评估', '修复方案'],
    skills: ['土壤污染评估', '修复方案推荐'],
    model: 'ecomind-14b-v3',
    modelTier: 'sonnet',
    safetyLevel: 'L2',
    cities: ['长沙市', '衡阳市', '郴州市'],
  },
];
