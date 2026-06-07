/**
 * AuthGuard — 认证 + 角色守卫 (v6.5)
 *
 *   - 未登录 → 跳转 /login
 *   - token 过期 → 清除登录态 → 跳转 /login
 *   - 角色不匹配 → 显示 403 提示
 *   - 通过 → 渲染子组件
 */
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore, ROLE_CONFIGS, type UserRole } from '@/store';

interface Props {
  children: React.ReactNode;
  /** 允许访问的角色列表，不传则只校验登录 */
  allowedRoles?: UserRole[];
}

const AuthGuard: React.FC<Props> = ({ children, allowedRoles }) => {
  const { isAuthenticated, isTokenValid, user } = useAuthStore();
  const location = useLocation();

  // 未登录或 token 过期
  if (!isAuthenticated || !isTokenValid()) {
    if (location.pathname === '/login') {
      return <Navigate to="/login" replace />;
    }
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // 角色校验
  if (allowedRoles && allowedRoles.length > 0 && user) {
    if (!allowedRoles.includes(user.role)) {
      return (
        <div className="flex items-center justify-center h-screen bg-background">
          <div className="text-center p-8 max-w-md">
            <div className="text-6xl mb-4">🚫</div>
            <h1 className="text-2xl font-bold mb-2">访问被拒绝</h1>
            <p className="text-muted-foreground mb-4">
              当前角色 <strong>{ROLE_CONFIGS[user.role]?.label || user.role}</strong> 无权访问此页面
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              需要角色: {allowedRoles.join(', ')}
            </p>
            <a
              href="/chat"
              className="inline-block px-4 py-2 bg-primary text-primary-foreground rounded-md"
            >
              返回对话界面
            </a>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
};

export default AuthGuard;
