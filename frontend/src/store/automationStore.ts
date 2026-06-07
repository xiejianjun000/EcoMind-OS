import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AutomationTask, AutomationRun, AutomationRunStatus, TriggerConfig, TaskQuota, RunLogStep } from '@/types/automation';
import { AUTOMATION_TEMPLATES } from '@/types/automation';

function genId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`; }
function ts() { return new Date().toISOString(); }

// ─── 默认配额 ───
const DEFAULT_QUOTA: TaskQuota = {
  maxRunsPerDay: 24,
  maxRunsPerMonth: 500,
  currentDayRuns: 0,
  currentMonthRuns: 0,
  lastResetDay: ts(),
  lastResetMonth: ts(),
};

// ─── 从旧 cronConfig 迁移到新 trigger ───
function migrateTrigger(task: any): TriggerConfig {
  if (task.trigger) return task.trigger;
  if (task.cronConfig) {
    const c = task.cronConfig;
    const cronMap: Record<string, string> = {
      hourly: `0 */1 * * *`,
      daily: `0 ${c.hour || 8} * * *`,
      weekly: `0 ${c.hour || 9} * * ${c.dayOfWeek || 1}`,
      monthly: `0 ${c.hour || 8} ${c.dayOfMonth || 1} * *`,
    };
    return {
      type: 'cron',
      cron: c.cronExpression || cronMap[c.frequency] || '0 8 * * *',
      frequency: c.frequency,
      hour: c.hour,
      minute: c.minute,
      dayOfWeek: c.dayOfWeek,
      dayOfMonth: c.dayOfMonth,
      timezone: c.timezone || 'Asia/Shanghai',
    };
  }
  return { type: 'manual' };
}

// ─── 格式化 cron 显示 ───
export function formatScheduleDisplay(trigger: TriggerConfig): string {
  if (trigger.type === 'email') {
    const f = trigger.emailFilter;
    const parts: string[] = [];
    if (f?.from) parts.push(`发件人:${f.from}`);
    if (f?.subject) parts.push(`主题:${f.subject}`);
    if (f?.hasAttachment) parts.push('含附件');
    return `📧 邮件触发${parts.length ? ' · ' + parts.join(' · ') : ''}`;
  }
  if (trigger.type === 'webhook') return '🔗 Webhook';
  if (trigger.type === 'manual') return '👆 手动触发';

  if (!trigger.cron) {
    const fr = trigger.frequency || 'daily';
    if (fr === 'hourly') return '每小时';
    if (fr === 'daily') return `每天 ${String(trigger.hour || 8).padStart(2, '0')}:${String(trigger.minute || 0).padStart(2, '0')}`;
    if (fr === 'weekly') return `每周${['日','一','二','三','四','五','六'][trigger.dayOfWeek || 1]} ${String(trigger.hour || 9).padStart(2, '0')}:${String(trigger.minute || 0).padStart(2, '0')}`;
    return `每月${trigger.dayOfMonth || 1}日`;
  }
  const cron = trigger.cron;
  // 简单 cron 解析
  if (cron === '0 */1 * * *' || cron.startsWith('0 */')) return `每${cron.split('/')[1]?.replace(' * * *','') || '1'}小时`;
  if (cron.endsWith('* * 1')) return '每周一';
  if (cron.endsWith('* * 3')) return '每周三';
  const parts = cron.split(' ');
  if (parts.length >= 5) {
    const min = parts[0], hour = parts[1], dom = parts[2], dow = parts[4];
    if (dom !== '*') return `每月${dom}日 ${hour}:${min.padStart(2,'0')}`;
    if (dow !== '*') return `每周${['日','一','二','三','四','五','六'][Number(dow)]} ${hour}:${min.padStart(2,'0')}`;
    return `每天 ${hour}:${min.padStart(2,'0')}`;
  }
  return `Cron: ${cron}`;
}

interface AutomationState {
  tasks: AutomationTask[];
  runs: Record<string, AutomationRun[]>;
  activeTaskId: string | null;

  // CRUD
  createTask: (data: {
    name: string; description?: string;
    trigger: TriggerConfig; expertId?: string; promptTemplate: string;
    toolSteps?: any[]; notifyChannels?: any[];
  }) => string;
  createFromTemplate: (templateId: string) => string;
  updateTask: (taskId: string, updates: Partial<AutomationTask>) => void;
  deleteTask: (taskId: string) => void;
  toggleTaskStatus: (taskId: string) => void;
  archiveTask: (taskId: string) => void;

  // 执行
  runTaskNow: (taskId: string, triggerType?: string, triggerEmail?: { from: string; subject: string; hasAttachment: boolean }) => string;
  addRun: (taskId: string, run: AutomationRun) => void;
  updateRun: (taskId: string, runId: string, updates: Partial<AutomationRun>) => void;
  addLogStep: (taskId: string, runId: string, step: RunLogStep) => void;

  // 配额
  checkQuota: (taskId: string) => boolean;
  resetQuotaIfNeeded: (taskId: string) => void;

  // 查询
  getTaskRuns: (taskId: string) => AutomationRun[];
  getActiveTasks: () => AutomationTask[];
  getScheduledTasks: () => AutomationTask[];
  clearAll: () => void;
}

export const useAutomationStore = create<AutomationState>()(persist((set, get) => ({
  tasks: [],
  runs: {},
  activeTaskId: null,

  createTask: (data) => {
    const id = genId();
    const now = ts();
    const task: AutomationTask = {
      id, name: data.name, description: data.description,
      status: 'active',
      trigger: data.trigger,
      expertId: data.expertId,
      promptTemplate: data.promptTemplate,
      toolSteps: data.toolSteps,
      notifyChannels: data.notifyChannels,
      quota: { ...DEFAULT_QUOTA },
      totalRuns: 0,
      createdAt: now, updatedAt: now,
    };
    set(s => ({ tasks: [task, ...s.tasks], runs: { ...s.runs, [id]: [] } }));
    return id;
  },

  createFromTemplate: (templateId) => {
    const tmpl = AUTOMATION_TEMPLATES.find(t => t.id === templateId);
    if (!tmpl) return '';
    return get().createTask({
      name: tmpl.name,
      description: tmpl.description,
      trigger: (tmpl.defaultConfig.trigger || { type: 'cron' as const, cron: '0 8 * * *', timezone: 'Asia/Shanghai' }) as TriggerConfig,
      promptTemplate: tmpl.defaultConfig.promptTemplate || '',
      expertId: tmpl.defaultConfig.expertId,
      toolSteps: tmpl.defaultConfig.toolSteps,
      notifyChannels: tmpl.defaultConfig.notifyChannels,
    });
  },

  updateTask: (taskId, updates) => set(s => ({
    tasks: s.tasks.map(t => t.id === taskId ? { ...t, ...updates, updatedAt: ts() } as AutomationTask : t),
  })),

  deleteTask: (taskId) => set(s => {
    const { [taskId]: _, ...restRuns } = s.runs;
    return { tasks: s.tasks.filter(t => t.id !== taskId), runs: restRuns, activeTaskId: s.activeTaskId === taskId ? null : s.activeTaskId };
  }),

  toggleTaskStatus: (taskId) => set(s => ({
    tasks: s.tasks.map(t => t.id === taskId ? { ...t, status: t.status === 'active' ? 'paused' : 'active' as any, updatedAt: ts() } : t),
  })),

  archiveTask: (taskId) => set(s => ({
    tasks: s.tasks.map(t => t.id === taskId ? { ...t, status: 'ended' as any, updatedAt: ts() } : t),
  })),

  runTaskNow: (taskId, triggerType = 'manual', triggerEmail) => {
    const task = get().tasks.find(t => t.id === taskId);
    if (!task) return '';

    // 配额检查
    if (!get().checkQuota(taskId)) return '';

    const runId = genId();
    const now = ts();
    const run: AutomationRun = {
      id: runId, taskId, taskName: task.name,
      status: 'in_progress',
      startedAt: now,
      triggerType: triggerType as any,
      progress: 0,
      logSteps: [],
      triggerEmail,
    };

    set(s => {
      const existing = s.runs[taskId] || [];
      const updatedTask = {
        ...task,
        totalRuns: task.totalRuns + 1,
        lastRunAt: now,
        lastRunStatus: 'in_progress' as AutomationRunStatus,
        updatedAt: now,
        quota: task.quota ? {
          ...task.quota,
          currentDayRuns: task.quota.currentDayRuns + 1,
          currentMonthRuns: task.quota.currentMonthRuns + 1,
        } : undefined,
      };
      return {
        runs: { ...s.runs, [taskId]: [run, ...existing] },
        tasks: s.tasks.map(t => t.id === taskId ? updatedTask : t),
      };
    });

    // 模拟执行过程 (逐步添加日志)
    const steps: RunLogStep[] = [
      { timestamp: now, type: 'info', message: `🔵 任务触发: ${triggerType === 'email' ? `收到邮件 ${triggerEmail?.from || ''}` : '手动执行'}` },
      { timestamp: ts(), type: 'info', message: '🔍 开始分析任务参数...' },
    ];

    let stepIndex = 0;
    const interval = setInterval(() => {
      if (stepIndex < steps.length) {
        get().addLogStep(taskId, runId, steps[stepIndex]);
        get().updateRun(taskId, runId, { progress: Math.min(90, (stepIndex + 1) * 30) });
        stepIndex++;
      } else {
        clearInterval(interval);
        // 模拟 AI 执行
        setTimeout(() => {
          get().addLogStep(taskId, runId, { timestamp: ts(), type: 'llm', message: `🤖 AI 开始处理: ${task.promptTemplate.slice(0, 80)}...` });
          get().updateRun(taskId, runId, { progress: 50 });
        }, 800);

        setTimeout(() => {
          if (task.toolSteps?.length) {
            task.toolSteps.forEach((toolStep, i) => {
              setTimeout(() => {
                get().addLogStep(taskId, runId, { timestamp: ts(), type: 'tool_call', message: `🔧 调用工具: ${toolStep.toolName} — ${toolStep.description}` });
              }, i * 500);
            });
          }
          get().updateRun(taskId, runId, { progress: 80 });
        }, 1600);

        setTimeout(() => {
          get().addLogStep(taskId, runId, { timestamp: ts(), type: 'result', message: '✅ 任务执行完成，结果已生成' });
          get().updateRun(taskId, runId, { status: 'succeeded', finishedAt: ts(), progress: 100 });
          set(s => ({
            tasks: s.tasks.map(t => t.id === taskId ? { ...t, lastRunStatus: 'succeeded' as AutomationRunStatus, updatedAt: ts() } : t),
          }));
        }, 3000);
      }
    }, 400);

    return runId;
  },

  addRun: (taskId, run) => set(s => {
    const existing = s.runs[taskId] || [];
    return { runs: { ...s.runs, [taskId]: [run, ...existing] } };
  }),

  updateRun: (taskId, runId, updates) => set(s => {
    const runs = s.runs[taskId] || [];
    return { runs: { ...s.runs, [taskId]: runs.map(r => r.id === runId ? { ...r, ...updates } : r) } };
  }),

  addLogStep: (taskId, runId, step) => set(s => {
    const runs = s.runs[taskId] || [];
    return {
      runs: {
        ...s.runs,
        [taskId]: runs.map(r => r.id === runId ? { ...r, logSteps: [...(r.logSteps || []), step] } : r),
      },
    };
  }),

  checkQuota: (taskId) => {
    const task = get().tasks.find(t => t.id === taskId);
    if (!task?.quota) return true;
    get().resetQuotaIfNeeded(taskId);
    const q = get().tasks.find(t => t.id === taskId)?.quota;
    if (!q) return true;
    if (q.currentDayRuns >= q.maxRunsPerDay) return false;
    if (q.currentMonthRuns >= q.maxRunsPerMonth) return false;
    return true;
  },

  resetQuotaIfNeeded: (taskId) => {
    const task = get().tasks.find(t => t.id === taskId);
    if (!task?.quota) return;
    const now = new Date();
    const lastDay = new Date(task.quota.lastResetDay);
    const lastMonth = new Date(task.quota.lastResetMonth);
    if (now.toDateString() !== lastDay.toDateString()) {
      set(s => ({
        tasks: s.tasks.map(t => t.id === taskId ? { ...t, quota: { ...t.quota!, currentDayRuns: 0, lastResetDay: ts() } } : t),
      }));
    }
    if (now.getMonth() !== lastMonth.getMonth() || now.getFullYear() !== lastMonth.getFullYear()) {
      set(s => ({
        tasks: s.tasks.map(t => t.id === taskId ? { ...t, quota: { ...t.quota!, currentMonthRuns: 0, lastResetMonth: ts() } } : t),
      }));
    }
  },

  getTaskRuns: (taskId) => get().runs[taskId] || [],

  getActiveTasks: () => get().tasks.filter(t => t.status === 'active'),
  getScheduledTasks: () => get().tasks.filter(t => t.status === 'active'),

  clearAll: () => set({ tasks: [], runs: {}, activeTaskId: null }),
}), {
  name: 'ecomind-automation-v8',
  version: 2,
  partialize: s => ({ tasks: s.tasks, runs: s.runs }),
  // 迁移旧数据
  migrate: (persisted: any, version: number) => {
    if (version < 2 && persisted?.tasks) {
      return {
        ...persisted,
        tasks: persisted.tasks.map((t: any) => ({
          ...t,
          trigger: t.trigger || migrateTrigger(t),
          quota: t.quota || { ...DEFAULT_QUOTA },
        })),
      };
    }
    return persisted as any;
  },
}));
