/**
 * Automation / 任务中心类型 — v8.0 (Coze 级升级)
 *
 * 参考: Coze Desktop scheduled_task + QClaw CronTask + WorkBuddy Automation
 * 新增: 邮箱触发、执行配额、运行历史、MCP工具链
 */

// ─── 基础枚举 ───

export type CronFrequency = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom';
export type AutomationStatus = 'active' | 'paused' | 'ended' | 'failed';
export type AutomationRunStatus = 'scheduled' | 'queued' | 'in_progress' | 'succeeded' | 'failed' | 'interrupted' | 'missed';

// ─── 触发配置 ───

export interface TriggerConfig {
  type: 'cron' | 'email' | 'webhook' | 'manual';
  /** cron 表达式 */
  cron?: string;
  frequency?: CronFrequency;
  hour?: number;
  minute?: number;
  dayOfWeek?: number;
  dayOfMonth?: number;
  timezone?: string;
  /** 邮箱触发条件 */
  emailFilter?: {
    from?: string;        // 发件人过滤
    subject?: string;     // 主题关键词
    hasAttachment?: boolean;
  };
  /** webhook 触发 */
  webhookUrl?: string;
}

// ─── 执行配额 ───

export interface TaskQuota {
  maxRunsPerDay: number;
  maxRunsPerMonth: number;
  currentDayRuns: number;
  currentMonthRuns: number;
  lastResetDay: string;
  lastResetMonth: string;
}

// ─── MCP 工具链 ───

export interface TaskToolStep {
  toolName: string;
  description: string;
  inputs?: Record<string, string>;
}

// ─── 通知渠道 ───

export interface AutomationNotifyChannel {
  type: 'wechat' | 'wecom' | 'webhook' | 'email' | 'in_app';
  enabled: boolean;
  config?: Record<string, string>;
}

// ─── 自动化任务 ───

export interface AutomationTask {
  id: string;
  name: string;
  description?: string;
  status: AutomationStatus;
  /** 触发配置 */
  trigger: TriggerConfig;
  /** 兼容旧字段 */
  cronConfig?: AutomationCronConfig;
  /** 绑定的专家/智能体 */
  expertId?: string;
  /** 任务 Prompt */
  promptTemplate: string;
  /** MCP 工具链 (Coze 风格) */
  toolSteps?: TaskToolStep[];
  /** 通知渠道 */
  notifyChannels?: AutomationNotifyChannel[];
  /** 执行配额 */
  quota?: TaskQuota;
  /** 运行统计 */
  totalRuns: number;
  lastRunAt?: string;
  nextRunAt?: string;
  lastRunStatus?: AutomationRunStatus;
  lastErrorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

/** 兼容旧版 cronConfig */
export interface AutomationCronConfig {
  frequency: CronFrequency;
  cronExpression?: string;
  timezone?: string;
  hour?: number;
  minute?: number;
  dayOfWeek?: number;
  dayOfMonth?: number;
}

// ─── 运行记录 ───

export interface AutomationRun {
  id: string;
  taskId: string;
  taskName?: string;
  status: AutomationRunStatus;
  startedAt: string;
  finishedAt?: string;
  conversationId?: string;
  /** 执行日志 (多行) */
  log?: string;
  /** 结构化日志步骤 */
  logSteps?: RunLogStep[];
  errorMessage?: string;
  progress?: number;
  triggerType: 'scheduled' | 'manual' | 'email' | 'webhook';
  /** 触发的邮件信息 */
  triggerEmail?: {
    from: string;
    subject: string;
    hasAttachment: boolean;
  };
}

export interface RunLogStep {
  timestamp: string;
  type: 'info' | 'tool_call' | 'llm' | 'error' | 'result';
  message: string;
  data?: Record<string, unknown>;
}

// ─── 模板 ───

export interface AutomationTemplate {
  id: string;
  name: string;
  description: string;
  category: 'monitoring' | 'report' | 'alert' | 'compliance' | 'email' | 'custom';
  defaultConfig: {
    trigger?: Partial<TriggerConfig>;
    promptTemplate?: string;
    expertId?: string;
    toolSteps?: TaskToolStep[];
    notifyChannels?: AutomationNotifyChannel[];
  };
  icon: string;
}

// ─── 预设模板 (扩充邮箱类) ───

export const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    id: 'daily-air-report',
    name: '每日空气质量报告',
    description: '每天自动生成空气质量日报',
    category: 'report',
    defaultConfig: {
      trigger: { type: 'cron', cron: '0 8 * * *', frequency: 'daily', hour: 8, minute: 0, timezone: 'Asia/Shanghai' },
      promptTemplate: '请根据实时监测数据生成今日空气质量日报，包含AQI趋势、主要污染物分析和健康建议',
      notifyChannels: [{ type: 'in_app', enabled: true }],
    },
    icon: 'FileTextOutlined',
  },
  {
    id: 'aqi-threshold-alert',
    name: 'AQI 阈值告警',
    description: 'AQI超阈值自动告警并推送',
    category: 'alert',
    defaultConfig: {
      trigger: { type: 'cron', cron: '0 */2 * * *', frequency: 'hourly' },
      promptTemplate: '检查当前AQI数据，若超过150请立即分析污染源、影响范围，并生成管控建议',
      notifyChannels: [{ type: 'in_app', enabled: true }, { type: 'email', enabled: true }],
    },
    icon: 'AlertOutlined',
  },
  {
    id: 'weekly-monitor-summary',
    name: '每周监测汇总',
    description: '每周一自动汇总环境监测数据',
    category: 'report',
    defaultConfig: {
      trigger: { type: 'cron', cron: '0 9 * * 1', frequency: 'weekly', dayOfWeek: 1, hour: 9, minute: 0, timezone: 'Asia/Shanghai' },
      promptTemplate: '汇总本周所有监测站数据，生成综合分析报告，标注异常点位和趋势变化',
      notifyChannels: [{ type: 'in_app', enabled: true }, { type: 'email', enabled: true }],
    },
    icon: 'BarChartOutlined',
  },
  {
    id: 'compliance-check',
    name: '合规性自动校验',
    description: '定期对排放数据进行合规检查',
    category: 'compliance',
    defaultConfig: {
      trigger: { type: 'cron', cron: '0 6 * * *', frequency: 'daily', hour: 6, minute: 0, timezone: 'Asia/Shanghai' },
      promptTemplate: '扫描昨日所有企业排放数据，对标排放标准进行合规性校验，标注超标企业和违规行为',
      toolSteps: [{ toolName: 'data-scan', description: '扫描排放数据库' }, { toolName: 'compliance-check', description: '合规规则匹配' }],
      notifyChannels: [{ type: 'in_app', enabled: true }],
    },
    icon: 'CheckCircleOutlined',
  },
  {
    id: 'emergency-drill',
    name: '应急演练脚本',
    description: '模拟突发环境事件应急响应',
    category: 'monitoring',
    defaultConfig: {
      trigger: { type: 'cron', cron: '0 14 * * 3', frequency: 'weekly', dayOfWeek: 3, hour: 14, minute: 0, timezone: 'Asia/Shanghai' },
      promptTemplate: '模拟一次突发环境事件(随机场景)，生成完整的应急响应流程、人员调度方案和公众通报稿',
      notifyChannels: [{ type: 'in_app', enabled: true }],
    },
    icon: 'ThunderboltOutlined',
  },
  {
    id: 'email-patrol-report',
    name: '邮件巡检报告',
    description: '收到巡检邮件后自动分析并回复报告',
    category: 'email',
    defaultConfig: {
      trigger: { type: 'email', emailFilter: { subject: '巡检' } },
      promptTemplate: '分析邮件中的巡检数据，生成巡检分析报告并回复',
      notifyChannels: [{ type: 'email', enabled: true }],
    },
    icon: 'MailOutlined',
  },
  {
    id: 'email-task-dispatch',
    name: '邮件任务分发',
    description: '根据邮件内容自动分发给对应智能体处理',
    category: 'email',
    defaultConfig: {
      trigger: { type: 'email', emailFilter: { subject: '任务' } },
      promptTemplate: '解析邮件内容，识别任务类型并分发给对应智能体执行',
      toolSteps: [{ toolName: 'email-parse', description: '解析邮件内容' }, { toolName: 'agent-dispatch', description: '智能体分发' }],
      notifyChannels: [{ type: 'in_app', enabled: true }],
    },
    icon: 'SendOutlined',
  },
];
