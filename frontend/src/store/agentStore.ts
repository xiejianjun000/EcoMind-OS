import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  AgentProfile,
  AgentMemory,
  AgentSkill,
  AgentWorkspace,
  WorkspaceTask,
  WorkspaceDraft,
  EvolutionLog,
  EvolutionMetrics,
  KnowledgeBase,
  SkillMarketEntry,
} from '@/types/agent';

// ============================================================
// Default Agent Profile (张处长·执法监察)
// ============================================================

const DEFAULT_PROFILE: AgentProfile = {
  agentId: 'zhang_chufa_01',
  userId: 'zhang_weimin',
  displayName: '执法助手·张处长',
  role: 'chief',
  department: '执法监察处',
  departmentId: 'dept_enforcement',
  jurisdiction: ['长沙市', '株洲市', '湘潭市'],
  traits: {
    rigor: 0.90,
    efficiency: 0.75,
    caution: 0.65,
    creativity: 0.30,
    empathy: 0.50,
  },
  values: {
    ruleOfLaw: 0.95,
    servePublic: 0.85,
    efficiencyFirst: 0.60,
    dataDriven: 0.90,
    collaborative: 0.70,
  },
  constraints: {
    maxApprovalLevel: 'L2',
    cannotOverride: ['人事任免', '预算审批', '刑事立案'],
    dataScope: 'department',
    requireHumanSignoff: true,
  },
  model: {
    local: 'qwen2.5-7b-q4_k_m',
    center: 'ecomind-pro-72b',
    loraAdapter: 'zhang_chufa_lora_v3',
    fallback: 'qwen2.5-3b-q4_k_m',
  },
  createdAt: new Date().toISOString(),
  evolvedAt: new Date().toISOString(),
  evolutionCount: 0,
};

// ============================================================
// State Interface
// ============================================================

interface AgentStoreState {
  // --- Profile ---
  profile: AgentProfile;
  updateProfile: (updates: Partial<AgentProfile>) => void;
  updateTraits: (traits: Partial<AgentProfile['traits']>) => void;
  updateValues: (values: Partial<AgentProfile['values']>) => void;

  // --- Knowledge ---
  knowledgeBases: KnowledgeBase[];
  addKnowledgeBase: (kb: KnowledgeBase) => void;
  removeKnowledgeBase: (id: string) => void;

  // --- Memory ---
  memories: AgentMemory[];
  addMemory: (memory: Omit<AgentMemory, 'id' | 'createdAt'>) => void;
  recallMemories: (query: { type?: string; tags?: string[]; minImportance?: number; limit?: number }) => AgentMemory[];
  forgetMemories: (olderThanDays: number) => void;

  // --- Skills ---
  skills: AgentSkill[];
  addSkill: (skill: Omit<AgentSkill, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateSkill: (id: string, updates: Partial<AgentSkill>) => void;
  archiveSkill: (id: string) => void;
  getActiveSkills: () => AgentSkill[];

  // --- Workspace ---
  workspace: AgentWorkspace;
  addTask: (task: Omit<WorkspaceTask, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateTask: (id: string, updates: Partial<WorkspaceTask>) => void;
  moveTaskToArchive: (id: string) => void;
  addDraft: (draft: Omit<WorkspaceDraft, 'id'>) => void;
  updateDraft: (id: string, content: string) => void;
  removeDraft: (id: string) => void;

  // --- Evolution ---
  evolutionLog: EvolutionLog[];
  metrics: EvolutionMetrics;
  logEvolution: (entry: Omit<EvolutionLog, 'id' | 'createdAt'>) => void;
  updateMetrics: (updates: Partial<EvolutionMetrics>) => void;

  // --- Skill Market ---
  marketSkills: SkillMarketEntry[];
  publishToMarket: (entry: Omit<SkillMarketEntry, 'id' | 'publishedAt'>) => void;
  subscribeFromMarket: (skillId: string) => void;
}

// ============================================================
// Helpers
// ============================================================

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ============================================================
// Store
// ============================================================

export const useAgentStore = create<AgentStoreState>()(
  persist(
    (set, get) => ({
      // --- Profile ---
      profile: DEFAULT_PROFILE,

      updateProfile: (updates) =>
        set((state) => ({
          profile: { ...state.profile, ...updates, evolvedAt: new Date().toISOString() },
        })),

      updateTraits: (traits) =>
        set((state) => ({
          profile: {
            ...state.profile,
            traits: { ...state.profile.traits, ...traits },
            evolvedAt: new Date().toISOString(),
          },
        })),

      updateValues: (values) =>
        set((state) => ({
          profile: {
            ...state.profile,
            values: { ...state.profile.values, ...values },
            evolvedAt: new Date().toISOString(),
          },
        })),

      // --- Knowledge ---
      knowledgeBases: [],

      addKnowledgeBase: (kb) =>
        set((state) => ({
          knowledgeBases: [...state.knowledgeBases, kb],
        })),

      removeKnowledgeBase: (id) =>
        set((state) => ({
          knowledgeBases: state.knowledgeBases.filter((k) => k.id !== id),
        })),

      // --- Memory ---
      memories: [],

      addMemory: (memory) => {
        const now = new Date().toISOString();
        const newMemory: AgentMemory = {
          ...memory,
          id: generateId(),
          createdAt: now,
        };
        set((state) => ({
          memories: [newMemory, ...state.memories].slice(0, 1000), // Keep last 1000
        }));
      },

      recallMemories: (query) => {
        const { memories } = get();
        let results = [...memories];

        if (query.type) {
          results = results.filter((m) => m.type === query.type);
        }
        if (query.tags && query.tags.length > 0) {
          results = results.filter((m) =>
            query.tags!.some((tag) => m.tags.includes(tag))
          );
        }
        if (query.minImportance !== undefined) {
          results = results.filter((m) => m.importance >= query.minImportance!);
        }

        // Sort by importance * confidence, descending
        results.sort((a, b) =>
          (b.importance * b.confidence) - (a.importance * a.confidence)
        );

        return results.slice(0, query.limit || 20);
      },

      forgetMemories: (olderThanDays) => {
        const cutoff = Date.now() - olderThanDays * 86400000;
        set((state) => ({
          memories: state.memories.filter(
            (m) => new Date(m.createdAt).getTime() > cutoff || m.importance > 0.8
          ),
        }));
      },

      // --- Skills ---
      skills: [],

      addSkill: (skill) => {
        const now = new Date().toISOString();
        const newSkill: AgentSkill = {
          ...skill,
          id: `skill-${generateId()}`,
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          skills: [...state.skills, newSkill],
        }));
      },

      updateSkill: (id, updates) =>
        set((state) => ({
          skills: state.skills.map((s) =>
            s.id === id ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s
          ),
        })),

      archiveSkill: (id) =>
        set((state) => ({
          skills: state.skills.map((s) =>
            s.id === id ? { ...s, status: 'archived' as const, updatedAt: new Date().toISOString() } : s
          ),
        })),

      getActiveSkills: () => {
        return get().skills.filter((s) => s.status === 'active');
      },

      // --- Workspace ---
      workspace: {
        inbox: [],
        current: [],
        drafts: [],
        review: [],
        archive: [],
      },

      addTask: (task) => {
        const now = new Date().toISOString();
        const newTask: WorkspaceTask = {
          ...task,
          id: generateId(),
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          workspace: {
            ...state.workspace,
            inbox: [newTask, ...state.workspace.inbox],
          },
        }));
      },

      updateTask: (id, updates) =>
        set((state) => {
          const updateInList = (list: WorkspaceTask[]) =>
            list.map((t) => (t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t));

          return {
            workspace: {
              ...state.workspace,
              inbox: updateInList(state.workspace.inbox),
              current: updateInList(state.workspace.current),
            },
          };
        }),

      moveTaskToArchive: (id) =>
        set((state) => {
          const task =
            [...state.workspace.inbox, ...state.workspace.current].find((t) => t.id === id);
          if (!task) return state;

          const archivedTask = { ...task, status: 'done' as const, updatedAt: new Date().toISOString() };
          return {
            workspace: {
              ...state.workspace,
              inbox: state.workspace.inbox.filter((t) => t.id !== id),
              current: state.workspace.current.filter((t) => t.id !== id),
              archive: [archivedTask, ...state.workspace.archive].slice(0, 500),
            },
          };
        }),

      addDraft: (draft) => {
        const newDraft: WorkspaceDraft = {
          ...draft,
          id: generateId(),
        };
        set((state) => ({
          workspace: {
            ...state.workspace,
            drafts: [newDraft, ...state.workspace.drafts],
          },
        }));
      },

      updateDraft: (id, content) =>
        set((state) => ({
          workspace: {
            ...state.workspace,
            drafts: state.workspace.drafts.map((d) =>
              d.id === id
                ? { ...d, content, lastEditedAt: new Date().toISOString(), autoSaveCount: d.autoSaveCount + 1 }
                : d
            ),
          },
        })),

      removeDraft: (id) =>
        set((state) => ({
          workspace: {
            ...state.workspace,
            drafts: state.workspace.drafts.filter((d) => d.id !== id),
          },
        })),

      // --- Evolution ---
      evolutionLog: [],
      metrics: {
        quality: { approvalPassRate: 0.87, userCorrectionRate: 0.12, satisfactionScore: 4.3 },
        efficiency: { avgResponseTimeMs: 2300, taskCompletionRate: 0.93, autoResolutionRate: 0.76 },
        growth: { skillsGenerated: 0, skillsAdoptedByOthers: 0, knowledgeItemsExtracted: 0 },
      },

      logEvolution: (entry) => {
        const newEntry: EvolutionLog = {
          ...entry,
          id: generateId(),
          createdAt: new Date().toISOString(),
        };
        set((state) => ({
          evolutionLog: [newEntry, ...state.evolutionLog].slice(0, 200),
          profile: {
            ...state.profile,
            evolutionCount: state.profile.evolutionCount + 1,
            evolvedAt: new Date().toISOString(),
          },
        }));
      },

      updateMetrics: (updates) =>
        set((state) => ({
          metrics: {
            ...state.metrics,
            ...updates,
            quality: { ...state.metrics.quality, ...(updates.quality || {}) },
            efficiency: { ...state.metrics.efficiency, ...(updates.efficiency || {}) },
            growth: { ...state.metrics.growth, ...(updates.growth || {}) },
          },
        })),

      // --- Skill Market ---
      marketSkills: [],

      publishToMarket: (entry) => {
        const newEntry: SkillMarketEntry = {
          ...entry,
          id: generateId(),
          publishedAt: new Date().toISOString(),
        };
        set((state) => ({
          marketSkills: [...state.marketSkills, newEntry],
        }));
        // Also update the skill to mark as shared
        const state = get();
        state.updateSkill(entry.skillId, { status: 'active' });
      },

      subscribeFromMarket: (skillId) => {
        // In a real implementation, this would fetch the skill from NATS
        // For now, mark the market entry as having one more subscriber
        set((state) => ({
          marketSkills: state.marketSkills.map((e) =>
            e.skillId === skillId ? { ...e, subscriberCount: e.subscriberCount + 1 } : e
          ),
        }));
      },
    }),
    {
      name: 'ecomind-agent-storage',
      partialize: (state) => ({
        profile: state.profile,
        knowledgeBases: state.knowledgeBases,
        memories: state.memories.slice(0, 100),
        skills: state.skills,
        evolutionLog: state.evolutionLog.slice(0, 50),
        metrics: state.metrics,
      }),
    }
  )
);
