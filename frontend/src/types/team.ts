/**
 * Team collaboration type definitions
 */

/** Team status */
export type TeamStatus = 'forming' | 'active' | 'paused' | 'completed' | 'disbanded';

/** Phase types */
export type PhaseType = 'requirement' | 'research' | 'design' | 'development' | 'review';

/** Task status */
export type TaskStatusType = 'pending' | 'in_progress' | 'completed' | 'blocked' | 'deleted';

/** Member role */
export type MemberRole = 'lead' | 'member' | 'reviewer' | 'observer';

/** Phase definition */
export interface PhaseDefinition {
  type: PhaseType;
  label: string;
  icon: string;
  description: string;
}

/** Team member */
export interface TeamMemberDetail {
  expertId: string;
  role: MemberRole;
  status: string;
  joinedAt: string;
}

/** Team task */
export interface TeamTask {
  taskId: string;
  teamId: string;
  subject: string;
  description: string;
  status: TaskStatusType;
  assignedTo: string | null;
  phase: PhaseType | null;
  priority: number;
  progress: number;
  blockedBy: string[];
  blocks: string[];
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

/** Team */
export interface Team {
  teamId: string;
  name: string;
  description: string;
  status: TeamStatus;
  currentPhase: PhaseType | null;
  leadExpertId: string;
  members: TeamMemberDetail[];
  tasks: TeamTask[];
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

/** Team template */
export interface TeamTemplate {
  templateId: string;
  name: string;
  description: string;
  leadExpertId: string;
  memberExpertIds: string[];
  phases: PhaseType[];
  defaultTasks: Record<string, unknown>[];
}

/** Phase labels mapping */
export const PHASE_LABELS: Record<PhaseType, { label: string; icon: string }> = {
  requirement: { label: '需求澄清', icon: 'ClipboardList' },
  research: { label: '调研分析', icon: 'Search' },
  design: { label: '设计细化', icon: 'PenTool' },
  development: { label: '并行开发', icon: 'Code' },
  review: { label: '测试交付', icon: 'CheckCircle' },
};

/** Expert category groups */
export const EXPERT_GROUPS = {
  core: {
    label: '核心主控',
    expertIds: ['gaia'],
  },
  approval: {
    label: '审批审查',
    expertIds: ['eia', 'permit'],
  },
  monitoring: {
    label: '监测应急',
    expertIds: ['env-monitoring', 'emergency', 'water'],
  },
  enforcement: {
    label: '执法督察',
    expertIds: ['enforcement', 'inspection'],
  },
  public: {
    label: '生态服务',
    expertIds: ['biodiversity', 'carbon', 'restoration', 'public'],
  },
} as const;
