import React, { Suspense, lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import MainLayout from '@/layouts/MainLayout';
import { ChatLayout } from '@/layouts/ChatLayout';
import AdminLayout from '@/layouts/AdminLayout';
import AuthGuard from '@/components/AuthGuard';

/** Lazy-loaded page components */
const ChatPage = lazy(() => import('@/pages/Chat'));
const ExpertsPage = lazy(() => import('@/pages/Experts'));
const SkillsPage = lazy(() => import('@/pages/Skills'));
const ConnectorsPage = lazy(() => import('@/pages/Connectors'));
const AutomationPage = lazy(() => import('@/pages/Automation'));
const DashboardPage = lazy(() => import('@/pages/Dashboard'));
const AgentsPage = lazy(() => import('@/pages/Agents'));
const WorkflowsPage = lazy(() => import('@/pages/Workflows'));
const SecurityPage = lazy(() => import('@/pages/Security'));
const ModelsPage = lazy(() => import('@/pages/Models'));
const DomainsPage = lazy(() => import('@/pages/Domains'));
const ConversationsPage = lazy(() => import('@/pages/Conversations'));
const CesiumPage = lazy(() => import('@/pages/Cesium'));
const SettingsPage = lazy(() => import('@/pages/Settings'));
const AdminPage = lazy(() => import('@/pages/Admin'));
const LoginPage = lazy(() => import('@/pages/Login'));
const ChiefDashboardPage = lazy(() => import('@/pages/ChiefDashboard'));
const CityDashboardPage = lazy(() => import('@/pages/CityDashboard'));

/** Loading fallback for lazy-loaded routes */
const PageLoading: React.FC = () => (
  <div className="flex items-center justify-center h-full min-h-[400px]">
    <Spin size="large" tip="Loading..." />
  </div>
);

/** Suspense wrapper for lazy components */
const LazyPage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Suspense fallback={<PageLoading />}>{children}</Suspense>
);

/** Application router configuration — v6.5: RBAC + Agent Portal */
export const router = createBrowserRouter([
  // ============================================================
  // Login (no auth required)
  // ============================================================
  {
    path: '/login',
    element: <LazyPage><LoginPage /></LazyPage>,
  },

  // ============================================================
  // Main Chat Interface (WorkBuddy-style three-panel layout)
  // Requires authentication
  // ============================================================
  {
    path: '/',
    element: (
      <AuthGuard>
        <ChatLayout />
      </AuthGuard>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/chat" replace />,
      },
      {
        path: 'chat',
        element: <LazyPage><ChatPage /></LazyPage>,
      },
      {
        path: 'chat/:sessionId',
        element: <LazyPage><ChatPage /></LazyPage>,
      },
      {
        path: 'experts',
        element: <LazyPage><ExpertsPage /></LazyPage>,
      },
      {
        path: 'skills',
        element: <LazyPage><SkillsPage /></LazyPage>,
      },
      {
        path: 'connectors',
        element: <LazyPage><ConnectorsPage /></LazyPage>,
      },
      {
        path: 'automation',
        element: <LazyPage><AutomationPage /></LazyPage>,
      },
    ],
  },

  // ============================================================
  // Role-based Dashboards
  // ============================================================
  {
    path: '/chief-dashboard',
    element: (
      <AuthGuard allowedRoles={['chief']}>
        <MainLayout />
      </AuthGuard>
    ),
    children: [
      {
        index: true,
        element: <LazyPage><ChiefDashboardPage /></LazyPage>,
      },
    ],
  },
  {
    path: '/city-dashboard',
    element: (
      <AuthGuard allowedRoles={['city']}>
        <MainLayout />
      </AuthGuard>
    ),
    children: [
      {
        index: true,
        element: <LazyPage><CityDashboardPage /></LazyPage>,
      },
    ],
  },

  // ============================================================
  // Full-screen Map Mode
  // ============================================================
  {
    path: '/map',
    element: <LazyPage><CesiumPage /></LazyPage>,
  },

  // ============================================================
  // Settings (standalone, auth required)
  // ============================================================
  {
    path: '/settings',
    element: (
      <AuthGuard>
        <MainLayout />
      </AuthGuard>
    ),
    children: [
      {
        index: true,
        element: <LazyPage><SettingsPage /></LazyPage>,
      },
    ],
  },

  // ============================================================
  // Admin / Operations Panel (management pages)
  // ============================================================
  {
    path: '/admin',
    element: (
      <AuthGuard allowedRoles={['admin', 'leader']}>
        <AdminLayout />
      </AuthGuard>
    ),
    children: [
      {
        index: true,
        element: <LazyPage><AdminPage /></LazyPage>,
      },
      {
        path: 'dashboard',
        element: <LazyPage><DashboardPage /></LazyPage>,
      },
      {
        path: 'agents',
        element: <LazyPage><AgentsPage /></LazyPage>,
      },
      {
        path: 'workflows',
        element: <LazyPage><WorkflowsPage /></LazyPage>,
      },
      {
        path: 'security',
        element: <LazyPage><SecurityPage /></LazyPage>,
      },
      {
        path: 'models',
        element: <LazyPage><ModelsPage /></LazyPage>,
      },
      {
        path: 'domains',
        element: <LazyPage><DomainsPage /></LazyPage>,
      },
      {
        path: 'audit',
        element: <LazyPage><ConversationsPage /></LazyPage>,
      },
      {
        path: 'cesium',
        element: <LazyPage><CesiumPage /></LazyPage>,
      },
    ],
  },

  // ============================================================
  // Legacy routes — redirect to new locations
  // ============================================================
  {
    path: '/dashboard',
    element: <Navigate to="/admin/dashboard" replace />,
  },
  {
    path: '/agents',
    element: <Navigate to="/admin/agents" replace />,
  },
  {
    path: '/workflows',
    element: <Navigate to="/admin/workflows" replace />,
  },
  {
    path: '/security',
    element: <Navigate to="/admin/security" replace />,
  },
  {
    path: '/models',
    element: <Navigate to="/admin/models" replace />,
  },
  {
    path: '/domains',
    element: <Navigate to="/admin/domains" replace />,
  },
  {
    path: '/conversations',
    element: <Navigate to="/admin/audit" replace />,
  },
  {
    path: '/cesium',
    element: <Navigate to="/map" replace />,
  },

  // 404 fallback → redirect to login or chat
  {
    path: '*',
    element: <Navigate to="/chat" replace />,
  },
]);
