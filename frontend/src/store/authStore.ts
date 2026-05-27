/**
 * Auth Store — 基于角色的访问控制 (RBAC)
 *
 * 四类角色:
 *   🏛️ leader (厅领导)   — 全量数据，全局视角
 *   👔 chief  (处长)     — 本部门数据，部门工作台
 *   🏙️ city   (市州)     — 本市数据，属地管理
 *   🛡️ admin  (三员/管理) — 系统管理，安全治理
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DepartmentName } from '@/services/types';

// ─── 角色类型 ───

export type UserRole = 'leader' | 'chief' | 'city' | 'admin';

/** 14 市州名称 */
export type CityName =
  | '长沙市' | '株洲市' | '湘潭市' | '衡阳市' | '邵阳市'
  | '岳阳市' | '常德市' | '张家界市' | '益阳市' | '郴州市'
  | '永州市' | '怀化市' | '娄底市' | '湘西土家族苗族自治州';

/** 角色配置 */
export interface RoleConfig {
  role: UserRole;
  label: string;
  icon: string;
  menuGroups: string[];
  homePath: string;
}

/** 14 个市州列表 (用于下拉选择) */
export const CITY_LIST: CityName[] = [
  '长沙市', '株洲市', '湘潭市', '衡阳市', '邵阳市',
  '岳阳市', '常德市', '张家界市', '益阳市', '郴州市',
  '永州市', '怀化市', '娄底市', '湘西土家族苗族自治州',
];

/** 角色 → 菜单分组配置 */
export const ROLE_CONFIGS: Record<UserRole, RoleConfig> = {
  leader: {
    role: 'leader',
    label: '厅领导',
    icon: '🏛️',
    menuGroups: ['group-command-cockpit', 'group-agents', 'group-enforcement', 'group-security', 'group-models'],
    homePath: '/chief-dashboard',
  },
  chief: {
    role: 'chief',
    label: '处长',
    icon: '👔',
    menuGroups: ['group-chief-dashboard', 'group-agents', 'group-enforcement'],
    homePath: '/chief-dashboard',
  },
  city: {
    role: 'city',
    label: '市州',
    icon: '🏙️',
    menuGroups: ['group-city-dashboard', 'group-city-monitoring', 'group-city-reports'],
    homePath: '/city-dashboard',
  },
  admin: {
    role: 'admin',
    label: '管理员',
    icon: '🛡️',
    menuGroups: ['group-security', 'group-models', 'group-agents'],
    homePath: '/admin/dashboard',
  },
};

// ─── 用户信息 ───

export interface UserInfo {
  id: string;
  name: string;
  role: UserRole;
  department?: DepartmentName;
  city?: CityName;
  token: string;
  expiresAt: number;
}

// ─── Store ───

interface AuthState {
  user: UserInfo | null;
  isAuthenticated: boolean;
  loggingIn: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  switchRole: (role: UserRole, cityOrDept?: string) => void;
  getRoleConfig: () => RoleConfig;
  isTokenValid: () => boolean;
}

// ─── 模拟账号 (开发阶段) ───

const MOCK_ACCOUNTS: Record<string, { password: string; user: Omit<UserInfo, 'token' | 'expiresAt'> }> = {
  // 厅领导
  'leader':  { password: '123456', user: { id: 'u-001', name: '厅领导', role: 'leader' } },
  'leader2': { password: '123456', user: { id: 'u-002', name: '分管副厅长', role: 'leader' } },
  // P0 处长
  'enforcement': { password: '123456', user: { id: 'u-100', name: '执法局 张处长', role: 'chief', department: '生态环境执法局' } },
  'monitoring':  { password: '123456', user: { id: 'u-101', name: '监测处 李处长', role: 'chief', department: '生态环境监测处' } },
  'eia':         { password: '123456', user: { id: 'u-102', name: '环评处 王处长', role: 'chief', department: '环境影响评价与排放管理处' } },
  'air':         { password: '123456', user: { id: 'u-103', name: '大气处 赵处长', role: 'chief', department: '大气环境与应对气候变化处' } },
  'water':       { password: '123456', user: { id: 'u-104', name: '水环境处 陈处长', role: 'chief', department: '水生态环境处' } },
  'soil':        { password: '123456', user: { id: 'u-105', name: '土壤处 刘处长', role: 'chief', department: '土壤生态环境处' } },
  // 市州
  'changsha':    { password: '123456', user: { id: 'u-200', name: '长沙市生态环境局', role: 'city', city: '长沙市' } },
  'zhuzhou':     { password: '123456', user: { id: 'u-201', name: '株洲市生态环境局', role: 'city', city: '株洲市' } },
  'xiangtan':    { password: '123456', user: { id: 'u-202', name: '湘潭市生态环境局', role: 'city', city: '湘潭市' } },
  'yueyang':     { password: '123456', user: { id: 'u-203', name: '岳阳市生态环境局', role: 'city', city: '岳阳市' } },
  'zhangjiajie': { password: '123456', user: { id: 'u-204', name: '张家界市生态环境局', role: 'city', city: '张家界市' } },
  // 管理员 (三员分立)
  'admin':    { password: '123456', user: { id: 'u-900', name: '系统管理员', role: 'admin' } },
  'security': { password: '123456', user: { id: 'u-901', name: '安全管理员', role: 'admin' } },
  'auditor':  { password: '123456', user: { id: 'u-902', name: '审计管理员', role: 'admin' } },
};

function mockToken(userId: string): { token: string; expiresAt: number } {
  const expiresAt = Date.now() + 8 * 3600 * 1000;
  return { token: `mock-jwt.${userId}.${expiresAt}.sig`, expiresAt };
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      loggingIn: false,

      login: async (username: string, password: string) => {
        set({ loggingIn: true });
        await new Promise((r) => setTimeout(r, 800));
        const account = MOCK_ACCOUNTS[username];
        if (!account || account.password !== password) {
          set({ loggingIn: false });
          throw new Error('账号或密码错误');
        }
        const { token, expiresAt } = mockToken(account.user.id);
        const user: UserInfo = { ...account.user, token, expiresAt };
        set({ user, isAuthenticated: true, loggingIn: false });
      },

      logout: () => {
        set({ user: null, isAuthenticated: false });
        localStorage.removeItem('ecomind-auth');
      },

      switchRole: (role: UserRole, cityOrDept?: string) => {
        const current = get().user;
        if (!current) return;
        let u: Omit<UserInfo, 'token' | 'expiresAt'>;
        if (role === 'city' && cityOrDept) {
          u = { id: `u-sw-${Date.now()}`, name: `${cityOrDept}生态环境局`, role: 'city', city: cityOrDept as CityName };
        } else if (role === 'chief' && cityOrDept) {
          u = { id: `u-sw-${Date.now()}`, name: `${cityOrDept}处长`, role: 'chief', department: cityOrDept as DepartmentName };
        } else {
          u = { id: `u-sw-${Date.now()}`, name: ROLE_CONFIGS[role].icon + ' ' + ROLE_CONFIGS[role].label, role };
        }
        const { token, expiresAt } = mockToken(u.id);
        set({ user: { ...u, token, expiresAt }, isAuthenticated: true });
      },

      getRoleConfig: () => ROLE_CONFIGS[get().user?.role || 'leader'],

      isTokenValid: () => {
        const { user } = get();
        return !!user && Date.now() < user.expiresAt;
      },
    }),
    {
      name: 'ecomind-auth',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);
