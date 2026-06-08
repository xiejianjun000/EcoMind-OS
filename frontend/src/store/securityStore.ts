import { create } from 'zustand';
import type { SecurityAuditLog, AuditRule, ContentSafetyCheck, SecurityStats, AuditVerdict, AuditType } from '@/types/security';
import { DEFAULT_AUDIT_RULES } from '@/types/security';

function genId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`; }
function ts() { return new Date().toISOString(); }

interface SecurityState {
  auditLogs: SecurityAuditLog[];
  rules: AuditRule[];
  stats: SecurityStats;
  pendingReviews: SecurityAuditLog[];

  addAuditLog: (log: Omit<SecurityAuditLog, 'id' | 'createdAt'>) => string;
  reviewLog: (logId: string, reviewerId: string, newVerdict?: AuditVerdict) => void;
  addRule: (rule: Omit<AuditRule, 'id' | 'createdAt'>) => void;
  toggleRule: (ruleId: string) => void;
  deleteRule: (ruleId: string) => void;
  checkContent: (content: string, type: AuditType) => ContentSafetyCheck;
  getAuditBySession: (sessionId: string) => SecurityAuditLog[];
  getLogsByType: (type: AuditType) => SecurityAuditLog[];
  getPendingReviews: () => SecurityAuditLog[];
  refreshStats: () => void;
  clearAll: () => void;
}

function checkAgainstRules(content: string, type: AuditType, rules: AuditRule[]): { verdict: AuditVerdict; matchedRules: string[]; riskCategories: string[] } {
  const applicableRules = rules.filter(r => r.enabled && r.type === type);
  const matchedRules: string[] = [];
  const riskCategories: string[] = [];
  let maxAction: 'log' | 'flag' | 'block' = 'log';
  for (const rule of applicableRules) {
    try {
      if (new RegExp(rule.pattern, 'i').test(content)) {
        matchedRules.push(rule.id);
        riskCategories.push(rule.name);
        if (rule.action === 'block') maxAction = 'block';
        else if (rule.action === 'flag' && maxAction !== 'block') maxAction = 'flag';
      }
    } catch {}
  }
  const verdict: AuditVerdict = maxAction === 'block' ? 'block' : maxAction === 'flag' ? 'flag' : 'pass';
  return { verdict, matchedRules, riskCategories };
}

export const useSecurityStore = create<SecurityState>((set, get) => ({
  auditLogs: [],
  rules: DEFAULT_AUDIT_RULES,
  stats: { totalAudits: 0, byVerdict: { pass: 0, flag: 0, block: 0, pending_review: 0 }, byType: { prompt: 0, response: 0, skill: 0, tool_call: 0, file_access: 0 }, flaggedToday: 0, blockedToday: 0, pendingReview: 0 },
  pendingReviews: [],

  addAuditLog: (log) => {
    const id = genId();
    const now = ts();
    const newLog: SecurityAuditLog = { ...log, id, createdAt: now };
    set(s => {
      const logs = [newLog, ...s.auditLogs].slice(0, 1000);
      const stats = { ...s.stats, totalAudits: logs.length };
      stats.byVerdict = { ...stats.byVerdict, [newLog.verdict]: (stats.byVerdict[newLog.verdict] || 0) + 1 };
      stats.byType = { ...stats.byType, [newLog.type]: (stats.byType[newLog.type] || 0) + 1 };
      if (newLog.verdict === 'flag') stats.flaggedToday++;
      if (newLog.verdict === 'block') stats.blockedToday++;
      if (newLog.verdict === 'pending_review') stats.pendingReview++;
      return { auditLogs: logs, stats, pendingReviews: newLog.verdict === 'pending_review' ? [newLog, ...s.pendingReviews] : s.pendingReviews };
    });
    return id;
  },

  reviewLog: (logId, reviewerId, newVerdict) => set(s => {
    const logs = s.auditLogs.map(l => l.id === logId ? { ...l, reviewerId, reviewedAt: ts(), verdict: newVerdict || l.verdict } : l);
    return { auditLogs: logs, pendingReviews: s.pendingReviews.filter(l => l.id !== logId) };
  }),

  addRule: (rule) => {
    const id = genId();
    set(s => ({ rules: [...s.rules, { ...rule, id, createdAt: ts() }] }));
  },

  toggleRule: (ruleId) => set(s => ({
    rules: s.rules.map(r => r.id === ruleId ? { ...r, enabled: !r.enabled } : r),
  })),

  deleteRule: (ruleId) => set(s => ({ rules: s.rules.filter(r => r.id !== ruleId) })),

  checkContent: (content, type) => {
    const { verdict, matchedRules, riskCategories } = checkAgainstRules(content, type, get().rules);
    const riskLevel = verdict === 'block' ? 'critical' : verdict === 'flag' ? 'high' : matchedRules.length > 0 ? 'medium' : 'low';
    const details = verdict === 'pass' ? '内容通过安全检查' : `匹配规则: ${riskCategories.join(', ')}`;
    return { id: genId(), passed: verdict === 'pass', riskLevel, riskCategories, details, suggestions: verdict !== 'pass' ? ['建议人工复核', '检查内容合规性'] : undefined, checkedAt: ts() };
  },

  getAuditBySession: (sessionId) => get().auditLogs.filter(l => l.sessionId === sessionId),
  getLogsByType: (type) => get().auditLogs.filter(l => l.type === type),
  getPendingReviews: () => get().pendingReviews,
  refreshStats: () => {
    const logs = get().auditLogs;
    const today = new Date().toISOString().slice(0, 10);
    set({
      stats: {
        totalAudits: logs.length,
        byVerdict: { pass: logs.filter(l => l.verdict === 'pass').length, flag: logs.filter(l => l.verdict === 'flag').length, block: logs.filter(l => l.verdict === 'block').length, pending_review: logs.filter(l => l.verdict === 'pending_review').length },
        byType: { prompt: logs.filter(l => l.type === 'prompt').length, response: logs.filter(l => l.type === 'response').length, skill: logs.filter(l => l.type === 'skill').length, tool_call: logs.filter(l => l.type === 'tool_call').length, file_access: logs.filter(l => l.type === 'file_access').length },
        flaggedToday: logs.filter(l => l.verdict === 'flag' && l.createdAt.startsWith(today)).length,
        blockedToday: logs.filter(l => l.verdict === 'block' && l.createdAt.startsWith(today)).length,
        pendingReview: logs.filter(l => l.verdict === 'pending_review').length,
      },
    });
  },
  clearAll: () => set({ auditLogs: [], pendingReviews: [], stats: { totalAudits: 0, byVerdict: { pass: 0, flag: 0, block: 0, pending_review: 0 }, byType: { prompt: 0, response: 0, skill: 0, tool_call: 0, file_access: 0 }, flaggedToday: 0, blockedToday: 0, pendingReview: 0 } }),
}));
