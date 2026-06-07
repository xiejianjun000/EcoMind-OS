import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DreamingConfig, DreamDiaryEntry, LongTermMemory, DailyFileRecord, DreamingPhaseDetails, MemoryStats, DreamingStatus } from '@/types/memory';
import { DEFAULT_DREAMING_CONFIG } from '@/types/memory';

function genId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`; }
function ts() { return new Date().toISOString(); }

interface MemoryState {
  config: DreamingConfig;
  diaryEntries: DreamDiaryEntry[];
  longTermMemories: LongTermMemory[];
  dailyFiles: DailyFileRecord[];
  dreamingStatus: DreamingStatus;
  phaseDetails: DreamingPhaseDetails | null;
  stats: MemoryStats;

  setConfig: (config: Partial<DreamingConfig>) => void;
  toggleDreaming: () => void;
  addDiaryEntry: (entry: Omit<DreamDiaryEntry, 'id' | 'createdAt'>) => void;
  addMemory: (memory: Omit<LongTermMemory, 'id' | 'createdAt' | 'updatedAt' | 'recallCount'>) => void;
  recallMemory: (memoryId: string) => void;
  addDailyFile: (file: Omit<DailyFileRecord, 'id' | 'createdAt'>) => void;
  getMemoriesByAgent: (agentId: string) => LongTermMemory[];
  getDiaryByAgent: (agentId: string) => DreamDiaryEntry[];
  runDreaming: (agentId: string) => Promise<void>;
  clearAgentMemory: (agentId: string) => void;
  clearAll: () => void;
}

export const useMemoryStore = create<MemoryState>()(persist((set, get) => ({
  config: DEFAULT_DREAMING_CONFIG,
  diaryEntries: [],
  longTermMemories: [],
  dailyFiles: [],
  dreamingStatus: 'idle',
  phaseDetails: null,
  stats: { totalMemories: 0, byType: {}, averageConfidence: 0, lastDreamingAt: undefined, oldestMemoryAt: undefined },

  setConfig: (cfg) => set(s => ({ config: { ...s.config, ...cfg } })),
  toggleDreaming: () => set(s => ({ config: { ...s.config, enabled: !s.config.enabled } })),

  addDiaryEntry: (entry) => {
    const id = genId();
    set(s => ({ diaryEntries: [{ ...entry, id, createdAt: ts() }, ...s.diaryEntries] }));
  },

  addMemory: (memory) => {
    const id = genId();
    const now = ts();
    set(s => {
      const updated = [{ ...memory, id, recallCount: 0, createdAt: now, updatedAt: now }, ...s.longTermMemories];
      const byType = { ...s.stats.byType };
      byType[memory.type] = (byType[memory.type] || 0) + 1;
      return {
        longTermMemories: updated,
        stats: { ...s.stats, totalMemories: updated.length, byType, averageConfidence: updated.reduce((a, m) => a + m.confidence, 0) / updated.length, oldestMemoryAt: s.stats.oldestMemoryAt || now },
      };
    });
  },

  recallMemory: (memoryId) => set(s => ({
    longTermMemories: s.longTermMemories.map(m => m.id === memoryId ? { ...m, recallCount: m.recallCount + 1, lastRecalledAt: ts() } : m),
  })),

  addDailyFile: (file) => {
    const id = genId();
    set(s => ({ dailyFiles: [{ ...file, id, createdAt: ts() }, ...s.dailyFiles] }));
  },

  getMemoriesByAgent: (agentId) => get().longTermMemories.filter(m => m.agentId === agentId),
  getDiaryByAgent: (agentId) => get().diaryEntries.filter(d => d.agentId === agentId),

  runDreaming: async (agentId) => {
    set({ dreamingStatus: 'running', phaseDetails: { phase: 'light', status: 'running', startedAt: ts(), itemsProcessed: 0, itemsTotal: 100, newMemories: 0, updatedMemories: 0 } });
    // Simulate light phase
    await new Promise(r => setTimeout(r, 1500));
    set(s => ({ phaseDetails: { ...s.phaseDetails!, phase: 'light', status: 'completed', completedAt: ts(), itemsProcessed: 80, newMemories: 3, updatedMemories: 5 } }));
    // Simulate deep phase
    set(s => ({ phaseDetails: { phase: 'deep', status: 'running', startedAt: ts(), itemsProcessed: 0, itemsTotal: 50, newMemories: 0, updatedMemories: 0 } }));
    await new Promise(r => setTimeout(r, 2000));
    set(s => ({
      dreamingStatus: 'completed',
      phaseDetails: { phase: 'deep', status: 'completed', startedAt: s.phaseDetails?.startedAt, completedAt: ts(), itemsProcessed: 50, itemsTotal: 50, newMemories: 2, updatedMemories: 8 },
      stats: { ...s.stats, lastDreamingAt: ts() },
    }));
    // Generate diary entry
    get().addDiaryEntry({ agentId, phase: 'deep', date: new Date().toISOString().slice(0, 10), summary: `自动化回顾完成：发现 ${3 + 2} 条新洞察，更新了 ${5 + 8} 条记忆`, keyFindings: ['监测数据趋势稳定', '未发现异常排放模式', '建议关注湘江流域水质变化'], actionableItems: ['更新监测计划', '加强流域巡查频次'], relatedMemoryIds: [], score: 0.85 });
  },

  clearAgentMemory: (agentId) => set(s => ({
    longTermMemories: s.longTermMemories.filter(m => m.agentId !== agentId),
    diaryEntries: s.diaryEntries.filter(d => d.agentId !== agentId),
  })),
  clearAll: () => set({ diaryEntries: [], longTermMemories: [], dailyFiles: [], dreamingStatus: 'idle', phaseDetails: null, stats: { totalMemories: 0, byType: {}, averageConfidence: 0 } }),
}), { name: 'ecomind-memory', partialize: s => ({ config: s.config, diaryEntries: s.diaryEntries.slice(0, 50), longTermMemories: s.longTermMemories.slice(0, 100), dailyFiles: s.dailyFiles.slice(0, 50) }) }));
