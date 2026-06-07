import { create } from 'zustand';
import type { DepartmentName, DepartmentAgentBinding } from '@/services/types';
import { DEFAULT_DEPT_AGENTS } from '@/services/types';

/** Department store state */
interface DeptState {
  /** 已初始化的部门智能体映射: department → agentId */
  agents: Record<string, string>;
  /** 部门绑定配置 */
  bindings: DepartmentAgentBinding[];

  /** 绑定部门Agent */
  bindAgent: (department: string, agentId: string) => void;
  /** 根据部门获取AgentID */
  getAgentId: (department: string) => string | undefined;
  /** 根据部门获取绑定配置 */
  getBinding: (department: string) => DepartmentAgentBinding | undefined;
  /** 批量初始化绑定 */
  initBindings: () => void;
}

export const useDeptStore = create<DeptState>()((set, get) => ({
  agents: {},
  bindings: DEFAULT_DEPT_AGENTS as DepartmentAgentBinding[],

  bindAgent: (department, agentId) =>
    set((state) => ({
      agents: { ...state.agents, [department]: agentId },
    })),

  getAgentId: (department) => get().agents[department],

  getBinding: (department) =>
    get().bindings.find((b) => b.department === department),

  initBindings: () => {
    // 从localStorage恢复或使用默认绑定
    try {
      const saved = localStorage.getItem('ecomind-dept-agents');
      if (saved) {
        set({ agents: JSON.parse(saved) });
      }
    } catch {
      // 使用空映射，由后端创建时绑定
    }
  },
}));
