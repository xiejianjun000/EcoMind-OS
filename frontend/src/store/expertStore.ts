import { create } from 'zustand';
import type { Expert, ExpertSkill, ExpertConnector, KnowledgeBase, TeamMember, Workspace } from '@/types/expert';

// ============================================================
// Default Experts (12 business domain agents)
// ============================================================

const DEFAULT_EXPERTS: Expert[] = [
  {
    id: 'gaia',
    name: 'gaia',
    displayName: 'GAIA 生态主控',
    description: '通用生态环境AI助手，协调各专家Agent，回答法规政策问题',
    category: 'general',
    icon: 'GlobalOutlined',
    color: '#52c41a',
    status: 'online',
    capabilities: ['法规查询', '政策解读', '多专家协调', '通用咨询'],
    modelTier: 'sonnet',
    safetyLevel: 'L2',
    isBuiltin: true,
  },
  {
    id: 'env-monitoring',
    name: 'env-monitoring',
    displayName: '环境监测专家',
    description: '空气质量、水质、噪声等实时监测数据分析与异常告警',
    category: 'monitoring',
    icon: 'LineChartOutlined',
    color: '#1890ff',
    status: 'online',
    capabilities: ['实时数据解读', '异常分析', '趋势预测', '报告生成', '多站点对比'],
    modelTier: 'sonnet',
    safetyLevel: 'L2',
    isBuiltin: true,
  },
  {
    id: 'enforcement',
    name: 'enforcement',
    displayName: '执法监察专家',
    description: '巡查取证、违规判定、处罚建议、执法文书自动生成',
    category: 'enforcement',
    icon: 'SafetyCertificateOutlined',
    color: '#f5222d',
    status: 'online',
    capabilities: ['取证辅助', '违规判定', '处罚建议', '文书生成', '地理轨迹追溯'],
    modelTier: 'opus',
    safetyLevel: 'L3',
    isBuiltin: true,
  },
  {
    id: 'eia',
    name: 'eia',
    displayName: '环评审批专家',
    description: '环评报告技术审查、合规性校验、公文生成',
    category: 'eia',
    icon: 'FileTextOutlined',
    color: '#722ed1',
    status: 'online',
    capabilities: ['技术审查', '合规校验', '报告生成', 'OCR识别', '条款匹配'],
    modelTier: 'opus',
    safetyLevel: 'L3',
    isBuiltin: true,
  },
  {
    id: 'permit',
    name: 'permit',
    displayName: '排污许可专家',
    description: '排污许可证核发合规校验、材料清单检查、年报预审',
    category: 'approval',
    icon: 'IdcardOutlined',
    color: '#eb2f96',
    status: 'online',
    capabilities: ['合规预检', '材料审查', '标准条款匹配', '整改建议', '年报辅助'],
    modelTier: 'sonnet',
    safetyLevel: 'L2',
    isBuiltin: true,
  },
  {
    id: 'biodiversity',
    name: 'biodiversity',
    displayName: '生物多样性专家',
    description: '物种监测分析、生态评估、保护策略建议',
    category: 'biodiversity',
    icon: 'BugOutlined',
    color: '#13c2c2',
    status: 'online',
    capabilities: ['物种识别', '分布分析', '趋势评估', '保护策略', '生态红线校验'],
    modelTier: 'sonnet',
    safetyLevel: 'L2',
    isBuiltin: true,
  },
  {
    id: 'carbon',
    name: 'carbon',
    displayName: '碳排放专家',
    description: '碳排放数据计算、核查辅助、减排方案建议',
    category: 'emission',
    icon: 'CloudOutlined',
    color: '#595959',
    status: 'online',
    capabilities: ['排放计算', '核查辅助', '减排方案', '碳足迹分析', 'CCER评估'],
    modelTier: 'sonnet',
    safetyLevel: 'L2',
    isBuiltin: true,
  },
  {
    id: 'emergency',
    name: 'emergency',
    displayName: '应急管理专家',
    description: '24h值守、突发事件响应、多Agent协同应急指挥',
    category: 'emergency',
    icon: 'AlertOutlined',
    color: '#fa8c16',
    status: 'online',
    capabilities: ['事件研判', '应急指挥', '资源调度', '预案生成', '跨端协同'],
    modelTier: 'opus',
    safetyLevel: 'L3',
    isBuiltin: true,
  },
  {
    id: 'restoration',
    name: 'restoration',
    displayName: '生态修复专家',
    description: '修复方案智能推荐、效果评估、方案迭代优化',
    category: 'restoration',
    icon: 'ReloadOutlined',
    color: '#237804',
    status: 'online',
    capabilities: ['方案推荐', '效果评估', 'Canvas可视化', '方案迭代', '历史复用'],
    modelTier: 'sonnet',
    safetyLevel: 'L2',
    isBuiltin: true,
  },
  {
    id: 'inspection',
    name: 'inspection',
    displayName: '生态督察专家',
    description: '生态环保督察辅助、问题线索分析、整改跟踪',
    category: 'inspection',
    icon: 'AuditOutlined',
    color: '#cf1322',
    status: 'online',
    capabilities: ['线索分析', '整改跟踪', '督察报告', '多Agent路由', '会签辅助'],
    modelTier: 'opus',
    safetyLevel: 'L3',
    isBuiltin: true,
  },
  {
    id: 'public',
    name: 'public',
    displayName: '公众服务专家',
    description: '环境信息公开、投诉举报处理、政策解读、信用查询',
    category: 'public',
    icon: 'TeamOutlined',
    color: '#2f54eb',
    status: 'online',
    capabilities: ['信息查询', '投诉处理', '信用查询', '政策解读', '设施定位'],
    modelTier: 'sonnet',
    safetyLevel: 'L1',
    isBuiltin: true,
  },
  {
    id: 'water',
    name: 'water',
    displayName: '水资源专家',
    description: '流域水质分析、水量调度、水生态评估',
    category: 'water',
    icon: 'DropboxOutlined',
    color: '#096dd9',
    status: 'online',
    capabilities: ['水质分析', '水量预测', '流域评估', '污染溯源', '调度建议'],
    modelTier: 'sonnet',
    safetyLevel: 'L2',
    isBuiltin: true,
  },
];

const DEFAULT_SKILLS: ExpertSkill[] = [
  { id: 'map-3d', name: '3D地图分析', description: 'Cesium三维地形与污染扩散可视化', icon: 'GlobalOutlined', expertIds: ['gaia', 'env-monitoring', 'emergency', 'restoration'] },
  { id: 'remote-sensing', name: '遥感影像解译', description: '卫星遥感影像自动识别与分析', icon: 'ScanOutlined', expertIds: ['env-monitoring', 'biodiversity', 'restoration'] },
  { id: 'pollution-sim', name: '污染扩散模拟', description: '大气/水污染扩散数值模拟', icon: 'HeatMapOutlined', expertIds: ['env-monitoring', 'emergency'] },
  { id: 'compliance-check', name: '合规校验', description: '自动对照法规标准进行合规检查', icon: 'CheckCircleOutlined', expertIds: ['eia', 'permit', 'enforcement', 'inspection'] },
  { id: 'report-gen', name: '报告生成', description: '自动生成环评/监测/执法报告', icon: 'FileTextOutlined', expertIds: ['gaia', 'eia', 'env-monitoring', 'enforcement', 'inspection'] },
  { id: 'ocr', name: 'OCR识别', description: '扫描件/图片文字识别与结构化', icon: 'EyeOutlined', expertIds: ['eia', 'permit', 'enforcement'] },
  { id: 'data-viz', name: '数据可视化', description: 'ECharts图表与统计面板生成', icon: 'BarChartOutlined', expertIds: ['gaia', 'env-monitoring', 'carbon', 'biodiversity'] },
  { id: 'spatial-analysis', name: '时空分析', description: 'Turf.js空间分析与地理计算', icon: 'NodeIndexOutlined', expertIds: ['env-monitoring', 'emergency', 'water'] },
];

const DEFAULT_CONNECTORS: ExpertConnector[] = [
  { id: 'stations', name: '监测站点', type: 'monitoring_station', status: 'connected', description: '国控/省控空气水质监测站实时数据', icon: 'RadarChartOutlined' },
  { id: 'iot-sensors', name: 'IoT传感器', type: 'iot', status: 'connected', description: '企业在线监测设备(CEMS/VOCs)', icon: 'ApiOutlined' },
  { id: 'satellite', name: '卫星遥感', type: 'satellite', status: 'connected', description: 'Sentinel/Landsat卫星影像数据', icon: 'RocketOutlined' },
  { id: 'gov-system', name: '政务系统', type: 'government', status: 'connected', description: '生态环境政务数据对接', icon: 'BankOutlined' },
  { id: 'weather', name: '气象数据', type: 'weather', status: 'connected', description: '气象预报与历史气象数据', icon: 'CloudOutlined' },
];

const DEFAULT_KNOWLEDGE_BASES: KnowledgeBase[] = [
  { id: 'regulations', name: '法规标准库', description: '国家及地方生态环境法规标准', itemCount: 2847, icon: 'BookOutlined' },
  { id: 'cases', name: '案例库', description: '典型执法/审批/修复案例', itemCount: 1256, icon: 'FolderOpenOutlined' },
  { id: 'species', name: '物种数据库', description: '区域物种名录与分布数据', itemCount: 8932, icon: 'BugOutlined' },
  { id: 'pollutants', name: '污染物清单', description: '重点管控污染物清单及限值', itemCount: 456, icon: 'ExperimentOutlined' },
  { id: 'emission-factors', name: '排放因子库', description: '各行业碳排放与污染物排放因子', itemCount: 2341, icon: 'DatabaseOutlined' },
];

const DEFAULT_TEAM: TeamMember[] = [
  { id: 'user-1', name: '当前用户', role: '操作员', status: 'online', isHuman: true },
  { id: 'gaia', name: 'GAIA', role: '生态主控', status: 'online', isHuman: false },
  { id: 'env-monitoring', name: '监测专家', role: '环境监测', status: 'online', isHuman: false },
  { id: 'enforcement', name: '执法专家', role: '执法监察', status: 'online', isHuman: false },
  { id: 'eia', name: '环评专家', role: '环评审批', status: 'online', isHuman: false },
];

// ============================================================
// State Interface
// ============================================================

interface ExpertState {
  experts: Expert[];
  skills: ExpertSkill[];
  connectors: ExpertConnector[];
  knowledgeBases: KnowledgeBase[];
  team: TeamMember[];
  workspaces: Workspace[];
  activeExpertId: string | null;
  sidebarExpandedSections: Record<string, boolean>;

  // Actions
  setActiveExpert: (expertId: string | null) => void;
  toggleSidebarSection: (section: string) => void;
  expandSidebarSection: (section: string) => void;
  collapseSidebarSection: (section: string) => void;
  updateExpertStatus: (expertId: string, status: Expert['status']) => void;
  addWorkspace: (workspace: Omit<Workspace, 'id' | 'createdAt' | 'updatedAt'>) => void;
  deleteWorkspace: (workspaceId: string) => void;
}

// ============================================================
// Store
// ============================================================

export const useExpertStore = create<ExpertState>((set) => ({
  experts: DEFAULT_EXPERTS,
  skills: DEFAULT_SKILLS,
  connectors: DEFAULT_CONNECTORS,
  knowledgeBases: DEFAULT_KNOWLEDGE_BASES,
  team: DEFAULT_TEAM,
  workspaces: [
    { id: 'ws-1', name: '湘江流域治理', description: '湘江流域综合治理项目', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), sessionIds: [], color: '#1890ff' },
    { id: 'ws-2', name: '某园区环评', description: 'XX工业园区环境影响评价', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), sessionIds: [], color: '#52c41a' },
  ],
  activeExpertId: 'gaia',
  sidebarExpandedSections: {
    experts: true,
    skills: false,
    connectors: false,
    knowledge: false,
    automation: false,
    workspaces: false,
  },

  setActiveExpert: (expertId) => set({ activeExpertId: expertId }),

  toggleSidebarSection: (section) =>
    set((state) => ({
      sidebarExpandedSections: {
        ...state.sidebarExpandedSections,
        [section]: !state.sidebarExpandedSections[section],
      },
    })),

  expandSidebarSection: (section) =>
    set((state) => ({
      sidebarExpandedSections: {
        ...state.sidebarExpandedSections,
        [section]: true,
      },
    })),

  collapseSidebarSection: (section) =>
    set((state) => ({
      sidebarExpandedSections: {
        ...state.sidebarExpandedSections,
        [section]: false,
      },
    })),

  updateExpertStatus: (expertId, status) =>
    set((state) => ({
      experts: state.experts.map((e) =>
        e.id === expertId ? { ...e, status } : e
      ),
    })),

  addWorkspace: (workspace) => {
    const id = `ws-${Date.now()}`;
    const now = new Date().toISOString();
    set((state) => ({
      workspaces: [
        ...state.workspaces,
        { ...workspace, id, createdAt: now, updatedAt: now, sessionIds: workspace.sessionIds || [] },
      ],
    }));
  },

  deleteWorkspace: (workspaceId) =>
    set((state) => ({
      workspaces: state.workspaces.filter((w) => w.id !== workspaceId),
    })),
}));
