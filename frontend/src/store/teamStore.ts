import { create } from 'zustand';
import type {
  Team,
  TeamTask,
  TeamTemplate,
  TeamStatus,
  PhaseType,
  TaskStatusType,
  MemberRole,
} from '@/types/team';

// ============================================================
// State Interface
// ============================================================

interface TeamState {
  // Data
  teams: Team[];
  activeTeamId: string | null;
  templates: TeamTemplate[];

  // UI
  isCreating: boolean;
  isAdvancingPhase: boolean;

  // Actions
  fetchTeams: () => Promise<void>;
  fetchTemplates: () => Promise<void>;
  createTeam: (params: {
    name: string;
    description?: string;
    templateId?: string;
    leadExpertId?: string;
    memberExpertIds?: string[];
  }) => Promise<Team | null>;
  setActiveTeam: (teamId: string | null) => void;
  advancePhase: (teamId: string, nextPhase: PhaseType, notes?: string) => Promise<boolean>;
  createTask: (teamId: string, params: {
    subject: string;
    description?: string;
    assignedTo?: string;
    phase?: PhaseType;
    priority?: number;
  }) => Promise<TeamTask | null>;
  updateTask: (teamId: string, taskId: string, params: {
    status?: TaskStatusType;
    progress?: number;
    assignedTo?: string;
  }) => Promise<boolean>;
  getTeamTasks: (teamId: string) => TeamTask[];
  getTeamByExpert: (expertId: string) => Team | null;
  getExpertRole: (teamId: string, expertId: string) => MemberRole | null;
}

// ============================================================
// API helpers
// ============================================================

const API_BASE = '/api/teams';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// ============================================================
// Store
// ============================================================

export const useTeamStore = create<TeamState>((set, get) => ({
  teams: [],
  activeTeamId: null,
  templates: [
    {
      templateId: 'eia-approval',
      name: '环评审批团队',
      description: '环境影响评价技术审查与审批协作',
      leadExpertId: 'gaia',
      memberExpertIds: ['eia', 'env-monitoring', 'enforcement', 'public'],
      phases: ['requirement', 'research', 'design', 'review'],
      defaultTasks: [],
    },
    {
      templateId: 'emergency-response',
      name: '应急响应团队',
      description: '突发环境事件快速响应与处置',
      leadExpertId: 'emergency',
      memberExpertIds: ['env-monitoring', 'enforcement', 'water', 'public'],
      phases: ['requirement', 'design', 'development', 'review'],
      defaultTasks: [],
    },
    {
      templateId: 'ecological-inspection',
      name: '生态督察团队',
      description: '生态环境保护督察辅助与整改跟踪',
      leadExpertId: 'inspection',
      memberExpertIds: ['enforcement', 'eia', 'env-monitoring', 'water'],
      phases: ['requirement', 'research', 'design', 'development', 'review'],
      defaultTasks: [],
    },
  ],
  isCreating: false,
  isAdvancingPhase: false,

  fetchTeams: async () => {
    try {
      const data = await apiFetch<{ teams: Team[]; total: number }>('/');
      set({ teams: data.teams });
    } catch (err) {
      console.error('Failed to fetch teams:', err);
    }
  },

  fetchTemplates: async () => {
    try {
      const templates = await apiFetch<TeamTemplate[]>('/templates');
      set({ templates });
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    }
  },

  createTeam: async (params) => {
    set({ isCreating: true });
    try {
      const team = await apiFetch<Team>('/', {
        method: 'POST',
        body: JSON.stringify({
          name: params.name,
          description: params.description || '',
          template_id: params.templateId,
          lead_expert_id: params.leadExpertId || 'gaia',
          member_expert_ids: params.memberExpertIds || [],
        }),
      });
      set((state) => ({
        teams: [team, ...state.teams],
        activeTeamId: team.teamId,
        isCreating: false,
      }));
      return team;
    } catch (err) {
      console.error('Failed to create team:', err);
      set({ isCreating: false });
      return null;
    }
  },

  setActiveTeam: (teamId) => set({ activeTeamId: teamId }),

  advancePhase: async (teamId, nextPhase, notes = '') => {
    set({ isAdvancingPhase: true });
    try {
      const team = await apiFetch<Team>(`/${teamId}/advance-phase`, {
        method: 'POST',
        body: JSON.stringify({ next_phase: nextPhase, notes }),
      });
      set((state) => ({
        teams: state.teams.map((t) => (t.teamId === teamId ? team : t)),
        isAdvancingPhase: false,
      }));
      return true;
    } catch (err) {
      console.error('Failed to advance phase:', err);
      set({ isAdvancingPhase: false });
      return false;
    }
  },

  createTask: async (teamId, params) => {
    try {
      const task = await apiFetch<TeamTask>(`/${teamId}/tasks`, {
        method: 'POST',
        body: JSON.stringify({
          subject: params.subject,
          description: params.description || '',
          assigned_to: params.assignedTo,
          phase: params.phase,
          priority: params.priority || 1,
        }),
      });
      // Refresh team data
      const team = await apiFetch<Team>(`/${teamId}`);
      set((state) => ({
        teams: state.teams.map((t) => (t.teamId === teamId ? team : t)),
      }));
      return task;
    } catch (err) {
      console.error('Failed to create task:', err);
      return null;
    }
  },

  updateTask: async (teamId, taskId, params) => {
    try {
      await apiFetch<TeamTask>(`/${teamId}/tasks/${taskId}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: params.status,
          progress: params.progress,
          assigned_to: params.assignedTo,
        }),
      });
      // Refresh team data
      const team = await apiFetch<Team>(`/${teamId}`);
      set((state) => ({
        teams: state.teams.map((t) => (t.teamId === teamId ? team : t)),
      }));
      return true;
    } catch (err) {
      console.error('Failed to update task:', err);
      return false;
    }
  },

  getTeamTasks: (teamId) => {
    const team = get().teams.find((t) => t.teamId === teamId);
    return team?.tasks || [];
  },

  getTeamByExpert: (expertId) => {
    return get().teams.find((t) =>
      t.members.some((m) => m.expertId === expertId)
    ) || null;
  },

  getExpertRole: (teamId, expertId) => {
    const team = get().teams.find((t) => t.teamId === teamId);
    const member = team?.members.find((m) => m.expertId === expertId);
    return member?.role || null;
  },
}));
