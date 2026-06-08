# WorkBuddy 专家系统集成到 EcoMind OS 完整方案

> 生成日期：2026-06-08
> 基于：EcoMind OS 本地代码 + 远程 GitHub 仓库对比分析
> 作者：郝交付（交付总监）

---

## 目录

1. [两套专家系统现状对比](#1-两套专家系统现状对比)
2. [集成目标与原则](#2-集成目标与原则)
3. [映射关系：WorkBuddy → EcoMind](#3-映射关系workbuddy--ecomind)
4. [前端集成方案](#4-前端集成方案)
5. [后端集成方案](#5-后端集成方案)
6. [Soul 人格系统集成](#6-soul-人格系统集成)
7. [AgentConfig 扩展方案](#7-agentconfig-扩展方案)
8. [WebSocket 通信集成](#8-websocket-通信集成)
9. [安全等级与权限映射](#9-安全等级与权限映射)
10. [实施路线图](#10-实施路线图)
11. [文件变更清单](#11-文件变更清单)

---

## 1. 两套专家系统现状对比

### 1.1 WorkBuddy 专家系统（当前 WorkBuddy Desktop 内置）

| 专家 | 角色 | 能力域 | 对应 Agent Type |
|------|------|--------|----------------|
| 郝交付 | 交付总监/团队Lead | 编排、汇总、决策、Phase门禁 | `mvp-dev-expert-team-team-lead` |
| 许清楚 | PM | 竞品调研、PRD、RICE 评分、用户研究 | `pm` |
| 颜好看 | 设计总监 | 67 种 UI 风格、161 色板、57 字体配对 | `designer` |
| 高见远 | 架构师 | 技术选型、系统架构、API 设计 | `architect` |
| 贾思敏 | 前端Lead | UI 实现、Token 样式、微交互 | `frontend` |
| 贝洛奇 | 后端Lead | RESTful API、JWT、RBAC、数据库 | `backend` |
| 严过关 | QA | 测试策略、缺陷归零、验收 | `qa` |
| 卜宕机 | DevOps | CI/CD、Docker、部署验证 | `devops` |

**WorkBuddy 特点：**
- 8 人团队，**软件开发**场景专用
- 团队协作模式：TeamCreate → Agent spawn → SendMessage → TaskList
- 6 Phase SOP：需求提问 → 联网调研 → 三文档 → 确认 → Spec → 设计 → 开发 → 测试 → 交付
- 5 条协作铁律（必须亲自创建团队、成员独立产出、信息经Lead中转等）

### 1.2 EcoMind 专家系统（当前本地代码）

| 专家 ID | 显示名 | 域 | 安全级 | 模型层 | Soul |
|---------|--------|-----|--------|--------|------|
| `gaia` | GAIA 生态主控 | general | L2 | sonnet | default |
| `env-monitoring` | 环境监测专家 | monitoring | L2 | sonnet | default |
| `enforcement` | 执法监察专家 | enforcement | L3 | opus | default |
| `eia` | 环评审批专家 | eia | L3 | opus | default |
| `permit` | 排污许可专家 | approval | L2 | sonnet | default |
| `biodiversity` | 生物多样性专家 | biodiversity | L2 | sonnet | default |
| `carbon` | 碳排放专家 | emission | L2 | sonnet | default |
| `emergency` | 应急管理专家 | emergency | L3 | opus | default |
| `restoration` | 生态修复专家 | restoration | L2 | sonnet | default |
| `inspection` | 生态督察专家 | inspection | L3 | opus | default |
| `public` | 公众服务专家 | public | L1 | sonnet | default |
| `water` | 水资源专家 | water | L2 | sonnet | default |

**EcoMind 特点：**
- 12 个专家，**生态环境治理**场景专用
- 前端 `expertStore.ts` 定义完整（Expert + ExpertSkill + ExpertConnector + KnowledgeBase + TeamMember + Workspace）
- 后端 `AgentService` 是**通用 Agent 管理**，没有"专家"概念——任何 Agent 都通过 `AgentCreateRequest` 创建
- 所有专家的 Soul 都是 `default`，没有专属人格
- 后端没有 `expert` 相关代码——专家定义完全在前端硬编码

### 1.3 核心差距

| 维度 | WorkBuddy | EcoMind 现状 | 差距 |
|------|-----------|-------------|------|
| 团队协作 | TeamCreate + SendMessage + TaskList | 无——每个专家独立对话 | 🔴 缺协作层 |
| SOP 流程 | 6 Phase 门禁式推进 | 无——自由对话 | 🔴 缺流程引擎 |
| 专家人格 | 每人独立 System Prompt | 全部 default.yaml | 🟡 需 Soul 扩展 |
| 后端注册 | Agent 有 type/subagent_type | Agent 只有通用 CRUD | 🟡 需扩展 Schema |
| 前端编排 | 团队进度面板、Phase 进度条 | 12 专家平铺在侧栏 | 🟡 需编排 UI |
| 安全分级 | L1-L5 五级 | L1-L3 三级 | 🟢 可兼容 |

---

## 2. 集成目标与原则

### 目标

将 WorkBuddy 的**多专家团队协作模式**引入 EcoMind，使生态治理场景也能：

1. 一键组建专家团队（如"环评审批团队"= GAIA + 环评 + 排污 + 执法）
2. 按 SOP 流程推进任务（如"环评审批五步法"）
3. Lead 专家居中编排，专家独立产出
4. 前端可视化团队状态、任务进度、Phase 门禁

### 原则

1. **不替换现有 12 专家**——在现有基础上叠加团队协作能力
2. **复用 TaijiAgent 引擎**——每个团队成员仍是一个 TaijiAgent 实例
3. **复用 Soul 系统**——为每个专家创建专属 .yaml Soul 文件
4. **复用 WebSocket**——团队状态变更通过现有 WebSocket 推送
5. **渐进式集成**——Phase 1 先实现"团队组建 + 任务分发"，Phase 2 再实现"SOP 流程引擎"

---

## 3. 映射关系：WorkBuddy → EcoMind

### 3.1 角色映射

WorkBuddy 的 8 个软件开发角色，映射为 EcoMind 的**团队模板**概念：

| WorkBuddy 角色 | EcoMind 团队模板角色 | 生态治理场景映射 |
|----------------|---------------------|-----------------|
| 郝交付（交付总监） | **团队 Lead** | GAIA 生态主控担任 Lead |
| 许清楚（PM） | **需求分析师** | 公众服务专家（需求收集/政策解读） |
| 颜好看（设计总监） | **方案设计师** | 生态修复专家（修复方案设计） |
| 高见远（架构师） | **技术审查师** | 环评审批专家（技术审查/合规校验） |
| 贾思敏（前端Lead） | **实施执行师** | 执法监察专家（取证/执行） |
| 贝洛奇（后端Lead） | **数据分析师** | 环境监测专家（数据分析/报告） |
| 严过关（QA） | **质量检验师** | 生态督察专家（整改跟踪/督察报告） |
| 卜宕机（DevOps） | **部署运维师** | 应急管理专家（应急响应/资源调度） |

### 3.2 预设团队模板

基于映射关系，定义 3 个预设团队模板：

#### 团队模板 A：环评审批团队

```
Lead: GAIA 生态主控 (gaia)
成员:
  - 环评审批专家 (eia) — 技术审查
  - 排污许可专家 (permit) — 合规预检
  - 执法监察专家 (enforcement) — 违规判定
  - 环境监测专家 (env-monitoring) — 数据支撑
SOP: 环评审批五步法
  Phase 0: 项目信息收集 (GAIA + 公众服务)
  Phase 1: 技术审查 (环评审批 + 排污许可 并行)
  Phase 2: 合规校验 (执法监察)
  Phase 3: 报告生成 (环评审批)
  Phase 4: 审批确认 (GAIA 汇总)
```

#### 团队模板 B：应急响应团队

```
Lead: 应急管理专家 (emergency)
成员:
  - GAIA 生态主控 (gaia) — 协调
  - 环境监测专家 (env-monitoring) — 实时数据
  - 执法监察专家 (enforcement) — 取证
  - 水资源专家 (water) — 水质分析
SOP: 突发事件四步法
  Phase 0: 事件研判 (应急管理 + 监测)
  Phase 1: 应急指挥 (应急管理)
  Phase 2: 跨端协同 (执法 + 水资源 并行)
  Phase 3: 处置报告 (GAIA 汇总)
```

#### 团队模板 C：生态督察团队

```
Lead: 生态督察专家 (inspection)
成员:
  - GAIA 生态主控 (gaia) — 协调
  - 执法监察专家 (enforcement) — 线索分析
  - 环评审批专家 (eia) — 合规校验
  - 生态修复专家 (restoration) — 整改方案
SOP: 生态督察五步法
  Phase 0: 线索收集 (督察 + GAIA)
  Phase 1: 现场核查 (执法 + 环评 并行)
  Phase 2: 问题认定 (督察)
  Phase 3: 整改方案 (修复专家)
  Phase 4: 督察报告 (督察 + GAIA)
```

---

## 4. 前端集成方案

### 4.1 新增类型定义

在 `frontend/src/types/` 新增 `team.ts`：

```typescript
// frontend/src/types/team.ts

/** 团队 SOP Phase 状态 */
export type PhaseStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';

/** 团队 Phase 定义 */
export interface TeamPhase {
  id: string;
  name: string;
  description: string;
  status: PhaseStatus;
  assigneeIds: string[];       // 负责此 Phase 的专家 ID
  isParallel: boolean;         // 是否并行执行
  gateCondition?: string;      // 门禁条件描述
  outputs: string[];           // 此 Phase 的产出物
}

/** 团队成员（扩展 Expert，增加团队角色） */
export interface TeamExpert {
  expertId: string;            // 关联 expertStore 中的 Expert.id
  role: 'lead' | 'member';    // 团队角色
  assignedPhases: string[];    // 参与的 Phase ID 列表
  status: 'idle' | 'working' | 'waiting' | 'done';
}

/** 团队模板（预设） */
export interface TeamTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  phases: Omit<TeamPhase, 'status'>[];  // 模板不含运行时状态
  members: Omit<TeamExpert, 'status'>[];
}

/** 团队实例（运行时） */
export interface TeamInstance {
  id: string;
  templateId: string;
  name: string;
  status: 'forming' | 'active' | 'paused' | 'completed' | 'error';
  leadExpertId: string;
  members: TeamExpert[];
  phases: TeamPhase[];
  currentPhaseIndex: number;
  sessionId: string;           // 关联 chatStore 中的会话
  createdAt: string;
  updatedAt: string;
  taskList: TeamTask[];
}

/** 团队任务 */
export interface TeamTask {
  id: string;
  subject: string;
  description: string;
  ownerExpertId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  phaseId: string;
  result?: string;
  createdAt: string;
}
```

### 4.2 新增 Zustand Store

在 `frontend/src/store/` 新增 `teamStore.ts`：

```typescript
// frontend/src/store/teamStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  TeamTemplate,
  TeamInstance,
  TeamPhase,
  TeamExpert,
  TeamTask,
} from '@/types/team';

// ============================================================
// 预设团队模板
// ============================================================

const TEAM_TEMPLATES: TeamTemplate[] = [
  {
    id: 'eia-approval',
    name: '环评审批团队',
    description: '环境影响评价审批全流程协作',
    icon: 'FileTextOutlined',
    color: '#722ed1',
    phases: [
      {
        id: 'eia-p0',
        name: '项目信息收集',
        description: '收集项目基本信息、确认环评类别',
        assigneeIds: ['gaia', 'public'],
        isParallel: false,
        gateCondition: '项目信息完整、环评类别确定',
        outputs: ['项目信息表', '环评类别确认'],
      },
      {
        id: 'eia-p1',
        name: '技术审查',
        description: '环评报告技术审查 + 排污许可合规预检',
        assigneeIds: ['eia', 'permit'],
        isParallel: true,
        gateCondition: '技术审查通过 + 合规校验无重大问题',
        outputs: ['技术审查意见', '合规预检报告'],
      },
      {
        id: 'eia-p2',
        name: '合规校验',
        description: '法规标准合规性全面检查',
        assigneeIds: ['enforcement'],
        isParallel: false,
        gateCondition: '无重大违规项',
        outputs: ['合规校验报告'],
      },
      {
        id: 'eia-p3',
        name: '报告生成',
        description: '综合生成环评审批报告',
        assigneeIds: ['eia'],
        isParallel: false,
        gateCondition: '报告内容完整、格式合规',
        outputs: ['环评审批报告'],
      },
      {
        id: 'eia-p4',
        name: '审批确认',
        description: 'GAIA 汇总所有产出，确认审批结论',
        assigneeIds: ['gaia'],
        isParallel: false,
        outputs: ['审批结论'],
      },
    ],
    members: [
      { expertId: 'gaia', role: 'lead', assignedPhases: ['eia-p0', 'eia-p4'] },
      { expertId: 'eia', role: 'member', assignedPhases: ['eia-p1', 'eia-p3'] },
      { expertId: 'permit', role: 'member', assignedPhases: ['eia-p1'] },
      { expertId: 'enforcement', role: 'member', assignedPhases: ['eia-p2'] },
      { expertId: 'env-monitoring', role: 'member', assignedPhases: ['eia-p0'] },
    ],
  },
  {
    id: 'emergency-response',
    name: '应急响应团队',
    description: '突发环境事件应急指挥与协同',
    icon: 'AlertOutlined',
    color: '#fa8c16',
    phases: [
      {
        id: 'er-p0',
        name: '事件研判',
        description: '事件定性与影响范围评估',
        assigneeIds: ['emergency', 'env-monitoring'],
        isParallel: false,
        gateCondition: '事件等级确定、影响范围清晰',
        outputs: ['事件研判报告'],
      },
      {
        id: 'er-p1',
        name: '应急指挥',
        description: '制定应急方案、资源调度',
        assigneeIds: ['emergency'],
        isParallel: false,
        gateCondition: '应急方案获批',
        outputs: ['应急方案', '资源调度表'],
      },
      {
        id: 'er-p2',
        name: '跨端协同',
        description: '执法取证 + 水质分析并行',
        assigneeIds: ['enforcement', 'water'],
        isParallel: true,
        outputs: ['取证报告', '水质分析报告'],
      },
      {
        id: 'er-p3',
        name: '处置报告',
        description: 'GAIA 汇总处置情况',
        assigneeIds: ['gaia'],
        isParallel: false,
        outputs: ['应急处置报告'],
      },
    ],
    members: [
      { expertId: 'emergency', role: 'lead', assignedPhases: ['er-p0', 'er-p1'] },
      { expertId: 'gaia', role: 'member', assignedPhases: ['er-p3'] },
      { expertId: 'env-monitoring', role: 'member', assignedPhases: ['er-p0'] },
      { expertId: 'enforcement', role: 'member', assignedPhases: ['er-p2'] },
      { expertId: 'water', role: 'member', assignedPhases: ['er-p2'] },
    ],
  },
  {
    id: 'eco-inspection',
    name: '生态督察团队',
    description: '生态环保督察全流程',
    icon: 'AuditOutlined',
    color: '#cf1322',
    phases: [
      {
        id: 'ei-p0',
        name: '线索收集',
        description: '收集督察线索、问题初步梳理',
        assigneeIds: ['inspection', 'gaia'],
        isParallel: false,
        gateCondition: '线索确认、督察对象明确',
        outputs: ['线索清单'],
      },
      {
        id: 'ei-p1',
        name: '现场核查',
        description: '执法取证 + 环评合规并行核查',
        assigneeIds: ['enforcement', 'eia'],
        isParallel: true,
        gateCondition: '核查完毕、问题清单确认',
        outputs: ['取证材料', '合规审查意见'],
      },
      {
        id: 'ei-p2',
        name: '问题认定',
        description: '汇总核查结果，认定违规问题',
        assigneeIds: ['inspection'],
        isParallel: false,
        gateCondition: '问题认定完成',
        outputs: ['问题认定报告'],
      },
      {
        id: 'ei-p3',
        name: '整改方案',
        description: '制定生态修复整改方案',
        assigneeIds: ['restoration'],
        isParallel: false,
        gateCondition: '整改方案可执行',
        outputs: ['整改方案'],
      },
      {
        id: 'ei-p4',
        name: '督察报告',
        description: '生成督察报告',
        assigneeIds: ['inspection', 'gaia'],
        isParallel: false,
        outputs: ['督察报告'],
      },
    ],
    members: [
      { expertId: 'inspection', role: 'lead', assignedPhases: ['ei-p0', 'ei-p2', 'ei-p4'] },
      { expertId: 'gaia', role: 'member', assignedPhases: ['ei-p0', 'ei-p4'] },
      { expertId: 'enforcement', role: 'member', assignedPhases: ['ei-p1'] },
      { expertId: 'eia', role: 'member', assignedPhases: ['ei-p1'] },
      { expertId: 'restoration', role: 'member', assignedPhases: ['ei-p3'] },
    ],
  },
];

// ============================================================
// State Interface
// ============================================================

interface TeamState {
  templates: TeamTemplate[];
  instances: TeamInstance[];
  activeTeamId: string | null;

  // Actions
  createTeamFromTemplate: (templateId: string, name?: string) => string;
  deleteTeam: (teamId: string) => void;
  setActiveTeam: (teamId: string | null) => void;

  // Phase 控制
  advancePhase: (teamId: string) => void;
  updatePhaseStatus: (teamId: string, phaseId: string, status: TeamPhase['status']) => void;

  // 成员状态
  updateMemberStatus: (teamId: string, expertId: string, status: TeamExpert['status']) => void;

  // 任务管理
  addTask: (teamId: string, task: Omit<TeamTask, 'id' | 'createdAt'>) => void;
  updateTaskStatus: (teamId: string, taskId: string, status: TeamTask['status'], result?: string) => void;

  // Lead 决策
  leadApprove: (teamId: string, phaseId: string, approved: boolean, comment?: string) => void;
}

// ============================================================
// Store
// ============================================================

export const useTeamStore = create<TeamState>()(
  persist(
    (set, get) => ({
      templates: TEAM_TEMPLATES,
      instances: [],
      activeTeamId: null,

      createTeamFromTemplate: (templateId, name) => {
        const template = get().templates.find(t => t.id === templateId);
        if (!template) throw new Error(`Template ${templateId} not found`);

        const teamId = `team-${Date.now()}`;
        const leadExpertId = template.members.find(m => m.role === 'lead')?.expertId || 'gaia';

        const instance: TeamInstance = {
          id: teamId,
          templateId,
          name: name || template.name,
          status: 'forming',
          leadExpertId,
          members: template.members.map(m => ({ ...m, status: 'idle' as const })),
          phases: template.phases.map(p => ({ ...p, status: 'pending' as const })),
          currentPhaseIndex: 0,
          sessionId: '', // 创建后由 ChatLayout 关联
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          taskList: [],
        };

        // 自动激活第一个 Phase
        if (instance.phases.length > 0) {
          instance.phases[0].status = 'in_progress';
          instance.status = 'active';
        }

        set(state => ({
          instances: [...state.instances, instance],
          activeTeamId: teamId,
        }));

        return teamId;
      },

      deleteTeam: (teamId) => {
        set(state => ({
          instances: state.instances.filter(t => t.id !== teamId),
          activeTeamId: state.activeTeamId === teamId ? null : state.activeTeamId,
        }));
      },

      setActiveTeam: (teamId) => set({ activeTeamId: teamId }),

      advancePhase: (teamId) => {
        set(state => {
          const instances = state.instances.map(inst => {
            if (inst.id !== teamId) return inst;

            const currentPhase = inst.phases[inst.currentPhaseIndex];
            if (!currentPhase || currentPhase.status !== 'completed') return inst;

            const nextIndex = inst.currentPhaseIndex + 1;
            const updatedPhases = [...inst.phases];

            if (nextIndex < updatedPhases.length) {
              updatedPhases[nextIndex] = { ...updatedPhases[nextIndex], status: 'in_progress' };
            }

            return {
              ...inst,
              phases: updatedPhases,
              currentPhaseIndex: nextIndex,
              status: nextIndex >= updatedPhases.length ? 'completed' : 'active',
              updatedAt: new Date().toISOString(),
            };
          });

          return { instances };
        });
      },

      updatePhaseStatus: (teamId, phaseId, status) => {
        set(state => ({
          instances: state.instances.map(inst => {
            if (inst.id !== teamId) return inst;
            return {
              ...inst,
              phases: inst.phases.map(p => p.id === phaseId ? { ...p, status } : p),
              updatedAt: new Date().toISOString(),
            };
          }),
        }));
      },

      updateMemberStatus: (teamId, expertId, status) => {
        set(state => ({
          instances: state.instances.map(inst => {
            if (inst.id !== teamId) return inst;
            return {
              ...inst,
              members: inst.members.map(m =>
                m.expertId === expertId ? { ...m, status } : m
              ),
              updatedAt: new Date().toISOString(),
            };
          }),
        }));
      },

      addTask: (teamId, task) => {
        const newTask: TeamTask = {
          ...task,
          id: `task-${Date.now()}`,
          createdAt: new Date().toISOString(),
        };
        set(state => ({
          instances: state.instances.map(inst => {
            if (inst.id !== teamId) return inst;
            return {
              ...inst,
              taskList: [...inst.taskList, newTask],
              updatedAt: new Date().toISOString(),
            };
          }),
        }));
      },

      updateTaskStatus: (teamId, taskId, status, result) => {
        set(state => ({
          instances: state.instances.map(inst => {
            if (inst.id !== teamId) return inst;
            return {
              ...inst,
              taskList: inst.taskList.map(t =>
                t.id === taskId ? { ...t, status, result: result || t.result } : t
              ),
              updatedAt: new Date().toISOString(),
            };
          }),
        }));
      },

      leadApprove: (teamId, phaseId, approved, comment) => {
        const state = get();
        if (approved) {
          state.updatePhaseStatus(teamId, phaseId, 'completed');
          state.advancePhase(teamId);
        } else {
          state.updatePhaseStatus(teamId, phaseId, 'blocked');
        }
      },
    }),
    {
      name: 'ecomind-team-storage',
      partialize: (state) => ({
        instances: state.instances,
        activeTeamId: state.activeTeamId,
      }),
    }
  )
);
```

### 4.3 扩展 Expert 类型

在 `frontend/src/types/expert.ts` 中扩展：

```typescript
// 在 Expert interface 中新增字段
export interface Expert {
  // ... 现有字段保持不变 ...

  /** 新增：专家可担任的团队角色 */
  teamRole?: 'lead' | 'member' | 'both';

  /** 新增：专家专属 Soul ID（后端人格标识） */
  soulId: string;  // 默认值 = expert.id，如 'gaia' -> 'gaia'

  /** 新增：专家协作模式 */
  collaborationMode: 'solo' | 'team' | 'both';

  /** 新增：专家可参与的工作流类型 */
  supportedWorkflows: string[];  // 如 ['eia-approval', 'eco-inspection']
}
```

### 4.4 更新 expertStore 默认值

在 `expertStore.ts` 的 `DEFAULT_EXPERTS` 中为每个专家补充新字段：

```typescript
// 示例：GAIA 生态主控
{
  id: 'gaia',
  name: 'gaia',
  displayName: 'GAIA 生态主控',
  // ... 现有字段 ...
  soulId: 'gaia',                          // 新增
  teamRole: 'both',                        // 新增：可 Lead 可 Member
  collaborationMode: 'both',               // 新增：可单聊可团队
  supportedWorkflows: ['eia-approval', 'emergency-response', 'eco-inspection'], // 新增
},

// 示例：执法监察专家
{
  id: 'enforcement',
  name: 'enforcement',
  displayName: '执法监察专家',
  // ... 现有字段 ...
  soulId: 'enforcement',                   // 新增
  teamRole: 'member',                      // 新增：主要是成员
  collaborationMode: 'both',               // 新增
  supportedWorkflows: ['eia-approval', 'emergency-response', 'eco-inspection'], // 新增
},
```

### 4.5 新增前端组件

#### 4.5.1 团队组建面板 `TeamLauncher.tsx`

位于 `frontend/src/components/Team/TeamLauncher.tsx`：

```
┌─────────────────────────────────┐
│  🚀 组建专家团队                  │
├─────────────────────────────────┤
│                                 │
│  选择团队模板：                    │
│  ┌─────────────────────────┐    │
│  │ 📋 环评审批团队           │    │
│  │ 🚨 应急响应团队           │    │
│  │ 🔍 生态督察团队           │    │
│  └─────────────────────────┘    │
│                                 │
│  团队名称：[湘江流域环评______]    │
│                                 │
│  团队成员：                      │
│  🟢 GAIA 生态主控  (Lead)       │
│  🟢 环评审批专家               │
│  🟢 排污许可专家               │
│  🟢 执法监察专家               │
│  🟢 环境监测专家               │
│                                 │
│  [   启动团队   ]               │
└─────────────────────────────────┘
```

#### 4.5.2 团队进度面板 `TeamProgress.tsx`

位于 `frontend/src/components/Team/TeamProgress.tsx`：

```
┌─────────────────────────────────────┐
│  环评审批团队 · 湘江流域环评          │
│  Lead: GAIA 生态主控                │
├─────────────────────────────────────┤
│                                     │
│  Phase 进度：                       │
│  ✅ Phase 0: 项目信息收集     已完成  │
│  🔄 Phase 1: 技术审查        进行中  │
│     🟢 环评审批专家 - 技术审查中     │
│     🟢 排污许可专家 - 合规预检中     │
│  ⏳ Phase 2: 合规校验        等待    │
│  ⏳ Phase 3: 报告生成        等待    │
│  ⏳ Phase 4: 审批确认        等待    │
│                                     │
│  任务列表：                         │
│  ✅ 收集项目基本信息                 │
│  ✅ 确认环评类别                     │
│  🔄 技术审查意见                     │
│  🔄 合规预检报告                     │
│                                     │
│  [  门禁检查  ] [  暂停团队  ]       │
└─────────────────────────────────────┘
```

#### 4.5.3 Chat 页面集成

在 `Chat/index.tsx` 中集成团队模式：

```typescript
// 当 activeTeamId 存在时，Chat 页面切换为团队模式
// - 顶部显示团队名 + Phase 进度条
// - 消息列表中，每条消息标注来源专家
// - 底部输入区增加"团队指令"模式：
//   - @GAIA — 指定 Lead 处理
//   - @all — 广播给全员
//   - /phase — 查看 Phase 状态
//   - /approve — Lead 审批通过当前 Phase
//   - /reject — Lead 驳回当前 Phase
```

### 4.6 Sidebar 扩展

在现有 `ExpertList.tsx` 侧栏下方新增"团队"折叠区：

```
🌿 专家
  GAIA 生态主控
  环境监测专家
  ...

🚀 团队
  + 新建团队
  📋 环评审批团队 (进行中)
  🚨 应急响应团队 (已完成)
```

---

## 5. 后端集成方案

### 5.1 新增 API Schema

在 `backend/api/schemas/` 新增 `team.py`：

```python
# backend/api/schemas/team.py

from __future__ import annotations
from datetime import datetime
from enum import Enum
from typing import Any, Optional
from pydantic import BaseModel, Field, ConfigDict


class PhaseStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    BLOCKED = "blocked"


class TeamStatus(str, Enum):
    FORMING = "forming"
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETED = "completed"
    ERROR = "error"


class TeamMemberRole(str, Enum):
    LEAD = "lead"
    MEMBER = "member"


class MemberStatus(str, Enum):
    IDLE = "idle"
    WORKING = "working"
    WAITING = "waiting"
    DONE = "done"


class TeamPhaseSchema(BaseModel):
    id: str
    name: str
    description: str
    status: PhaseStatus = PhaseStatus.PENDING
    assignee_ids: list[str] = Field(default_factory=list)
    is_parallel: bool = False
    gate_condition: Optional[str] = None
    outputs: list[str] = Field(default_factory=list)


class TeamMemberSchema(BaseModel):
    expert_id: str
    role: TeamMemberRole
    assigned_phases: list[str] = Field(default_factory=list)
    status: MemberStatus = MemberStatus.IDLE


class TeamTaskSchema(BaseModel):
    id: str
    subject: str
    description: str
    owner_expert_id: str
    status: str = "pending"
    phase_id: str
    result: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.now)


class TeamTemplateSchema(BaseModel):
    id: str
    name: str
    description: str
    icon: str
    color: str
    phases: list[TeamPhaseSchema]
    members: list[TeamMemberSchema]


class TeamInstanceSchema(BaseModel):
    id: str
    template_id: str
    name: str
    status: TeamStatus = TeamStatus.FORMING
    lead_expert_id: str
    members: list[TeamMemberSchema] = Field(default_factory=list)
    phases: list[TeamPhaseSchema] = Field(default_factory=list)
    current_phase_index: int = 0
    session_id: Optional[str] = None
    task_list: list[TeamTaskSchema] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)


class CreateTeamRequest(BaseModel):
    template_id: str = Field(..., description="团队模板 ID")
    name: Optional[str] = Field(None, description="团队实例名称")
    customizations: dict[str, Any] = Field(default_factory=dict, description="自定义参数")


class TeamResponse(BaseModel):
    team: TeamInstanceSchema


class TeamListResponse(BaseModel):
    teams: list[TeamInstanceSchema]
    total: int


class PhaseActionRequest(BaseModel):
    action: str = Field(..., description="approve | reject | pause | resume")
    comment: Optional[str] = None


class TeamMessageRequest(BaseModel):
    """向团队发送消息"""
    message: str = Field(..., min_length=1)
    target_expert_id: Optional[str] = Field(None, description="指定专家，None=广播给 Lead")
    phase_id: Optional[str] = None
```

### 5.2 新增 TeamService

在 `backend/api/services/` 新增 `team_service.py`：

```python
# backend/api/services/team_service.py

"""
团队协作服务

核心逻辑：
1. 团队模板 -> 创建团队实例
2. 团队实例 -> 批量创建 TaijiAgent 实例（每个成员一个）
3. Phase 推进 -> Lead 决策 -> 任务分发 -> 成员执行
4. 成员产出 -> Lead 汇总 -> Phase 门禁 -> 下一 Phase
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime
from typing import Any, Optional

from api.schemas.team import (
    CreateTeamRequest,
    MemberStatus,
    PhaseStatus,
    TeamInstanceSchema,
    TeamMemberSchema,
    TeamMessageRequest,
    TeamPhaseSchema,
    TeamStatus,
    TeamTaskSchema,
    PhaseActionRequest,
    TeamResponse,
    TeamListResponse,
)
from api.services.agent_service import AgentService, get_agent_service

logger = logging.getLogger(__name__)


# ============================================================
# 团队模板定义（与前端保持一致）
# ============================================================

TEAM_TEMPLATES: dict[str, dict] = {
    "eia-approval": {
        "id": "eia-approval",
        "name": "环评审批团队",
        "description": "环境影响评价审批全流程协作",
        "icon": "FileTextOutlined",
        "color": "#722ed1",
        "lead_expert_id": "gaia",
        "phases": [
            {"id": "eia-p0", "name": "项目信息收集", "description": "收集项目基本信息、确认环评类别",
             "assignee_ids": ["gaia", "public"], "is_parallel": False,
             "gate_condition": "项目信息完整、环评类别确定", "outputs": ["项目信息表", "环评类别确认"]},
            {"id": "eia-p1", "name": "技术审查", "description": "环评报告技术审查 + 排污许可合规预检",
             "assignee_ids": ["eia", "permit"], "is_parallel": True,
             "gate_condition": "技术审查通过 + 合规校验无重大问题", "outputs": ["技术审查意见", "合规预检报告"]},
            {"id": "eia-p2", "name": "合规校验", "description": "法规标准合规性全面检查",
             "assignee_ids": ["enforcement"], "is_parallel": False,
             "gate_condition": "无重大违规项", "outputs": ["合规校验报告"]},
            {"id": "eia-p3", "name": "报告生成", "description": "综合生成环评审批报告",
             "assignee_ids": ["eia"], "is_parallel": False,
             "gate_condition": "报告内容完整、格式合规", "outputs": ["环评审批报告"]},
            {"id": "eia-p4", "name": "审批确认", "description": "GAIA 汇总所有产出，确认审批结论",
             "assignee_ids": ["gaia"], "is_parallel": False,
             "outputs": ["审批结论"]},
        ],
        "members": [
            {"expert_id": "gaia", "role": "lead", "assigned_phases": ["eia-p0", "eia-p4"]},
            {"expert_id": "eia", "role": "member", "assigned_phases": ["eia-p1", "eia-p3"]},
            {"expert_id": "permit", "role": "member", "assigned_phases": ["eia-p1"]},
            {"expert_id": "enforcement", "role": "member", "assigned_phases": ["eia-p2"]},
            {"expert_id": "env-monitoring", "role": "member", "assigned_phases": ["eia-p0"]},
        ],
    },
    "emergency-response": {
        "id": "emergency-response",
        "name": "应急响应团队",
        "description": "突发环境事件应急指挥与协同",
        "icon": "AlertOutlined",
        "color": "#fa8c16",
        "lead_expert_id": "emergency",
        "phases": [
            {"id": "er-p0", "name": "事件研判", "description": "事件定性与影响范围评估",
             "assignee_ids": ["emergency", "env-monitoring"], "is_parallel": False,
             "gate_condition": "事件等级确定、影响范围清晰", "outputs": ["事件研判报告"]},
            {"id": "er-p1", "name": "应急指挥", "description": "制定应急方案、资源调度",
             "assignee_ids": ["emergency"], "is_parallel": False,
             "gate_condition": "应急方案获批", "outputs": ["应急方案", "资源调度表"]},
            {"id": "er-p2", "name": "跨端协同", "description": "执法取证 + 水质分析并行",
             "assignee_ids": ["enforcement", "water"], "is_parallel": True,
             "outputs": ["取证报告", "水质分析报告"]},
            {"id": "er-p3", "name": "处置报告", "description": "GAIA 汇总处置情况",
             "assignee_ids": ["gaia"], "is_parallel": False,
             "outputs": ["应急处置报告"]},
        ],
        "members": [
            {"expert_id": "emergency", "role": "lead", "assigned_phases": ["er-p0", "er-p1"]},
            {"expert_id": "gaia", "role": "member", "assigned_phases": ["er-p3"]},
            {"expert_id": "env-monitoring", "role": "member", "assigned_phases": ["er-p0"]},
            {"expert_id": "enforcement", "role": "member", "assigned_phases": ["er-p2"]},
            {"expert_id": "water", "role": "member", "assigned_phases": ["er-p2"]},
        ],
    },
    "eco-inspection": {
        "id": "eco-inspection",
        "name": "生态督察团队",
        "description": "生态环保督察全流程",
        "icon": "AuditOutlined",
        "color": "#cf1322",
        "lead_expert_id": "inspection",
        "phases": [
            {"id": "ei-p0", "name": "线索收集", "description": "收集督察线索、问题初步梳理",
             "assignee_ids": ["inspection", "gaia"], "is_parallel": False,
             "gate_condition": "线索确认、督察对象明确", "outputs": ["线索清单"]},
            {"id": "ei-p1", "name": "现场核查", "description": "执法取证 + 环评合规并行核查",
             "assignee_ids": ["enforcement", "eia"], "is_parallel": True,
             "gate_condition": "核查完毕、问题清单确认", "outputs": ["取证材料", "合规审查意见"]},
            {"id": "ei-p2", "name": "问题认定", "description": "汇总核查结果，认定违规问题",
             "assignee_ids": ["inspection"], "is_parallel": False,
             "gate_condition": "问题认定完成", "outputs": ["问题认定报告"]},
            {"id": "ei-p3", "name": "整改方案", "description": "制定生态修复整改方案",
             "assignee_ids": ["restoration"], "is_parallel": False,
             "gate_condition": "整改方案可执行", "outputs": ["整改方案"]},
            {"id": "ei-p4", "name": "督察报告", "description": "生成督察报告",
             "assignee_ids": ["inspection", "gaia"], "is_parallel": False,
             "outputs": ["督察报告"]},
        ],
        "members": [
            {"expert_id": "inspection", "role": "lead", "assigned_phases": ["ei-p0", "ei-p2", "ei-p4"]},
            {"expert_id": "gaia", "role": "member", "assigned_phases": ["ei-p0", "ei-p4"]},
            {"expert_id": "enforcement", "role": "member", "assigned_phases": ["ei-p1"]},
            {"expert_id": "eia", "role": "member", "assigned_phases": ["ei-p1"]},
            {"expert_id": "restoration", "role": "member", "assigned_phases": ["ei-p3"]},
        ],
    },
}


# ============================================================
# 专家 -> AgentConfig 映射
# ============================================================

EXPERT_AGENT_CONFIGS: dict[str, dict] = {
    "gaia": {
        "provider": "qwen",
        "model": "qwen-max",
        "soul": "gaia",
        "temperature": 0.7,
        "max_tokens": 4096,
        "taiji_verify_enabled": True,
    },
    "env-monitoring": {
        "provider": "qwen",
        "model": "qwen-plus",
        "soul": "env-monitoring",
        "temperature": 0.5,
        "max_tokens": 4096,
        "taiji_verify_enabled": True,
    },
    "enforcement": {
        "provider": "qwen",
        "model": "qwen-max",
        "soul": "enforcement",
        "temperature": 0.3,
        "max_tokens": 4096,
        "taiji_verify_enabled": True,
    },
    "eia": {
        "provider": "qwen",
        "model": "qwen-max",
        "soul": "eia",
        "temperature": 0.4,
        "max_tokens": 8192,
        "taiji_verify_enabled": True,
    },
    "permit": {
        "provider": "qwen",
        "model": "qwen-plus",
        "soul": "permit",
        "temperature": 0.5,
        "max_tokens": 4096,
        "taiji_verify_enabled": True,
    },
    "biodiversity": {
        "provider": "qwen",
        "model": "qwen-plus",
        "soul": "biodiversity",
        "temperature": 0.6,
        "max_tokens": 4096,
        "taiji_verify_enabled": True,
    },
    "carbon": {
        "provider": "qwen",
        "model": "qwen-plus",
        "soul": "carbon",
        "temperature": 0.5,
        "max_tokens": 4096,
        "taiji_verify_enabled": True,
    },
    "emergency": {
        "provider": "qwen",
        "model": "qwen-max",
        "soul": "emergency",
        "temperature": 0.3,
        "max_tokens": 4096,
        "taiji_verify_enabled": True,
    },
    "restoration": {
        "provider": "qwen",
        "model": "qwen-plus",
        "soul": "restoration",
        "temperature": 0.6,
        "max_tokens": 4096,
        "taiji_verify_enabled": True,
    },
    "inspection": {
        "provider": "qwen",
        "model": "qwen-max",
        "soul": "inspection",
        "temperature": 0.3,
        "max_tokens": 4096,
        "taiji_verify_enabled": True,
    },
    "public": {
        "provider": "qwen",
        "model": "qwen-turbo",
        "soul": "public",
        "temperature": 0.7,
        "max_tokens": 2048,
        "taiji_verify_enabled": False,
    },
    "water": {
        "provider": "qwen",
        "model": "qwen-plus",
        "soul": "water",
        "temperature": 0.5,
        "max_tokens": 4096,
        "taiji_verify_enabled": True,
    },
}


class TeamRecord:
    """团队运行时记录"""

    def __init__(self, team_id: str, template: dict, name: str | None = None):
        self.team_id = team_id
        self.template_id = template["id"]
        self.name = name or template["name"]
        self.status = TeamStatus.FORMING
        self.lead_expert_id = template["lead_expert_id"]

        # 初始化 Phases
        self.phases: list[dict] = []
        for p in template["phases"]:
            self.phases.append({**p, "status": PhaseStatus.PENDING})

        # 初始化 Members
        self.members: list[dict] = []
        for m in template["members"]:
            self.members.append({**m, "status": MemberStatus.IDLE})

        self.current_phase_index = 0
        self.session_id: str | None = None
        self.task_list: list[dict] = []
        self.created_at = datetime.now()
        self.updated_at = datetime.now()

        # 每个 expert_id 对应的 agent_id
        self.expert_agent_map: dict[str, str] = {}

    def to_schema(self) -> TeamInstanceSchema:
        """转换为 API Schema"""
        return TeamInstanceSchema(
            id=self.team_id,
            template_id=self.template_id,
            name=self.name,
            status=self.status,
            lead_expert_id=self.lead_expert_id,
            members=[TeamMemberSchema(**m) for m in self.members],
            phases=[TeamPhaseSchema(**p) for p in self.phases],
            current_phase_index=self.current_phase_index,
            session_id=self.session_id,
            task_list=[TeamTaskSchema(**t) for t in self.task_list],
            created_at=self.created_at,
            updated_at=self.updated_at,
        )


class TeamService:
    """
    团队协作服务

    核心职责：
    1. 从模板创建团队实例
    2. 批量初始化成员 Agent（TaijiAgent 实例）
    3. Phase 推进控制
    4. 任务分发与消息路由
    5. Lead 决策审批
    """

    def __init__(self, agent_service: AgentService | None = None):
        self._teams: dict[str, TeamRecord] = {}
        self._agent_service = agent_service or get_agent_service()

    async def create_team(self, request: CreateTeamRequest) -> TeamInstanceSchema:
        """从模板创建团队"""
        template = TEAM_TEMPLATES.get(request.template_id)
        if not template:
            raise ValueError(f"模板 {request.template_id} 不存在")

        team_id = f"team-{uuid.uuid4().hex[:8]}"
        record = TeamRecord(team_id=team_id, template=template, name=request.name)

        # 批量创建成员 Agent
        for member in record.members:
            expert_id = member["expert_id"]
            config = EXPERT_AGENT_CONFIGS.get(expert_id)
            if not config:
                logger.warning(f"专家 {expert_id} 无 Agent 配置，跳过")
                continue

            from api.schemas.agent import AgentCreateRequest, AgentProvider

            agent_request = AgentCreateRequest(
                name=f"{template['name']} - {expert_id}",
                description=f"团队成员：{expert_id}",
                provider=AgentProvider(config["provider"]),
                model=config["model"],
                soul=config["soul"],
                temperature=config["temperature"],
                max_tokens=config["max_tokens"],
                taiji_verify_enabled=config["taiji_verify_enabled"],
                metadata={"team_id": team_id, "expert_id": expert_id, "role": member["role"]},
            )

            agent_response = await self._agent_service.create_agent(agent_request)
            record.expert_agent_map[expert_id] = agent_response.agent_id
            logger.info(f"团队成员 {expert_id} -> Agent {agent_response.agent_id}")

        # 激活第一个 Phase
        if record.phases:
            record.phases[0]["status"] = PhaseStatus.IN_PROGRESS
            record.status = TeamStatus.ACTIVE

            # 激活对应成员
            for member in record.members:
                if record.phases[0]["id"] in member.get("assigned_phases", []):
                    member["status"] = MemberStatus.WORKING

        self._teams[team_id] = record
        return record.to_schema()

    async def list_teams(self) -> TeamListResponse:
        """列出所有团队"""
        teams = [r.to_schema() for r in self._teams.values()]
        return TeamListResponse(teams=teams, total=len(teams))

    async def get_team(self, team_id: str) -> TeamInstanceSchema | None:
        """获取团队详情"""
        record = self._teams.get(team_id)
        return record.to_schema() if record else None

    async def advance_phase(self, team_id: str) -> TeamInstanceSchema | None:
        """推进到下一 Phase"""
        record = self._teams.get(team_id)
        if not record:
            return None

        current = record.phases[record.current_phase_index]
        if current["status"] != PhaseStatus.COMPLETED:
            raise ValueError(f"当前 Phase {current['id']} 尚未完成，无法推进")

        next_index = record.current_phase_index + 1
        if next_index >= len(record.phases):
            record.status = TeamStatus.COMPLETED
            record.updated_at = datetime.now()
            return record.to_schema()

        # 推进
        record.current_phase_index = next_index
        record.phases[next_index]["status"] = PhaseStatus.IN_PROGRESS

        # 更新成员状态
        next_phase = record.phases[next_index]
        for member in record.members:
            if next_phase["id"] in member.get("assigned_phases", []):
                member["status"] = MemberStatus.WORKING
            elif member["status"] == MemberStatus.WORKING:
                member["status"] = MemberStatus.DONE

        record.updated_at = datetime.now()

        # WebSocket 推送
        try:
            from api.main import ws_manager
            ws_manager.enqueue_broadcast("team:progress", {
                "team_id": team_id,
                "phase_index": next_index,
                "phase_name": next_phase["name"],
            })
        except Exception:
            pass

        return record.to_schema()

    async def lead_action(
        self, team_id: str, phase_id: str, action: str, comment: str | None = None
    ) -> TeamInstanceSchema | None:
        """Lead 对 Phase 执行操作"""
        record = self._teams.get(team_id)
        if not record:
            return None

        phase = next((p for p in record.phases if p["id"] == phase_id), None)
        if not phase:
            return None

        if action == "approve":
            phase["status"] = PhaseStatus.COMPLETED
            return await self.advance_phase(team_id)
        elif action == "reject":
            phase["status"] = PhaseStatus.BLOCKED
            # 退回相关成员
            for member in record.members:
                if phase_id in member.get("assigned_phases", []):
                    member["status"] = MemberStatus.WORKING
        elif action == "pause":
            record.status = TeamStatus.PAUSED
        elif action == "resume":
            record.status = TeamStatus.ACTIVE

        record.updated_at = datetime.now()
        return record.to_schema()

    async def send_team_message(
        self, team_id: str, request: TeamMessageRequest
    ) -> dict:
        """向团队成员发送消息"""
        record = self._teams.get(team_id)
        if not record:
            return {"error": "团队不存在"}

        target_expert_id = request.target_expert_id or record.lead_expert_id
        agent_id = record.expert_agent_map.get(target_expert_id)

        if not agent_id:
            return {"error": f"专家 {target_expert_id} 的 Agent 不存在"}

        from api.schemas.agent import AgentMessageRequest

        # 构建 system_message，注入团队上下文
        system_message = self._build_team_context(record, target_expert_id, request.phase_id)

        agent_request = AgentMessageRequest(
            message=request.message,
            system_message=system_message,
            stream=True,
        )

        response = await self._agent_service.send_message(agent_id, agent_request)
        return {
            "expert_id": target_expert_id,
            "agent_id": agent_id,
            "response": response.message,
            "status": response.status,
        }

    def _build_team_context(
        self, record: TeamRecord, expert_id: str, phase_id: str | None = None
    ) -> str:
        """构建团队上下文 System Message"""
        current_phase = record.phases[record.current_phase_index]

        # 查找专家的团队成员信息
        member_info = next(
            (m for m in record.members if m["expert_id"] == expert_id), None
        )
        role_str = "Lead（团队负责人）" if member_info and member_info["role"] == "lead" else "成员"

        context = f"""# 团队协作上下文

你是团队「{record.name}」的{role_str}。

## 当前 Phase
- 阶段：{current_phase['name']}
- 描述：{current_phase['description']}
- 门禁条件：{current_phase.get('gate_condition', '无')}
- 预期产出：{', '.join(current_phase.get('outputs', []))}

## 团队成员
{chr(10).join(f'- {m["expert_id"]} ({m["role"]})' for m in record.members)}

## 协作规则
- 你是独立产出者，不要代写其他成员的工作
- 如果需要其他成员的产出，请明确请求
- Lead 负责汇总和决策，成员负责执行
- 每个 Phase 必须通过门禁才能进入下一阶段
"""
        return context


# 全局单例
_team_service: Optional[TeamService] = None


def get_team_service() -> TeamService:
    global _team_service
    if _team_service is None:
        _team_service = TeamService()
    return _team_service
```

### 5.3 新增 API 路由

在 `backend/api/routes/` 新增 `team.py`：

```python
# backend/api/routes/team.py

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from api.schemas.team import (
    CreateTeamRequest,
    PhaseActionRequest,
    TeamListResponse,
    TeamMessageRequest,
    TeamResponse,
    TeamTemplateSchema,
)
from api.services.team_service import TEAM_TEMPLATES, get_team_service

router = APIRouter(prefix="/teams", tags=["teams"])


@router.get("/templates", response_model=list[TeamTemplateSchema])
async def list_templates():
    """列出所有团队模板"""
    return [TeamTemplateSchema(**t) for t in TEAM_TEMPLATES.values()]


@router.post("", response_model=TeamResponse)
async def create_team(request: CreateTeamRequest):
    """从模板创建团队"""
    service = get_team_service()
    try:
        team = await service.create_team(request)
        return TeamResponse(team=team)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("", response_model=TeamListResponse)
async def list_teams():
    """列出所有团队实例"""
    service = get_team_service()
    return await service.list_teams()


@router.get("/{team_id}", response_model=TeamResponse)
async def get_team(team_id: str):
    """获取团队详情"""
    service = get_team_service()
    team = await service.get_team(team_id)
    if not team:
        raise HTTPException(status_code=404, detail="团队不存在")
    return TeamResponse(team=team)


@router.post("/{team_id}/advance", response_model=TeamResponse)
async def advance_phase(team_id: str):
    """推进到下一 Phase"""
    service = get_team_service()
    try:
        team = await service.advance_phase(team_id)
        if not team:
            raise HTTPException(status_code=404, detail="团队不存在")
        return TeamResponse(team=team)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{team_id}/phase/{phase_id}/action", response_model=TeamResponse)
async def phase_action(team_id: str, phase_id: str, request: PhaseActionRequest):
    """Lead 对 Phase 执行操作"""
    service = get_team_service()
    team = await service.lead_action(team_id, phase_id, request.action, request.comment)
    if not team:
        raise HTTPException(status_code=404, detail="团队或 Phase 不存在")
    return TeamResponse(team=team)


@router.post("/{team_id}/message")
async def send_team_message(team_id: str, request: TeamMessageRequest):
    """向团队成员发送消息"""
    service = get_team_service()
    result = await service.send_team_message(team_id, request)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.delete("/{team_id}")
async def delete_team(team_id: str):
    """删除团队"""
    # TODO: 清理关联的 Agent 实例
    raise HTTPException(status_code=501, detail="暂未实现")
```

### 5.4 注册路由

在 `backend/api/main.py` 中注册新路由：

```python
# 在 create_app() 中添加：

from api.routes.team import router as team_router
app.include_router(team_router, prefix="/api")
```

---

## 6. Soul 人格系统集成

### 6.1 为每个专家创建专属 Soul

当前所有专家都使用 `default.yaml`，需要为每个专家创建独立的 Soul 文件。

在 `~/.opentaiji/souls/` 目录下创建以下 12 个 YAML 文件：

#### `gaia.yaml` — GAIA 生态主控

```yaml
id: gaia
name: "GAIA 生态主控"
version: 1

layers:
  boundaries:
    - "不产生有害、违法或不道德内容"
    - "永远坦诚承认不确定性"
    - "不捏造法规条文或环境数据"
    - "不冒充人类身份或官方机构"
    - "涉及审批决策时必须提醒需人工确认"

  ethics:
    - "以生态保护为最高原则"
    - "客观中立，不偏袒任何利益方"
    - "尊重科学数据，不随主观意愿曲解"
    - "主动提醒安全风险和合规义务"

  character:
    traits:
      - "全局视野，善于协调多方资源"
      - "决策审慎，重视门禁检查"
      - "表达清晰，结构化输出"
      - "主动识别并标注不确定性"
    style:
      verbosity: "适中，关键决策详尽"
      tone: "专业、权威、可靠"
      language: "中文优先，技术术语中英对照"
    taiji_aspect:
      阳: "协调、决策、资源调度"
      阴: "倾听、汇总、共情理解"

context:
  domain: "生态环境治理，擅长多专家协调、政策解读、法规查询"
  special_instructions:
    - "作为团队Lead，负责汇总各专家产出"
    - "Phase推进前必须检查门禁条件"
    - "所有审批类结论必须标注'需人工确认'"
    - "优先引用法规标准原文，标注出处"
```

#### `enforcement.yaml` — 执法监察专家

```yaml
id: enforcement
name: "执法监察专家"
version: 1

layers:
  boundaries:
    - "不代替执法人员做出处罚决定"
    - "不捏造证据或篡改监测数据"
    - "处罚建议必须标注'仅供参考，需法制审核'"
    - "不泄露举报人信息"

  ethics:
    - "严格依法行政，程序正义优先"
    - "处罚与教育并重"
    - "保护当事人合法权益"
    - "数据真实，证据链完整"

  character:
    traits:
      - "严谨细致，注重证据链"
      - "坚持原则，不畏权势"
      - "程序意识强"
      - "善用法规条款精准定性"
    style:
      verbosity: "精练，引用法规条文"
      tone: "严肃、公正、权威"
      language: "法律用语规范"

context:
  domain: "生态环境执法监察，取证辅助、违规判定、处罚建议、文书生成"
  special_instructions:
    - "引用法规必须标注完整法条编号"
    - "处罚建议必须区分'必须'和'建议'"
    - "涉及 L3 安全级操作必须触发人工审批"
    - "执法文书必须使用标准模板"
```

#### `eia.yaml` — 环评审批专家

```yaml
id: eia
name: "环评审批专家"
version: 1

layers:
  boundaries:
    - "不代替审批机关做出审批决定"
    - "技术审查意见必须标注'仅供参考'"
    - "不降低环评标准或规避敏感问题"
    - "涉及国家秘密的项目信息不输出"

  ethics:
    - "技术审查客观公正"
    - "标准适用不偏不倚"
    - "保护商业秘密"
    - "主动识别重大环境风险"

  character:
    traits:
      - "专业深入，技术细节把控严格"
      - "标准意识强"
      - "善于交叉验证数据"
      - "报告生成结构化、格式规范"
    style:
      verbosity: "详尽，技术细节充分"
      tone: "专业、审慎"
      language: "技术术语+法规条文"

context:
  domain: "环境影响评价，技术审查、合规校验、报告生成、OCR识别"
  special_instructions:
    - "审查意见必须逐条对应标准条款"
    - "重大环境影响必须标注并建议升级审批"
    - "环评报告必须包含不确定性分析章节"
    - "技术审查表格必须使用标准格式"
```

#### 其他 9 个专家 Soul 文件

按照相同模板，为 `env-monitoring`、`permit`、`biodiversity`、`carbon`、`emergency`、`restoration`、`inspection`、`public`、`water` 分别创建。每个 Soul 文件的核心差异在：

| Soul ID | boundaries 侧重点 | character.tone | domain |
|---------|-------------------|----------------|--------|
| env-monitoring | 不篡改监测数据 | 客观、数据驱动 | 实时监测、异常告警、趋势预测 |
| permit | 不代替许可机关决定 | 规范、细致 | 排污许可核发、材料审查 |
| biodiversity | 不低估生态影响 | 温和、谨慎 | 物种监测、生态评估 |
| carbon | 不虚报碳排放数据 | 精确、量化 | 碳排放核算、减排方案 |
| emergency | 不延误应急响应 | 紧迫、果断 | 应急指挥、资源调度 |
| restoration | 不推荐不可行方案 | 创新、务实 | 修复方案、效果评估 |
| inspection | 不包庇督察问题 | 严厉、公正 | 督察线索、整改跟踪 |
| public | 不泄露个人隐私 | 亲切、易懂 | 公众服务、投诉处理 |
| water | 不忽略水质异常 | 严谨、系统 | 流域分析、污染溯源 |

### 6.2 Soul 加载路径配置

在 `AgentService.create_agent()` 中，已经通过 `AgentConfig.soul` 字段指定了 Soul ID。SoulLoader 会自动从 `~/.opentaiji/souls/{soul_id}.yaml` 加载。

**无需修改引擎代码**——只需创建对应的 YAML 文件即可。

### 6.3 Soul 热更新（增强功能）

如果需要运行时修改 Soul 配置而不重启 Agent：

```python
# 在 TaijiAgent 中新增方法
async def reload_soul(self, soul_id: str | None = None):
    """热重载 Soul 配置"""
    target = soul_id or self.config.soul
    soul = self.soul_loader.load(target)
    self.config.soul = target
    # 重建 system prompt（下一轮对话生效）
    logger.info(f"Soul reloaded: {target}")
```

---

## 7. AgentConfig 扩展方案

### 7.1 当前 AgentConfig

```python
@dataclass
class AgentConfig:
    provider: str = "anthropic"
    model: str = "claude-sonnet-4-20250514"
    api_key: str | None = None
    base_url: str | None = None
    soul: str = "default"
    temperature: float = 0.7
    max_tokens: int = 4096
    max_iterations: int = 25
    taiji_verify_enabled: bool = True
    taiji_verify_threshold: float = 0.7
    self_consistency_samples: int = 3
    stream: bool = True
    workdir: str = "."
    verbose: bool = False
```

### 7.2 扩展字段

```python
@dataclass
class AgentConfig:
    # ... 现有字段保持不变 ...

    # 新增：专家标识
    expert_id: str | None = None           # 关联前端 expertStore 中的专家 ID

    # 新增：团队标识
    team_id: str | None = None             # 所属团队 ID
    team_role: str | None = None           # lead / member

    # 新增：安全等级
    safety_level: str = "L2"               # L1/L2/L3

    # 新增：协作约束
    collaboration_mode: str = "solo"       # solo / team / both
    allowed_handoffs: list[str] = field(default_factory=list)  # 可转交的专家 ID

    # 新增：LiteLLM 路由覆盖
    litellm_model_alias: str | None = None  # 如 "qwen3-14b", "deepseek-671b"
```

### 7.3 对应的 API Schema 扩展

在 `AgentCreateRequest` 中新增：

```python
class AgentCreateRequest(BaseModel):
    # ... 现有字段 ...

    # 新增
    expert_id: Optional[str] = Field(None, description="关联专家 ID")
    team_id: Optional[str] = Field(None, description="所属团队 ID")
    team_role: Optional[str] = Field(None, description="团队角色: lead/member")
    safety_level: str = Field("L2", description="安全等级: L1/L2/L3")
    collaboration_mode: str = Field("solo", description="协作模式: solo/team/both")
```

---

## 8. WebSocket 通信集成

### 8.1 新增 WebSocket 主题

在现有 `WebSocketManager` 支持的主题基础上新增：

| 主题 | 方向 | 用途 |
|------|------|------|
| `team:progress` | Server → Client | 团队 Phase 进度更新 |
| `team:member_status` | Server → Client | 成员状态变更 |
| `team:task_update` | Server → Client | 任务状态更新 |
| `team:lead_decision` | Server → Client | Lead 审批结果通知 |

### 8.2 消息格式

```json
// team:progress
{
  "type": "team:progress",
  "data": {
    "team_id": "team-abc123",
    "phase_index": 1,
    "phase_name": "技术审查",
    "phase_status": "in_progress",
    "timestamp": "2026-06-08T10:30:00Z"
  },
  "timestamp": "2026-06-08T10:30:00Z"
}

// team:member_status
{
  "type": "team:member_status",
  "data": {
    "team_id": "team-abc123",
    "expert_id": "eia",
    "old_status": "idle",
    "new_status": "working",
    "phase_id": "eia-p1"
  },
  "timestamp": "2026-06-08T10:30:00Z"
}

// team:lead_decision
{
  "type": "team:lead_decision",
  "data": {
    "team_id": "team-abc123",
    "phase_id": "eia-p0",
    "action": "approve",
    "comment": "项目信息完整",
    "next_phase": "eia-p1"
  },
  "timestamp": "2026-06-08T10:35:00Z"
}
```

### 8.3 前端 Hook 扩展

在 `useWebSocket.ts` 的 `WebSocketMessageType` 中新增：

```typescript
export type WebSocketMessageType =
  | 'agent_status_changed'
  | 'security_alert'
  | 'approval_notification'
  | 'workflow_progress'
  // 新增
  | 'team:progress'
  | 'team:member_status'
  | 'team:task_update'
  | 'team:lead_decision';
```

---

## 9. 安全等级与权限映射

### 9.1 WorkBuddy L1-L5 → EcoMind L1-L3 映射

| WorkBuddy 等级 | 含义 | EcoMind 映射 | 适用专家 |
|----------------|------|-------------|---------|
| L1 | 只读查询 | L1 | public（公众服务） |
| L2 | 需确认操作 | L2 | gaia, env-monitoring, permit, biodiversity, carbon, restoration, water |
| L3 | 审批级操作 | L3 | enforcement, eia, emergency, inspection |
| L4 | 核心系统变更 | L3+HITL | 团队 Lead 操作（Phase 推进、审批决策） |
| L5 | 安全沙箱外操作 | L3+GovMCP | GovMCP 国密审批流 |

### 9.2 团队操作权限矩阵

| 操作 | L1 专家 | L2 专家 | L3 专家 | Lead |
|------|---------|---------|---------|------|
| 单专家对话 | ✅ | ✅ | ✅ | ✅ |
| 加入团队 | ✅ | ✅ | ✅ | ✅ |
| Phase 门禁审批 | ❌ | ❌ | ❌ | ✅ |
| 创建团队 | ❌ | ❌ | ❌ | ✅ |
| HITL 触发 | ❌ | 自动 | 自动 | 手动 |
| GovMCP 审批流 | ❌ | ❌ | 需触发 | 需触发 |

---

## 10. 实施路线图

### Phase 1：基础集成（2 周）

**目标：** 团队可组建，消息可路由

| 步骤 | 任务 | 涉及文件 |
|------|------|---------|
| 1 | 创建 12 个专家 Soul YAML 文件 | `~/.opentaiji/souls/*.yaml` |
| 2 | 扩展 Expert 类型定义 | `frontend/src/types/expert.ts` |
| 3 | 新增 Team 类型定义 | `frontend/src/types/team.ts` |
| 4 | 新增 teamStore | `frontend/src/store/teamStore.ts` |
| 5 | 新增后端 Team Schema | `backend/api/schemas/team.py` |
| 6 | 新增 TeamService | `backend/api/services/team_service.py` |
| 7 | 新增 Team 路由 | `backend/api/routes/team.py` |
| 8 | 注册路由到 main.py | `backend/api/main.py` |
| 9 | 更新 expertStore 默认值 | `frontend/src/store/expertStore.ts` |

### Phase 2：UI 集成（1 周）

**目标：** 团队可见、进度可追踪

| 步骤 | 任务 |
|------|------|
| 1 | 创建 TeamLauncher 组件 |
| 2 | 创建 TeamProgress 组件 |
| 3 | Chat 页面集成团队模式 |
| 4 | Sidebar 新增团队区 |
| 5 | WebSocket 消息处理集成 |

### Phase 3：协作增强（1 周）

**目标：** SOP 流程引擎、多专家并行

| 步骤 | 任务 |
|------|------|
| 1 | 并行 Phase 的 Agent 并发执行 |
| 2 | Lead 汇总逻辑（收集成员产出 → 合并 → 推进） |
| 3 | HITL 人在环路集成（L3 级 Phase 自动触发） |
| 4 | GovMCP 审批流集成（L3+ 级 Phase） |
| 5 | 决策日志记录 |

### Phase 4：高级特性（2 周）

**目标：** 智能路由、自适应编排

| 步骤 | 任务 |
|------|------|
| 1 | LiteLLM 模型路由（L1 用 haiku、L2 用 sonnet、L3 用 opus） |
| 2 | 自定义团队模板（用户自定义 Phase 和成员） |
| 3 | 团队模板市场（多套预设） |
| 4 | 跨团队协作（多个团队协同） |
| 5 | 团队性能分析（每个专家的贡献度、响应时间） |

---

## 11. 文件变更清单

### 新增文件

| 文件路径 | 说明 |
|----------|------|
| `frontend/src/types/team.ts` | 团队相关类型定义 |
| `frontend/src/store/teamStore.ts` | 团队 Zustand Store |
| `frontend/src/components/Team/TeamLauncher.tsx` | 团队组建面板 |
| `frontend/src/components/Team/TeamProgress.tsx` | 团队进度面板 |
| `backend/api/schemas/team.py` | 团队 API Schema |
| `backend/api/services/team_service.py` | 团队业务逻辑服务 |
| `backend/api/routes/team.py` | 团队 API 路由 |
| `~/.opentaiji/souls/gaia.yaml` | GAIA 生态主控 Soul |
| `~/.opentaiji/souls/enforcement.yaml` | 执法监察专家 Soul |
| `~/.opentaiji/souls/eia.yaml` | 环评审批专家 Soul |
| `~/.opentaiji/souls/env-monitoring.yaml` | 环境监测专家 Soul |
| `~/.opentaiji/souls/permit.yaml` | 排污许可专家 Soul |
| `~/.opentaiji/souls/biodiversity.yaml` | 生物多样性专家 Soul |
| `~/.opentaiji/souls/carbon.yaml` | 碳排放专家 Soul |
| `~/.opentaiji/souls/emergency.yaml` | 应急管理专家 Soul |
| `~/.opentaiji/souls/restoration.yaml` | 生态修复专家 Soul |
| `~/.opentaiji/souls/inspection.yaml` | 生态督察专家 Soul |
| `~/.opentaiji/souls/public.yaml` | 公众服务专家 Soul |
| `~/.opentaiji/souls/water.yaml` | 水资源专家 Soul |

### 修改文件

| 文件路径 | 修改内容 |
|----------|---------|
| `frontend/src/types/expert.ts` | 新增 `teamRole`、`soulId`、`collaborationMode`、`supportedWorkflows` 字段 |
| `frontend/src/store/expertStore.ts` | DEFAULT_EXPERTS 补充新字段 |
| `frontend/src/hooks/useWebSocket.ts` | WebSocketMessageType 新增 4 种团队消息类型 |
| `frontend/src/pages/Chat/index.tsx` | 集成团队模式 UI |
| `frontend/src/components/Sidebar/ExpertList.tsx` | 新增团队折叠区 |
| `backend/api/main.py` | 注册 `/api/teams` 路由 |
| `backend/api/schemas/agent.py` | AgentCreateRequest 新增 expert_id、team_id、safety_level 字段 |
| `backend/taiji-agent/src/taiji_agent/agent/engine.py` | AgentConfig 新增 expert_id、team_id、safety_level 字段 |

---

## 总结

本方案的核心思路是：**不替换 EcoMind 的 12 专家体系，而是将 WorkBuddy 的"团队协作模式"作为一层编排能力叠加到现有专家之上**。

关键架构决策：

1. **团队 = 编排层**，不是新实体——每个团队成员仍是一个 TaijiAgent 实例
2. **Soul = 人格层**——为每个专家创建专属 YAML，让 Agent 有了"灵魂"
3. **Phase = 流程层**——SOP 门禁式推进，确保质量
4. **Lead = 决策层**——GAIA/应急/督察专家担任 Lead，居中协调

这个架构确保了：
- **零破坏**：现有 12 专家独立对话模式完全保留
- **渐进式**：Phase 1 只需 2 周就能实现基础团队组建
- **可扩展**：后续可支持自定义团队模板、跨团队协作等高级特性
