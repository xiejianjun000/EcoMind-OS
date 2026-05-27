/** Unified API service — v6.5 */

export interface EnvRealtimeItem {
  city: string;
  aqi: number;
  pm25: number;
  pm10: number;
  o3: number;
  no2: number;
  so2: number;
  co: number;
  primaryPollutant: string;
  /** Alias for primaryPollutant (used by CityDashboard) */
  primary?: string;
  level: string;
  stationName?: string;
  updateTime: string;
  /** Alias for updateTime (used by CityDashboard) */
  time?: string;
}

export interface EnvRankingItem {
  rank: number;
  city: string;
  aqi: number;
  change: number;
  level?: string;
}

export interface EnvForecastItem {
  city: string;
  date: string;
  aqi: string;
  level: string;
}

export interface AgentMessageResponse {
  id: string;
  content: string;
  agentId: string;
  timestamp: string;
  /** Extended fields for SendMessageModal */
  message?: string;
  iterations?: number;
  tools_used?: string[];
  hallucination_risk?: number;
}

// ─── Helpers ───

/** Safe call wrapper — returns fallback on error */
export async function safeCall<T>(fn: () => Promise<T>, fallback?: T): Promise<T | undefined> {
  try {
    return await fn();
  } catch (err) {
    console.warn('[safeCall] API error, using fallback:', err);
    return fallback;
  }
}

/** Generate a random ID */
function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Simulate network delay */
const delay = (ms = 300) => new Promise<void>((r) => setTimeout(r, ms));

// ─── Agent API ───

export const agentApi = {
  list: async (params?: { status?: string; provider?: string }): Promise<{ agents: import('@/services/types').AgentResponse[] }> => {
    await delay();
    const agents: import('@/services/types').AgentResponse[] = [
      {
        agent_id: 'enforcement',
        name: '执法监察专家',
        provider: 'qwen',
        status: 'running',
        model: 'qwen-max',
        taiji_verify_enabled: true,
        tools: ['取证辅助', '违规判定', '处罚建议', '文书生成'],
        created_at: new Date(Date.now() - 7 * 864e5).toISOString(),
      },
      {
        agent_id: 'env-monitoring',
        name: '环境监测专家',
        provider: 'deepseek',
        status: 'running',
        model: 'deepseek-chat',
        taiji_verify_enabled: true,
        tools: ['实时数据解读', '异常分析', '趋势预测'],
        created_at: new Date(Date.now() - 5 * 864e5).toISOString(),
      },
      {
        agent_id: 'eia',
        name: '环评审批专家',
        provider: 'qwen',
        status: 'running',
        model: 'qwen-plus',
        taiji_verify_enabled: true,
        tools: ['技术审查', '合规校验', '报告生成'],
        created_at: new Date(Date.now() - 3 * 864e5).toISOString(),
      },
      {
        agent_id: 'carbon',
        name: '碳排放专家',
        provider: 'glm',
        status: 'paused',
        model: 'glm-4',
        taiji_verify_enabled: false,
        tools: ['排放计算', '减排方案'],
        created_at: new Date(Date.now() - 10 * 864e5).toISOString(),
      },
      {
        agent_id: 'water',
        name: '水资源专家',
        provider: 'openai',
        status: 'running',
        model: 'gpt-4o-mini',
        taiji_verify_enabled: true,
        tools: ['水质分析', '水量预测', '污染溯源'],
        created_at: new Date(Date.now() - 14 * 864e5).toISOString(),
      },
    ];

    let filtered = agents;
    if (params?.status) {
      filtered = filtered.filter((a) => a.status === params.status);
    }
    if (params?.provider) {
      filtered = filtered.filter((a) => a.provider === params.provider);
    }
    return { agents: filtered };
  },

  create: async (values: import('@/services/types').AgentCreateRequest): Promise<import('@/services/types').AgentResponse> => {
    await delay(500);
    const agent: import('@/services/types').AgentResponse = {
      agent_id: uid('agent'),
      name: values.name,
      description: values.description,
      provider: values.provider,
      status: 'running',
      model: values.model,
      taiji_verify_enabled: values.taiji_verify_enabled ?? true,
      soul: values.soul,
      temperature: values.temperature,
      max_tokens: values.max_tokens,
      tools: [],
      created_at: new Date().toISOString(),
    };
    return agent;
  },

  updateStatus: async (id: string, status: import('@/services/types').AgentStatus): Promise<{ success: boolean }> => {
    await delay();
    return { success: true };
  },

  sendMessage: async (agentId: string, message: string): Promise<AgentMessageResponse> => {
    await delay();
    return {
      id: `msg-${Date.now()}`,
      content: `[${agentId}] 收到: ${message.slice(0, 50)}...\n\n这是模拟回复。在生产环境中将调用实际LLM API。`,
      agentId,
      timestamp: new Date().toISOString(),
      message: `[${agentId}] 收到: ${message.slice(0, 50)}...\n\n这是模拟回复。在生产环境中将调用实际LLM API。`,
      iterations: Math.floor(Math.random() * 5) + 1,
      tools_used: ['数据检索', '合规校验'],
      hallucination_risk: Math.random() * 0.3,
    };
  },
};

// ─── Environment API ───

const ALL_CITIES = [
  '长沙市', '株洲市', '湘潭市', '衡阳市', '邵阳市',
  '岳阳市', '常德市', '张家界市', '益阳市', '郴州市',
  '永州市', '怀化市', '娄底市', '湘西土家族苗族自治州',
];

export const environmentApi = {
  /** Get realtime AQI data for specified cities (default: all) */
  getRealtime: async (cities?: string[]): Promise<EnvRealtimeItem[]> => {
    await delay();
    const targetCities = cities?.length ? cities : ALL_CITIES;
    return targetCities.map((city) => ({
      city,
      aqi: Math.floor(Math.random() * 100) + 30,
      pm25: Math.floor(Math.random() * 50) + 10,
      pm10: Math.floor(Math.random() * 80) + 20,
      o3: Math.floor(Math.random() * 100) + 40,
      no2: Math.floor(Math.random() * 40) + 10,
      so2: Math.floor(Math.random() * 20) + 2,
      co: +(Math.random() * 1.5 + 0.3).toFixed(1),
      primaryPollutant: ['PM2.5', 'O3', 'PM10', 'NO2'][Math.floor(Math.random() * 4)],
      level: ['优', '良', '轻度污染'][Math.floor(Math.random() * 3)],
      updateTime: new Date().toISOString(),
    })).map(item => ({ ...item, time: item.updateTime, primary: item.primaryPollutant }));
  },

  /** Get 7-day forecast */
  getForecast: async (): Promise<EnvForecastItem[]> => {
    await delay();
    return ALL_CITIES.flatMap((city) =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i);
        const lo = Math.floor(Math.random() * 40) + 20;
        const hi = lo + Math.floor(Math.random() * 40);
        return {
          city,
          date: d.toISOString().split('T')[0],
          aqi: `${lo}-${hi}`,
          level: hi <= 50 ? '优' : hi <= 100 ? '良' : '轻度污染',
        };
      })
    );
  },

  /** Get province ranking */
  getRanking: async (): Promise<EnvRankingItem[]> => {
    await delay(200);
    return ALL_CITIES
      .map((city, i) => ({
        rank: i + 1,
        city,
        aqi: Math.floor(Math.random() * 80) + 20,
        change: Math.floor(Math.random() * 10) - 3,
      }))
      .sort((a, b) => a.aqi - b.aqi)
      .map((item, i) => ({ ...item, rank: i + 1, level: item.aqi <= 50 ? '优' : item.aqi <= 100 ? '良' : '轻度污染' }));
  },

  getProvinceRanking: async (): Promise<EnvRankingItem[]> => {
    return environmentApi.getRanking();
  },
};

// ─── Workflow API ───

export const workflowApi = {
  list: async (params?: { status?: string }): Promise<{ workflows: import('@/services/types').WorkflowResponse[] }> => {
    await delay();
    const workflows: import('@/services/types').WorkflowResponse[] = [
      {
        workflow_id: 'wf-001',
        name: '环评审批流程',
        description: '新建项目环境影响评价审批的标准流程',
        status: 'running',
        nodes: [
          { name: '资料初审', node_type: 'action', config: {} },
          { name: '技术审查', node_type: 'action', config: {} },
          { name: '合规检查', node_type: 'decision', config: {} },
          { name: '审批签发', node_type: 'action', config: {} },
        ],
        edges: [
          { source: '资料初审', target: '技术审查', condition: null },
          { source: '技术审查', target: '合规检查', condition: null },
          { source: '合规检查', target: '审批签发', condition: '合规' },
        ],
        current_node: '技术审查',
        max_iterations: 100,
        timeout_seconds: 3600,
        created_at: new Date(Date.now() - 3 * 864e5).toISOString(),
        updated_at: new Date().toISOString(),
        history: [{ step: '资料初审', timestamp: new Date().toISOString(), result: 'success' }],
        errors: [],
      },
      {
        workflow_id: 'wf-002',
        name: '污染事故应急处置',
        description: '突发环境事件应急处置工作流',
        status: 'completed',
        nodes: [
          { name: '事件确认', node_type: 'action', config: {} },
          { name: '等级判定', node_type: 'decision', config: {} },
          { name: '应急响应', node_type: 'subflow', config: {} },
        ],
        edges: [
          { source: '事件确认', target: '等级判定', condition: null },
          { source: '等级判定', target: '应急响应', condition: '重大' },
        ],
        current_node: null,
        max_iterations: 50,
        timeout_seconds: 7200,
        created_at: new Date(Date.now() - 7 * 864e5).toISOString(),
        updated_at: new Date(Date.now() - 2 * 864e5).toISOString(),
        history: [
          { step: '事件确认', result: 'success' },
          { step: '等级判定', result: 'success' },
          { step: '应急响应', result: 'success' },
        ],
        errors: [],
      },
      {
        workflow_id: 'wf-003',
        name: '排污许可核发',
        description: '企业排污许可证核发标准流程',
        status: 'pending',
        nodes: [
          { name: '申请受理', node_type: 'action', config: {} },
          { name: '现场核查', node_type: 'action', config: {} },
          { name: '排放核算', node_type: 'action', config: {} },
          { name: '许可签发', node_type: 'action', config: {} },
        ],
        edges: [
          { source: '申请受理', target: '现场核查', condition: null },
          { source: '现场核查', target: '排放核算', condition: null },
          { source: '排放核算', target: '许可签发', condition: null },
        ],
        current_node: null,
        max_iterations: 80,
        timeout_seconds: 5400,
        created_at: new Date(Date.now() - 1 * 864e5).toISOString(),
        updated_at: new Date().toISOString(),
        history: [],
        errors: [],
      },
      {
        workflow_id: 'wf-004',
        name: '环境数据报告生成',
        description: '月度环境质量报告自动生成',
        status: 'failed',
        nodes: [
          { name: '数据采集', node_type: 'action', config: {} },
          { name: '数据分析', node_type: 'action', config: {} },
          { name: '报告生成', node_type: 'action', config: {} },
        ],
        edges: [
          { source: '数据采集', target: '数据分析', condition: null },
          { source: '数据分析', target: '报告生成', condition: null },
        ],
        current_node: '报告生成',
        max_iterations: 30,
        timeout_seconds: 1800,
        created_at: new Date(Date.now() - 5 * 864e5).toISOString(),
        updated_at: new Date(Date.now() - 3 * 864e5).toISOString(),
        history: [{ step: '数据采集', result: 'success' }, { step: '数据分析', result: 'success' }],
        errors: ['报告生成失败: 模板解析异常'],
      },
    ];

    let filtered = workflows;
    if (params?.status) {
      filtered = filtered.filter((w) => w.status === params.status);
    }
    return { workflows: filtered };
  },

  create: async (values: import('@/services/types').WorkflowCreateRequest): Promise<import('@/services/types').WorkflowResponse> => {
    await delay(500);
    const now = new Date().toISOString();
    return {
      workflow_id: uid('wf'),
      name: values.name,
      description: values.description,
      status: 'pending',
      nodes: values.nodes,
      edges: values.edges,
      current_node: null,
      max_iterations: values.max_iterations ?? 100,
      timeout_seconds: values.timeout_seconds ?? 3600,
      created_at: now,
      updated_at: now,
      history: [],
      errors: [],
    };
  },

  execute: async (id: string): Promise<import('@/services/types').WorkflowResponse> => {
    await delay();
    return {
      workflow_id: id,
      name: '执行中的工作流',
      status: 'running',
      nodes: [],
      edges: [],
      current_node: null,
      max_iterations: 100,
      timeout_seconds: 3600,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      history: [],
      errors: [],
    };
  },

  cancel: async (id: string): Promise<{ success: boolean }> => {
    await delay();
    return { success: true };
  },

  get: async (id: string): Promise<import('@/services/types').WorkflowResponse> => {
    await delay();
    return {
      workflow_id: id,
      name: `工作流 ${id}`,
      status: 'completed',
      nodes: [],
      edges: [],
      current_node: null,
      max_iterations: 100,
      timeout_seconds: 3600,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      history: [],
      errors: [],
    };
  },
};

// ─── Security API ───

export const securityApi = {
  approvals: async (params?: { status?: string }): Promise<{ approvals: import('@/services/types').ApprovalResponse[] }> => {
    await delay();
    const approvals: import('@/services/types').ApprovalResponse[] = [
      {
        approval_id: 'apv-001',
        title: '湖南有色金属冶炼厂扩建项目环评审批',
        requester: '张三',
        department: '环境影响评价与排放管理处',
        status: 'pending',
        current_step: 1,
        steps: ['资料初审', '技术审查', '合规检查', '审批签发'],
        created_at: new Date(Date.now() - 1 * 864e5).toISOString(),
      },
      {
        approval_id: 'apv-002',
        title: '长沙市污水处理厂排污许可续期',
        requester: '李四',
        department: '水生态环境处',
        status: 'in_review',
        current_step: 2,
        steps: ['申请受理', '现场核查', '排放核算', '许可签发'],
        created_at: new Date(Date.now() - 2 * 864e5).toISOString(),
      },
      {
        approval_id: 'apv-003',
        title: '株洲市工业园区大气污染防治方案',
        requester: '王五',
        department: '大气环境与应对气候变化处',
        status: 'approved',
        current_step: 3,
        steps: ['方案提交', '专家评审', '内部审核', '批准发布'],
        created_at: new Date(Date.now() - 5 * 864e5).toISOString(),
      },
      {
        approval_id: 'apv-004',
        title: '岳阳市洞庭湖水生态修复项目',
        requester: '赵六',
        department: '水生态环境处',
        status: 'rejected',
        current_step: 2,
        steps: ['申报接收', '初审评估', '现场勘查', '项目批复'],
        created_at: new Date(Date.now() - 7 * 864e5).toISOString(),
      },
      {
        approval_id: 'apv-005',
        title: '湘潭市污染地块修复技术方案',
        requester: '陈七',
        department: '土壤生态环境处',
        status: 'pending',
        current_step: 0,
        steps: ['方案提交', '技术评估', '专家论证', '审批发布'],
        created_at: new Date(Date.now() - 0.5 * 864e5).toISOString(),
      },
    ];

    let filtered = approvals;
    if (params?.status) {
      filtered = filtered.filter((a) => a.status === params.status);
    }
    return { approvals: filtered };
  },

  approve: async (approvalId: string, body: import('@/services/types').ApprovalActionRequest): Promise<{ success: boolean }> => {
    await delay();
    return { success: true };
  },

  reject: async (approvalId: string, body: import('@/services/types').ApprovalActionRequest): Promise<{ success: boolean }> => {
    await delay();
    return { success: true };
  },

  auditTrail: async (): Promise<{ records: import('@/services/types').AuditRecordResponse[]; chain_valid: boolean }> => {
    await delay();
    const records: import('@/services/types').AuditRecordResponse[] = [
      { record_id: 'aud-001', timestamp: new Date(Date.now() - 0.5 * 864e5).toISOString(), user_id: 'admin', action: 'LOGIN', resource: 'system', success: true, details: { ip: '192.168.1.100' } },
      { record_id: 'aud-002', timestamp: new Date(Date.now() - 0.4 * 864e5).toISOString(), user_id: 'enforcement', action: 'AGENT_START', resource: 'agent/enforcement', success: true, details: { agent_id: 'enforcement' } },
      { record_id: 'aud-003', timestamp: new Date(Date.now() - 0.3 * 864e5).toISOString(), user_id: 'eia', action: 'WORKFLOW_CREATE', resource: 'workflow/wf-001', success: true, details: { name: '环评审批流程' } },
      { record_id: 'aud-004', timestamp: new Date(Date.now() - 0.2 * 864e5).toISOString(), user_id: 'admin', action: 'MODEL_LOAD', resource: 'model/qwen-max', success: true, details: { memory_mb: 4096 } },
      { record_id: 'aud-005', timestamp: new Date(Date.now() - 0.1 * 864e5).toISOString(), user_id: 'security', action: 'SECURITY_SCAN', resource: 'system', success: true, details: { threats: 0 } },
    ];
    return { records, chain_valid: true };
  },

  events: async (params?: { event_type?: string; severity?: string; resolved?: boolean }): Promise<{ events: import('@/services/types').SecurityEventResponse[] }> => {
    await delay();
    const events: import('@/services/types').SecurityEventResponse[] = [
      {
        event_id: 'evt-001',
        created_at: new Date(Date.now() - 1 * 864e5).toISOString(),
        event_type: 'hallucination',
        severity: 'high',
        title: '碳排放计算产生虚构数据',
        description: '碳排放大模型在计算某企业排放时产生了不存在的数值，需要人工核实',
        source: 'agent/carbon',
        resolved: false,
      },
      {
        event_id: 'evt-002',
        created_at: new Date(Date.now() - 2 * 864e5).toISOString(),
        event_type: 'unauthorized_access',
        severity: 'critical',
        title: '未授权用户尝试访问审批数据',
        description: '检测到来自外部IP的未授权尝试访问审批队列接口',
        source: 'gateway',
        resolved: true,
      },
      {
        event_id: 'evt-003',
        created_at: new Date(Date.now() - 3 * 864e5).toISOString(),
        event_type: 'rate_limit',
        severity: 'medium',
        title: 'API调用超过频率限制',
        description: '某客户端在1分钟内发起了超过1000次API请求',
        source: 'rate-limiter',
        resolved: true,
      },
      {
        event_id: 'evt-004',
        created_at: new Date(Date.now() - 4 * 864e5).toISOString(),
        event_type: 'policy_violation',
        severity: 'high',
        title: '环评审批超出规定时限',
        description: '某项目环评审批流程超过30个工作日仍未完成',
        source: 'compliance-checker',
        resolved: false,
      },
      {
        event_id: 'evt-005',
        created_at: new Date(Date.now() - 5 * 864e5).toISOString(),
        event_type: 'injection',
        severity: 'medium',
        title: '检测到提示词注入尝试',
        description: '用户输入包含疑似提示词注入的文本',
        source: 'security-scanner',
        resolved: true,
      },
      {
        event_id: 'evt-006',
        created_at: new Date(Date.now() - 6 * 864e5).toISOString(),
        event_type: 'encryption',
        severity: 'low',
        title: 'SM4加密模块运行正常',
        description: '定期加密模块健康检查通过',
        source: 'crypto-monitor',
        resolved: true,
      },
    ];

    let filtered = events;
    if (params?.event_type) {
      filtered = filtered.filter((e) => e.event_type === params.event_type);
    }
    if (params?.severity) {
      filtered = filtered.filter((e) => e.severity === params.severity);
    }
    if (params?.resolved !== undefined) {
      filtered = filtered.filter((e) => e.resolved === params.resolved);
    }
    return { events: filtered };
  },
};

// ─── Model API ───

export const modelApi = {
  list: async (params?: { provider?: string; tier?: string }): Promise<{ models: import('@/services/types').ModelInfo[] }> => {
    await delay();
    const models: import('@/services/types').ModelInfo[] = [
      { model_id: 'qwen-max', model_name: 'Qwen-Max', provider: 'qwen', tier: 'opus', status: 'online', latency_ms: 850, cost_per_1k_tokens: 0.02, max_tokens: 131072, supports_streaming: true, supports_tools: true },
      { model_id: 'qwen-plus', model_name: 'Qwen-Plus', provider: 'qwen', tier: 'sonnet', status: 'online', latency_ms: 450, cost_per_1k_tokens: 0.01, max_tokens: 131072, supports_streaming: true, supports_tools: true },
      { model_id: 'qwen-turbo', model_name: 'Qwen-Turbo', provider: 'qwen', tier: 'haiku', status: 'online', latency_ms: 120, cost_per_1k_tokens: 0.002, max_tokens: 32768, supports_streaming: true, supports_tools: false },
      { model_id: 'deepseek-chat', model_name: 'DeepSeek-Chat', provider: 'deepseek', tier: 'sonnet', status: 'online', latency_ms: 600, cost_per_1k_tokens: 0.005, max_tokens: 65536, supports_streaming: true, supports_tools: true },
      { model_id: 'deepseek-reasoner', model_name: 'DeepSeek-Reasoner', provider: 'deepseek', tier: 'opus', status: 'online', latency_ms: 1200, cost_per_1k_tokens: 0.015, max_tokens: 65536, supports_streaming: true, supports_tools: false },
      { model_id: 'glm-4', model_name: 'GLM-4', provider: 'glm', tier: 'sonnet', status: 'online', latency_ms: 500, cost_per_1k_tokens: 0.01, max_tokens: 128000, supports_streaming: true, supports_tools: true },
      { model_id: 'ecomind-14b-v3', model_name: 'EcoMind-14B-v3', provider: 'local_vllm', tier: 'sonnet', status: 'online', latency_ms: 200, cost_per_1k_tokens: 0, max_tokens: 8192, supports_streaming: true, supports_tools: true },
      { model_id: 'ecomind-7b-q4', model_name: 'EcoMind-7B-Q4', provider: 'local_sglang', tier: 'haiku', status: 'online', latency_ms: 80, cost_per_1k_tokens: 0, max_tokens: 4096, supports_streaming: true, supports_tools: false },
      { model_id: 'ecomind-72b', model_name: 'EcoMind-Pro-72B', provider: 'local_vllm', tier: 'opus', status: 'offline', latency_ms: 0, cost_per_1k_tokens: 0, max_tokens: 32768, supports_streaming: true, supports_tools: true },
    ];

    let filtered = models;
    if (params?.provider) {
      filtered = filtered.filter((m) => m.provider === params.provider);
    }
    if (params?.tier) {
      filtered = filtered.filter((m) => m.tier === params.tier);
    }
    return { models: filtered };
  },

  health: async (): Promise<import('@/services/types').ModelHealthResponse> => {
    await delay();
    return {
      healthy: true,
      models: [
        { model_id: 'qwen-max', status: 'online' },
        { model_id: 'deepseek-chat', status: 'online' },
        { model_id: 'ecomind-14b-v3', status: 'online' },
        { model_id: 'ecomind-72b', status: 'offline' },
      ],
    };
  },

  route: async (params: { tier: import('@/services/types').ModelTier; task_type: string; prefer_local: boolean }): Promise<import('@/services/types').ModelRouteResponse> => {
    await delay();
    const routeMap: Record<string, import('@/services/types').ModelRouteResponse> = {
      opus: { routed_model: params.prefer_local ? 'ecomind-72b' : 'qwen-max', provider: params.prefer_local ? 'local_vllm' : 'qwen', tier: 'opus', api_base: params.prefer_local ? 'http://10.0.1.100:8000/v1' : 'https://api.qwen.com/v1', reason: params.prefer_local ? '优先本地推理' : '本地模型不可用，路由至云端', fallback: params.prefer_local ? 'qwen-max' : undefined },
      sonnet: { routed_model: 'ecomind-14b-v3', provider: 'local_vllm', tier: 'sonnet', api_base: 'http://10.0.1.50:8000/v1', reason: '本地模型可用' },
      haiku: { routed_model: 'ecomind-7b-q4', provider: 'local_sglang', tier: 'haiku', api_base: 'http://127.0.0.1:30000/v1', reason: '本地轻量模型' },
    };
    return routeMap[params.tier] ?? routeMap.sonnet;
  },
};

export default environmentApi;
