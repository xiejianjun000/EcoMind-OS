import React, { Suspense, lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import MainLayout from '@/layouts/MainLayout';

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

/** Application router configuration with 9 module routes */
export const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
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
        path: 'conversations',
        element: <LazyPage><ConversationsPage /></LazyPage>,
      },
      {
        path: 'cesium',
        element: <LazyPage><CesiumPage /></LazyPage>,
      },
      {
        path: 'settings',
        element: <LazyPage><SettingsPage /></LazyPage>,
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/dashboard" replace />,
  },
]);
