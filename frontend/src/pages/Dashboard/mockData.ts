/** Mock data types for Dashboard */

export interface AgentInfo {
  id: string;
  name: string;
  type: 'law_enforcement' | 'env_monitoring' | 'gov_approval' | 'public_service';
  status: 'online' | 'offline' | 'busy';
  lastActivity: string;
  taskCount: number;
}

export interface ModelInfo {
  id: string;
  name: string;
  type: 'llm' | 'embedding' | 'rerank';
  gpuUsage: number;
  queueSize: number;
  status: 'running' | 'idle' | 'error';
}

export interface SecurityEvent {
  id: string;
  type: 'verify_hallucination' | 'sm2_certificate' | 'approval_flow' | 'access_denied';
  severity: 'critical' | 'warning' | 'info';
  message: string;
  timestamp: string;
}

export interface ApprovalItem {
  id: string;
  title: string;
  requestedBy: string;
  type: 'data_access' | 'model_deploy' | 'config_change';
  priority: 'urgent' | 'normal' | 'low';
  createdAt: string;
}

/** KPI stat card data */
export interface KpiData {
  title: string;
  value: number | string;
  subtitle: string;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
  status?: 'success' | 'warning' | 'error' | 'default';
}

/** Agent type labels */
export const AGENT_TYPE_LABELS: Record<AgentInfo['type'], string> = {
  law_enforcement: '执法监察',
  env_monitoring: '环境监测',
  gov_approval: '政务审批',
  public_service: '公众服务',
};

/** Security event type labels */
export const SECURITY_EVENT_LABELS: Record<SecurityEvent['type'], string> = {
  verify_hallucination: 'VERIFY 幻觉检测',
  sm2_certificate: 'SM2 证书验证',
  approval_flow: 'GOVMCP 审批流',
  access_denied: '访问拒绝',
};

/** Mock agents data */
export const MOCK_AGENTS: AgentInfo[] = [
  {
    id: 'agent-001',
    name: '环保执法 Agent-A1',
    type: 'law_enforcement',
    status: 'online',
    lastActivity: '2 分钟前完成超标排放核查',
    taskCount: 156,
  },
  {
    id: 'agent-002',
    name: '水质监测 Agent-B1',
    type: 'env_monitoring',
    status: 'online',
    lastActivity: '5 分钟前更新洞庭湖水质数据',
    taskCount: 89,
  },
  {
    id: 'agent-003',
    name: '排放许可 Agent-C1',
    type: 'gov_approval',
    status: 'busy',
    lastActivity: '正在处理株洲化工厂排放许可续期',
    taskCount: 234,
  },
  {
    id: 'agent-004',
    name: '公众投诉 Agent-D1',
    type: 'public_service',
    status: 'online',
    lastActivity: '1 分钟前回复市民噪声投诉',
    taskCount: 412,
  },
  {
    id: 'agent-005',
    name: '大气监测 Agent-B2',
    type: 'env_monitoring',
    status: 'offline',
    lastActivity: '30 分钟前传感器离线',
    taskCount: 67,
  },
  {
    id: 'agent-006',
    name: '固废管理 Agent-A2',
    type: 'law_enforcement',
    status: 'online',
    lastActivity: '10 分钟前完成固废转移联单审核',
    taskCount: 198,
  },
  {
    id: 'agent-007',
    name: '环评审批 Agent-C2',
    type: 'gov_approval',
    status: 'online',
    lastActivity: '3 分钟前提交环评初审意见',
    taskCount: 145,
  },
  {
    id: 'agent-008',
    name: '信息公开 Agent-D2',
    type: 'public_service',
    status: 'offline',
    lastActivity: '1 小时前系统维护',
    taskCount: 323,
  },
];

/** Mock models data */
export const MOCK_MODELS: ModelInfo[] = [
  {
    id: 'model-001',
    name: 'Qwen2.5-72B-Instruct',
    type: 'llm',
    gpuUsage: 87,
    queueSize: 12,
    status: 'running',
  },
  {
    id: 'model-002',
    name: 'ChatGLM4-9B',
    type: 'llm',
    gpuUsage: 45,
    queueSize: 3,
    status: 'running',
  },
  {
    id: 'model-003',
    name: 'BGE-M3-Embedding',
    type: 'embedding',
    gpuUsage: 23,
    queueSize: 0,
    status: 'idle',
  },
  {
    id: 'model-004',
    name: 'BCE-Reranker-Base',
    type: 'rerank',
    gpuUsage: 12,
    queueSize: 0,
    status: 'idle',
  },
];

/** Mock security events */
export const MOCK_SECURITY_EVENTS: SecurityEvent[] = [
  {
    id: 'sec-001',
    type: 'verify_hallucination',
    severity: 'warning',
    message: 'Agent-B1 回复中检测到疑似幻觉数据：洞庭湖 COD 浓度与实际偏差 >30%',
    timestamp: '2026-07-11T14:32:00Z',
  },
  {
    id: 'sec-002',
    type: 'sm2_certificate',
    severity: 'info',
    message: 'GOVMCP 服务端 SM2 证书自动续期成功，有效期至 2027-07-11',
    timestamp: '2026-07-11T12:00:00Z',
  },
  {
    id: 'sec-003',
    type: 'approval_flow',
    severity: 'critical',
    message: '高危操作审批超时：Agent-A1 请求删除历史执法记录（等待 >2h）',
    timestamp: '2026-07-11T11:15:00Z',
  },
  {
    id: 'sec-004',
    type: 'access_denied',
    severity: 'warning',
    message: 'Agent-D2 尝试访问未授权的涉密数据域，已被 VERIFY 拦截',
    timestamp: '2026-07-11T09:45:00Z',
  },
  {
    id: 'sec-005',
    type: 'verify_hallucination',
    severity: 'info',
    message: 'Agent-C1 环评报告生成通过 VERIFY 校验，幻觉概率 <5%',
    timestamp: '2026-07-11T08:20:00Z',
  },
];

/** Mock pending approvals */
export const MOCK_APPROVALS: ApprovalItem[] = [
  {
    id: 'approval-001',
    title: '株洲化工厂排放许可续期申请',
    requestedBy: 'Agent-C1 (政务审批)',
    type: 'data_access',
    priority: 'urgent',
    createdAt: '2026-07-11T13:00:00Z',
  },
  {
    id: 'approval-002',
    title: 'Qwen2.5-72B 模型参数微调部署',
    requestedBy: '系统管理员',
    type: 'model_deploy',
    priority: 'normal',
    createdAt: '2026-07-11T10:30:00Z',
  },
  {
    id: 'approval-003',
    title: '新增 Agent-D3 公众服务机器人配置',
    requestedBy: 'Agent-D1 (公众服务)',
    type: 'config_change',
    priority: 'normal',
    createdAt: '2026-07-11T09:00:00Z',
  },
  {
    id: 'approval-004',
    title: '涉密环境监测数据导出请求',
    requestedBy: 'Agent-B2 (环境监测)',
    type: 'data_access',
    priority: 'urgent',
    createdAt: '2026-07-11T08:15:00Z',
  },
  {
    id: 'approval-005',
    title: '应急响应预案版本升级',
    requestedBy: '系统管理员',
    type: 'config_change',
    priority: 'low' as const,
    createdAt: '2026-07-10T16:00:00Z',
  },
];

/** Computed KPI data from mock */
export const getKpiData = (): KpiData[] => {
  const onlineAgents = MOCK_AGENTS.filter((a) => a.status === 'online' || a.status === 'busy').length;
  const offlineAgents = MOCK_AGENTS.filter((a) => a.status === 'offline').length;
  const avgGpu = Math.round(MOCK_MODELS.reduce((sum, m) => sum + m.gpuUsage, 0) / MOCK_MODELS.length);
  const totalQueue = MOCK_MODELS.reduce((sum, m) => sum + m.queueSize, 0);
  const alertCount = MOCK_SECURITY_EVENTS.filter(
    (e) => Date.now() - new Date(e.timestamp).getTime() < 24 * 60 * 60 * 1000
  ).length;
  const pendingCount = MOCK_APPROVALS.filter((a) => a.priority === 'urgent').length;

  return [
    {
      title: 'Agent 状态',
      value: onlineAgents,
      subtitle: `在线 / ${offlineAgents} 离线`,
      trend: 'up',
      trendValue: `${onlineAgents}/${MOCK_AGENTS.length}`,
      status: onlineAgents > 0 ? 'success' : 'error',
    },
    {
      title: '模型负载',
      value: `${avgGpu}%`,
      subtitle: `GPU 平均 | 队列 ${totalQueue}`,
      trend: avgGpu > 80 ? 'up' : 'stable',
      trendValue: `${totalQueue} 任务`,
      status: avgGpu > 80 ? 'warning' : 'success',
    },
    {
      title: '安全告警',
      value: alertCount,
      subtitle: '近 24h',
      trend: alertCount > 3 ? 'up' : 'stable',
      trendValue: `${alertCount} 条`,
      status: alertCount > 3 ? 'error' : 'success',
    },
    {
      title: '审批队列',
      value: pendingCount,
      subtitle: `共 ${MOCK_APPROVALS.length} 条待审`,
      trend: pendingCount > 0 ? 'up' : 'stable',
      trendValue: `${pendingCount} 紧急`,
      status: pendingCount > 0 ? 'warning' : 'success',
    },
  ];
};
