import React, { Suspense, lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import MainLayout from '@/layouts/MainLayout';
import AuthGuard from '@/components/AuthGuard';

/** Lazy-loaded page components */
const DashboardPage = lazy(() => import('@/pages/Dashboard'));
const AgentsPage = lazy(() => import('@/pages/Agents'));
const WorkflowsPage = lazy(() => import('@/pages/Workflows'));
const SecurityPage = lazy(() => import('@/pages/Security'));
const ModelsPage = lazy(() => import('@/pages/Models'));
const DomainsPage = lazy(() => import('@/pages/Domains'));
const ConversationsPage = lazy(() => import('@/pages/Conversations'));
const CesiumPage = lazy(() => import('@/pages/Cesium'));
const SettingsPage = lazy(() => import('@/pages/Settings'));

/** 🆕 Phase 1-3 新增页面 */
const CommandCockpitPage = lazy(() => import('@/pages/CommandCockpit'));
const EnforcementPage = lazy(() => import('@/pages/Enforcement'));
const EnforcementDetailPage = lazy(() => import('@/pages/Enforcement/EnforcementDetail'));
const EnforcementCreatePage = lazy(() => import('@/pages/Enforcement/EnforcementCreate'));
const ApprovalPage = lazy(() => import('@/pages/Approval'));
const AuditLogPage = lazy(() => import('@/pages/AuditLog'));
const CompliancePage = lazy(() => import('@/pages/Compliance'));
const ReportsPage = lazy(() => import('@/pages/Reports'));
const SkillsPage = lazy(() => import('@/pages/Skills'));
const MemoryKnowledgePage = lazy(() => import('@/pages/MemoryKnowledge'));
const UsersPage = lazy(() => import('@/pages/Users'));
const DepartmentsPage = lazy(() => import('@/pages/Departments'));

/** 🆕 多角色控制台 */
const LoginPage = lazy(() => import('@/pages/Login'));
const ChiefDashboardPage = lazy(() => import('@/pages/ChiefDashboard'));
const CityDashboardPage = lazy(() => import('@/pages/CityDashboard'));

/** Loading fallback for lazy-loaded routes */
const PageLoading: React.FC = () => (
  <div className="flex items-center justify-center h-full min-h-[400px]">
    <Spin size="large" tip="加载中..." />
  </div>
);

/** Suspense wrapper for lazy components */
const LazyPage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Suspense fallback={<PageLoading />}>{children}</Suspense>
);

/**
 * EcoMind OS 路由配置 — 多角色版本
 *
 * 四类角色:
 *   🏛️ leader (厅领导)   → /command-cockpit (全局指挥驾驶舱)
 *   👔 chief  (处长)     → /chief-dashboard (部门工作台)
 *   🏙️ city   (市州)     → /city-dashboard (属地工作台)
 *   🛡️ admin  (管理员)   → /security (安全治理)
 *
 * 导航分组 (leader 可见全部):
 *   🏛️ 指挥驾驶舱 → /command-cockpit /monitoring-map /dashboard
 *   👔 部门工作台 → /chief-dashboard (仅 chief 角色)
 *   🏙️ 市州工作台 → /city-dashboard (仅 city 角色)
 *   🤖 智能体管理 → /agents /skills /memory-knowledge
 *   ⚖️ 业务工作台 → /enforcement /approval /reports
 *   🛡️ 安全治理   → /security /audit-log /compliance
 *   ⚙️ 系统管理   → /models /settings /users
 */
export const router = createBrowserRouter([
  // ─── 登录页 (无需认证) ───
  {
    path: '/login',
    element: <LazyPage><LoginPage /></LazyPage>,
  },

  // ─── 主布局 (需要认证) ───
  {
    path: '/',
    element: (
      <AuthGuard>
        <MainLayout />
      </AuthGuard>
    ),
    children: [
      { index: true, element: <Navigate to="/command-cockpit" replace /> },

      // ─── 🏛️ 指挥驾驶舱 (leader 主视图) ───
      { path: 'command-cockpit', element: <LazyPage><CommandCockpitPage /></LazyPage> },
      { path: 'monitoring-map', element: <LazyPage><CesiumPage /></LazyPage> },
      { path: 'dashboard', element: <LazyPage><DashboardPage /></LazyPage> },

      // ─── 👔 处长工作台 ───
      { path: 'chief-dashboard', element: <LazyPage><ChiefDashboardPage /></LazyPage> },

      // ─── 🏙️ 市州工作台 ───
      { path: 'city-dashboard', element: <LazyPage><CityDashboardPage /></LazyPage> },

      // ─── 🤖 智能体管理 ───
      { path: 'agents', element: <LazyPage><AgentsPage /></LazyPage> },
      { path: 'agents/departments', element: <LazyPage><DepartmentsPage /></LazyPage> },
      { path: 'skills', element: <LazyPage><SkillsPage /></LazyPage> },
      { path: 'memory-knowledge', element: <LazyPage><MemoryKnowledgePage /></LazyPage> },

      // ─── ⚖️ 业务工作台 ───
      { path: 'enforcement', element: <LazyPage><EnforcementPage /></LazyPage> },
      { path: 'enforcement/:caseId', element: <LazyPage><EnforcementDetailPage /></LazyPage> },
      { path: 'enforcement/create', element: <LazyPage><EnforcementCreatePage /></LazyPage> },
      { path: 'approval', element: <LazyPage><ApprovalPage /></LazyPage> },
      { path: 'reports', element: <LazyPage><ReportsPage /></LazyPage> },

      // ─── 🛡️ 安全治理 ───
      { path: 'security', element: <LazyPage><SecurityPage /></LazyPage> },
      { path: 'audit-log', element: <LazyPage><AuditLogPage /></LazyPage> },
      { path: 'compliance', element: <LazyPage><CompliancePage /></LazyPage> },

      // ─── ⚙️ 系统管理 ───
      { path: 'models', element: <LazyPage><ModelsPage /></LazyPage> },
      { path: 'settings', element: <LazyPage><SettingsPage /></LazyPage> },
      { path: 'users', element: <LazyPage><UsersPage /></LazyPage> },

      // ─── 保留路由 ───
      { path: 'workflows', element: <LazyPage><WorkflowsPage /></LazyPage> },
      { path: 'domains', element: <LazyPage><DomainsPage /></LazyPage> },
      { path: 'conversations', element: <LazyPage><ConversationsPage /></LazyPage> },
    ],
  },
  { path: '*', element: <Navigate to="/login" replace /> },
]);
