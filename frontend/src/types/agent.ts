/**
 * Agent-as-Individual 5-Folder Schema
 * EcoMind OS v6.5
 *
 * Each agent is an independent digital entity with:
 *   🎭 personality/  - 人格系统
 *   🧠 knowledge/    - 知识系统 (RAG+图谱)
 *   🗃️ memory/       - 记忆系统 (四维)
 *   🛠️ skills/       - 技能系统 (自生成)
 *   🔧 workspace/    - 工作空间
 */

// ============================================================
// 🎭 Personality 人格系统
// ============================================================

export interface AgentProfile {
  agentId: string;
  userId: string;
  displayName: string;
  role: 'leader' | 'chief' | 'city' | 'admin' | 'staff';
  department: string;
  departmentId: string;
  jurisdiction: string[];        // 管辖城市/区域
  traits: AgentTraits;
  values: AgentValues;
  constraints: AgentConstraints;
  model: AgentModelConfig;
  createdAt: string;
  evolvedAt: string;
  evolutionCount: number;
}

export interface AgentTraits {
  rigor: number;        // 严谨度 0-1
  efficiency: number;   // 效率 0-1
  caution: number;      // 谨慎度 0-1
  creativity: number;   // 创造力 0-1
  empathy: number;      // 共情力 0-1
}

export interface AgentValues {
  ruleOfLaw: number;        // 依法行政
  servePublic: number;       // 服务意识
  efficiencyFirst: number;   // 效率优先
  dataDriven: number;        // 数据驱动
  collaborative: number;     // 协作精神
}

export interface AgentConstraints {
  maxApprovalLevel: 'L1' | 'L2' | 'L3';
  cannotOverride: string[];     // 不可越权操作
  dataScope: 'personal' | 'department' | 'city' | 'all';
  requireHumanSignoff: boolean;
}

export interface AgentModelConfig {
  local: string;           // 本地模型: qwen2.5-7b-q4_k_m
  center: string;          // 中心模型: ecomind-pro-72b
  loraAdapter?: string;    // LoRA适配器: zhang_chufa_lora_v3
  fallback: string;        // 降级模型: qwen2.5-3b-q4_k_m
}

// ============================================================
// 🧠 Knowledge 知识系统
// ============================================================

export interface KnowledgeBase {
  id: string;
  agentId: string;
  type: 'regulation' | 'case' | 'procedure' | 'entity' | 'custom';
  title: string;
  description: string;
  vectorStoreId?: string;       // ChromaDB collection ID
  graphNodeId?: string;         // Neo4j node ID
  itemCount: number;
  lastUpdated: string;
}

export interface KnowledgeItem {
  id: string;
  baseId: string;
  content: string;
  metadata: Record<string, unknown>;
  embedding?: number[];         // 向量 (本地存储)
  source: string;               // 来源
  addedAt: string;
  accessCount: number;
}

// ============================================================
// 🗃️ Memory 记忆系统
// ============================================================

export type MemoryType = 'episodic' | 'semantic' | 'procedural' | 'collaborative';

export interface AgentMemory {
  id: string;
  agentId: string;
  type: MemoryType;
  content: string;
  importance: number;           // 重要性 0-1
  confidence: number;           // 置信度 0-1
  context: {
    sessionId?: string;
    userId?: string;
    relatedAgentIds?: string[];
    taskType?: string;
  };
  tags: string[];
  createdAt: string;
  lastAccessedAt: string;
  accessCount: number;
  decayRate: number;            // 遗忘速率 (0=永记)
}

// ============================================================
// 🛠️ Skills 技能系统
// ============================================================

export type SkillSource = 'builtin' | 'generated' | 'subscribed';
export type SkillStatus = 'active' | 'testing' | 'deprecated' | 'archived';

export interface AgentSkill {
  id: string;
  agentId: string;
  name: string;
  description: string;
  version: number;
  status: SkillStatus;
  source: SkillSource;
  trigger: SkillTrigger;
  pipeline: SkillStep[];
  safetyLevel: 'L1' | 'L2' | 'L3';
  stats: SkillStats;
  parentSkillId?: string;       // 演化来源
  derivedSkillIds: string[];    // 衍生技能
  createdAt: string;
  updatedAt: string;
}

export interface SkillTrigger {
  pattern: string;              // 触发模式 (关键词/正则)
  context?: {
    department?: string[];
    city?: string[];
    taskType?: string[];
  };
  minConfidence: number;        // 最低置信度阈值
  cooldownMs: number;           // 冷却时间
}

export interface SkillStep {
  order: number;
  type: 'fetch_data' | 'call_agent' | 'llm_process' | 'format_output' | 'human_confirm' | 'govmcp_call';
  config: Record<string, unknown>;
  onFailure: 'skip' | 'retry' | 'abort';
  timeoutMs: number;
}

export interface SkillStats {
  successRate: number;          // 0-1
  usageCount: number;
  avgDurationMs: number;
  lastUsedAt: string;
  rating: number;               // 1-5
}

// ============================================================
// 🛠️ Skill Market 技能市场
// ============================================================

export interface SkillMarketEntry {
  id: string;
  skillId: string;
  authorAgentId: string;
  authorDepartment: string;
  category: SkillCategory;
  visibility: 'same_department' | 'cross_department' | 'public';
  subscriberCount: number;
  rating: number;
  publishedAt: string;
}

export type SkillCategory =
  | 'enforcement'
  | 'monitoring'
  | 'eia'
  | 'permit'
  | 'emergency'
  | 'inspection'
  | 'biodiversity'
  | 'carbon'
  | 'water'
  | 'public'
  | 'general';

// ============================================================
// 🔧 Workspace 工作空间
// ============================================================

export interface AgentWorkspace {
  inbox: WorkspaceTask[];       // 待处理队列
  current: WorkspaceTask[];     // 进行中
  drafts: WorkspaceDraft[];     // 草稿区
  review: WorkspaceReview[];    // 待审核
  archive: WorkspaceTask[];     // 归档
}

export interface WorkspaceTask {
  id: string;
  source: 'user' | 'agent' | 'system' | 'govmcp';
  sourceId: string;             // 来源Agent/User ID
  priority: 'urgent' | 'high' | 'normal' | 'low';
  title: string;
  description: string;
  status: 'pending' | 'processing' | 'done' | 'failed';
  deadline?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceDraft {
  id: string;
  type: 'report' | 'document' | 'approval' | 'analysis';
  title: string;
  content: string;
  lastEditedAt: string;
  autoSaveCount: number;
}

export interface WorkspaceReview {
  id: string;
  approvalId: string;
  level: 'L1' | 'L2' | 'L3';
  title: string;
  submittedBy: string;
  submittedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  auditHash: string;            // GOVMCP审计哈希
}

// ============================================================
// 🔄 Evolution 进化系统
// ============================================================

export type EvolutionPhase =
  | 'observe'      // ① 感知
  | 'reflect'      // ② 反思
  | 'abstract'     // ③ 提炼
  | 'generate'     // ④ 生成
  | 'validate'     // ⑤ 验证
  | 'share';       // ⑥ 共享

export type EvolutionTrigger =
  | 'failure'      // 失败驱动
  | 'pattern'      // 模式驱动
  | 'collaboration' // 协作驱动
  | 'scheduled';   // 计划驱动

export interface EvolutionLog {
  id: string;
  agentId: string;
  phase: EvolutionPhase;
  trigger: EvolutionTrigger;
  input: EvolutionInput;
  output: EvolutionOutput;
  confidence: number;
  createdAt: string;
  durationMs: number;
}

export interface EvolutionInput {
  observations: string[];       // 观察到的现象
  relatedMemoryIds: string[];
  relatedSkillIds: string[];
  patternCount?: number;        // 模式出现次数
}

export interface EvolutionOutput {
  type: 'reflection_note' | 'abstract_knowledge' | 'new_skill' | 'skill_improvement';
  summary: string;
  details: Record<string, unknown>;
  suggestedAction?: string;
}

export interface EvolutionMetrics {
  quality: {
    approvalPassRate: number;
    userCorrectionRate: number;
    satisfactionScore: number;   // 1-5
  };
  efficiency: {
    avgResponseTimeMs: number;
    taskCompletionRate: number;
    autoResolutionRate: number;
  };
  growth: {
    skillsGenerated: number;
    skillsAdoptedByOthers: number;
    knowledgeItemsExtracted: number;
  };
}

// ============================================================
// 🤖 Full Agent State
// ============================================================

export interface AgentState {
  profile: AgentProfile;
  knowledgeBases: KnowledgeBase[];
  memories: AgentMemory[];
  skills: AgentSkill[];
  workspace: AgentWorkspace;
  evolutionLog: EvolutionLog[];
  metrics: EvolutionMetrics;
}
