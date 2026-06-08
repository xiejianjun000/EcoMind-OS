/**
 * Email Connector Store — 邮箱作为 Agent 通信管道 (v8.0)
 *
 * 参考: QClaw imap-smtp-email MCP tool + Coze email trigger
 *
 * 智能体通过邮箱:
 *   📥 接收任务 (监听收件箱 → 触发 Agent 工作流)
 *   📤 发送报告 (Agent 生成报告 → 邮件发送)
 *   📎 传输文件 (附件上传/下载)
 *   🔔 通知推送 (阈值告警 → 邮件通知)
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

function genId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`; }
function ts() { return new Date().toISOString(); }

// ─── 类型 ───

export interface EmailAccount {
  id: string;
  provider: 'qq' | '163' | 'gmail' | 'outlook' | 'custom';
  email: string;
  displayName: string;
  connected: boolean;
  imapHost?: string;
  smtpHost?: string;
  lastSyncAt?: string;
  createdAt: string;
}

export interface AgentEmailRule {
  id: string;
  agentId: string;
  agentName: string;
  enabled: boolean;
  /** 触发条件 */
  conditions: {
    fromContains?: string;
    subjectContains?: string;
    bodyContains?: string;
    hasAttachment?: boolean;
  };
  /** 动作 */
  action: 'forward_to_agent' | 'auto_reply' | 'create_task' | 'extract_and_analyze';
  /** 回复模板 */
  replyTemplate?: string;
  createdAt: string;
}

export interface EmailMessage {
  id: string;
  accountId: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  hasAttachments: boolean;
  attachments?: { name: string; size: number; type: string }[];
  read: boolean;
  agentProcessed: boolean;
  agentProcessedBy?: string;
  receivedAt: string;
}

export interface AgentEmailLog {
  id: string;
  agentId: string;
  agentName: string;
  direction: 'incoming' | 'outgoing';
  subject: string;
  summary: string;
  hasAttachment: boolean;
  taskCreated?: string;
  timestamp: string;
}

// ─── Store ───

interface EmailConnectorState {
  accounts: EmailAccount[];
  rules: AgentEmailRule[];
  messages: EmailMessage[];
  logs: AgentEmailLog[];
  syncing: boolean;

  // 账号
  addAccount: (account: Omit<EmailAccount, 'id' | 'connected' | 'lastSyncAt' | 'createdAt'>) => string;
  removeAccount: (id: string) => void;
  toggleAccount: (id: string) => void;

  // 规则
  addRule: (rule: Omit<AgentEmailRule, 'id' | 'createdAt'>) => string;
  updateRule: (id: string, updates: Partial<AgentEmailRule>) => void;
  deleteRule: (id: string) => void;
  toggleRule: (id: string) => void;

  // 消息
  addMessage: (msg: Omit<EmailMessage, 'id' | 'read' | 'agentProcessed'>) => string;
  markProcessed: (msgId: string, agentId: string) => void;

  // 日志
  addLog: (log: Omit<AgentEmailLog, 'id' | 'timestamp'>) => void;

  // 模拟同步
  syncEmails: () => void;

  clearAll: () => void;
}

export const useEmailConnectorStore = create<EmailConnectorState>()(persist((set, get) => ({
  accounts: [],
  rules: [],
  messages: [],
  logs: [],
  syncing: false,

  addAccount: (account) => {
    const id = genId();
    set(s => ({
      accounts: [...s.accounts, { ...account, id, connected: true, createdAt: ts(), lastSyncAt: ts() }],
    }));
    return id;
  },

  removeAccount: (id) => set(s => ({
    accounts: s.accounts.filter(a => a.id !== id),
    rules: s.rules.filter(r => {
      // 清理关联规则...简化处理
      return true;
    }),
  })),

  toggleAccount: (id) => set(s => ({
    accounts: s.accounts.map(a => a.id === id ? { ...a, connected: !a.connected, lastSyncAt: a.connected ? undefined : ts() } : a),
  })),

  addRule: (rule) => {
    const id = genId();
    set(s => ({ rules: [...s.rules, { ...rule, id, createdAt: ts() }] }));
    return id;
  },

  updateRule: (id, updates) => set(s => ({
    rules: s.rules.map(r => r.id === id ? { ...r, ...updates } : r),
  })),

  deleteRule: (id) => set(s => ({
    rules: s.rules.filter(r => r.id !== id),
  })),

  toggleRule: (id) => set(s => ({
    rules: s.rules.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r),
  })),

  addMessage: (msg) => {
    const id = genId();
    set(s => ({ messages: [{ ...msg, id, read: false, agentProcessed: false }, ...s.messages].slice(0, 100) }));
    return id;
  },

  markProcessed: (msgId, agentId) => set(s => ({
    messages: s.messages.map(m => m.id === msgId ? { ...m, agentProcessed: true, agentProcessedBy: agentId } : m),
  })),

  addLog: (log) => {
    set(s => ({
      logs: [{ ...log, id: genId(), timestamp: ts() }, ...s.logs].slice(0, 200),
    }));
  },

  syncEmails: () => {
    set({ syncing: true });
    // 模拟同步收件箱
    const mockEmails: Omit<EmailMessage, 'id' | 'read' | 'agentProcessed'>[] = [
      { accountId: get().accounts[0]?.id || '', from: 'monitor@env.gov.cn', to: 'agent@ecomind.cn', subject: '【巡检】湘江流域5月水质数据', body: '附件为5月湘江流域12个监测站的水质数据，请分析异常指标...', hasAttachments: true, attachments: [{ name: '湘江水质5月.xlsx', size: 245000, type: 'xlsx' }], receivedAt: ts() },
      { accountId: get().accounts[0]?.id || '', from: 'enforcement@env.gov.cn', to: 'agent@ecomind.cn', subject: '【任务】审核案卷 EJ-2026-0612', body: '请审核以下执法案卷的合规性...', hasAttachments: true, attachments: [{ name: '案卷EJ-2026-0612.pdf', size: 1800000, type: 'pdf' }], receivedAt: ts() },
    ];

    setTimeout(() => {
      mockEmails.forEach(msg => get().addMessage(msg));
      set({ syncing: false });

      // 触发匹配的规则
      const activeRules = get().rules.filter(r => r.enabled);
      mockEmails.forEach(msg => {
        activeRules.forEach(rule => {
          const matchesSubject = !rule.conditions.subjectContains || msg.subject.includes(rule.conditions.subjectContains);
          const matchesAttachment = rule.conditions.hasAttachment === undefined || rule.conditions.hasAttachment === msg.hasAttachments;
          if (matchesSubject && matchesAttachment) {
            get().addLog({
              agentId: rule.agentId,
              agentName: rule.agentName,
              direction: 'incoming',
              subject: msg.subject,
              summary: `邮件规则匹配: ${rule.conditions.subjectContains || '无条件'} → 已转发 ${rule.agentName}`,
              hasAttachment: msg.hasAttachments,
            });
          }
        });
      });
    }, 1500);
  },

  clearAll: () => set({ accounts: [], rules: [], messages: [], logs: [], syncing: false }),
}), { name: 'ecomind-email-connector' }));
