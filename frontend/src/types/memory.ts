/**
 * Memory & Dreaming 记忆与梦境系统类型 — v7.0
 * 灵感来源: QClaw Dreaming System
 * 适配: 环境监测数据自动回顾、趋势分析、知识提取
 */

export type DreamPhase = 'light' | 'deep';
export type DreamingStatus = 'idle' | 'running' | 'completed' | 'failed';

export interface DreamingConfig {
  enabled: boolean;
  frequency: string; // cron expression
  timezone: string;
  lightPhase: { lookbackDays: number; limit: number };
  deepPhase: { limit: number; minScore: number; minRecallCount: number; minUniqueQueries: number };
}

export interface DreamDiaryEntry {
  id: string;
  agentId: string;
  phase: DreamPhase;
  date: string;
  summary: string;
  keyFindings: string[];
  actionableItems: string[];
  relatedMemoryIds: string[];
  score: number;
  createdAt: string;
}

export interface LongTermMemory {
  id: string;
  agentId: string;
  type: 'fact' | 'insight' | 'relationship' | 'preference' | 'alert';
  content: string;
  source: { sessionId?: string; artifactId?: string; diaryId?: string };
  confidence: number;
  recallCount: number;
  lastRecalledAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DailyFileRecord {
  id: string;
  name: string;
  path: string;
  size: number;
  type: 'report' | 'log' | 'data' | 'chart';
  date: string;
  summary?: string;
  createdAt: string;
}

export interface DreamingPhaseDetails {
  phase: DreamPhase;
  status: DreamingStatus;
  startedAt?: string;
  completedAt?: string;
  itemsProcessed: number;
  itemsTotal: number;
  newMemories: number;
  updatedMemories: number;
  error?: string;
}

export interface MemoryStats {
  totalMemories: number;
  byType: Record<string, number>;
  averageConfidence: number;
  lastDreamingAt?: string;
  oldestMemoryAt?: string;
}

export const DEFAULT_DREAMING_CONFIG: DreamingConfig = {
  enabled: false,
  frequency: '0 3 * * *',
  timezone: 'Asia/Shanghai',
  lightPhase: { lookbackDays: 20, limit: 1000 },
  deepPhase: { limit: 100, minScore: 0.5, minRecallCount: 2, minUniqueQueries: 3 },
};
