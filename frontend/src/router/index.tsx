import React, { Suspense, lazy } from 'react';
import { createBrowserRouter, Navigate, useParams } from 'react-router-dom';
import { Spin } from 'antd';
import { ChatLayout } from '@/layouts/ChatLayout';
import AuthGuard from '@/components/AuthGuard';

/** Only lazy-load what we actually navigate to */
const LoginPage = lazy(() => import('@/pages/Login'));
const CesiumPage = lazy(() => import('@/pages/Cesium'));

const PageLoading: React.FC = () => (
  <div className="flex items-center justify-center h-full min-h-[400px]">
    <Spin size="large" />
  </div>
);

const LazyPage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Suspense fallback={<PageLoading />}>{children}</Suspense>
);

/** Application router — unified 3-panel layout, single-page app */
export const router = createBrowserRouter([
  // ── Login (no auth) ──
  {
    path: '/login',
    element: <LazyPage><LoginPage /></LazyPage>,
  },

  // ── Main 3-panel interface (auth required) ──
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
        path: 'chat/:sessionId?',
        element: <ChatPageWrapper />,
      },
    ],
  },

  // ── Full-screen Map ──
  {
    path: '/map',
    element: <LazyPage><CesiumPage /></LazyPage>,
  },

  // ── Catch-all → Chat ──
  {
    path: '*',
    element: <Navigate to="/chat" replace />,
  },
]);

/** Wrapper to force remount on sessionId change */
function ChatPageWrapper() {
  const { sessionId } = useParams();
  const ChatPage = lazy(() => import('@/pages/Chat'));
  return (
    <Suspense fallback={<PageLoading />} key={sessionId}>
      <ChatPage />
    </Suspense>
  );
}
