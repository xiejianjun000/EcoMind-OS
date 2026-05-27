/**
 * AuthGuard — 认证守卫
 *
 * 包裹在 MainLayout 外层:
 *   - 未登录 → 跳转 /login
 *   - token 过期 → 清除登录态 → 跳转 /login
 *   - 已认证 → 渲染子组件
 */
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store';

interface Props {
  children: React.ReactNode;
}

const AuthGuard: React.FC<Props> = ({ children }) => {
  const { isAuthenticated, isTokenValid } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated || !isTokenValid()) {
    // 登录页本身不需要 redirect 参数避免死循环
    if (location.pathname === '/login') {
      return <Navigate to="/login" replace />;
    }
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
};

export default AuthGuard;
