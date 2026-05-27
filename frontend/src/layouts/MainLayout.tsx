import React from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { ProLayout } from '@ant-design/pro-components';
import type { MenuDataItem } from '@ant-design/pro-components';
import { Button } from 'antd';
import {
  DashboardOutlined,
  RobotOutlined,
  ApartmentOutlined,
  SafetyCertificateOutlined,
  ExperimentOutlined,
  GlobalOutlined,
  MessageOutlined,
  CompassOutlined,
  SettingOutlined,
  HomeOutlined,
  ThunderboltOutlined,
  AuditOutlined,
  FileTextOutlined,
  SecurityScanOutlined,
  SafetyOutlined,
  UserOutlined,
  NodeIndexOutlined,
  BarChartOutlined,
  LogoutOutlined,
  CrownOutlined,
  EnvironmentOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAppStore, useAuthStore } from '@/store';
import WsStatusIndicator from '@/components/WsStatusIndicator';
import RoleSwitcher from '@/components/RoleSwitcher';

/** Icon mapping for menu items */
const iconMap: Record<string, React.ReactNode> = {
  'command-cockpit': <HomeOutlined />,
  'chief-dashboard': <CrownOutlined />,
  'city-dashboard': <EnvironmentOutlined />,
  'monitoring-map': <CompassOutlined />,
  'dashboard': <DashboardOutlined />,
  'agents': <RobotOutlined />,
  'skills': <ThunderboltOutlined />,
  'memory-knowledge': <NodeIndexOutlined />,
  'enforcement': <SafetyCertificateOutlined />,
  'approval': <AuditOutlined />,
  'reports': <BarChartOutlined />,
  'security': <SafetyOutlined />,
  'audit-log': <SecurityScanOutlined />,
  'compliance': <FileTextOutlined />,
  'models': <ExperimentOutlined />,
  'settings': <SettingOutlined />,
  'users': <UserOutlined />,
  'workflows': <ApartmentOutlined />,
  'domains': <GlobalOutlined />,
  'conversations': <MessageOutlined />,
};

/** 全量菜单定义 — 通过 role.menuGroups 过滤哪些分组可见 */
const ALL_MENU_GROUPS: Record<string, MenuDataItem> = {
  'group-command-cockpit': {
    key: 'group-command-cockpit',
    path: '/command-cockpit',
    name: '🏛️ 指挥驾驶舱',
    icon: iconMap['command-cockpit'],
    children: [
      { path: '/command-cockpit', name: '📊 领导驾驶舱', icon: iconMap['command-cockpit'] },
      { path: '/monitoring-map', name: '🗺️ 监测一张图', icon: iconMap['monitoring-map'] },
      { path: '/dashboard', name: '📈 数据看板', icon: iconMap.dashboard },
    ],
  },
  'group-chief-dashboard': {
    key: 'group-chief-dashboard',
    path: '/chief-dashboard',
    name: '👔 部门工作台',
    icon: <TeamOutlined />,
    children: [
      { path: '/chief-dashboard', name: '📋 我的部门', icon: <CrownOutlined /> },
      { path: '/approval', name: '📋 审批中心', icon: <AuditOutlined /> },
      { path: '/reports', name: '📄 报告生成', icon: <BarChartOutlined /> },
    ],
  },
  'group-city-dashboard': {
    key: 'group-city-dashboard',
    path: '/city-dashboard',
    name: '🏙️ 属地工作台',
    icon: <EnvironmentOutlined />,
    children: [
      { path: '/city-dashboard', name: '🏠 本市总览', icon: <EnvironmentOutlined /> },
      { path: '/monitoring-map', name: '🗺️ 监测一张图', icon: iconMap['monitoring-map'] },
    ],
  },
  'group-city-monitoring': {
    key: 'group-city-monitoring',
    path: '/monitoring-map',
    name: '📡 监测数据',
    icon: <CompassOutlined />,
    children: [
      { path: '/city-dashboard', name: '🏠 数据总览', icon: <EnvironmentOutlined /> },
      { path: '/reports', name: '📊 趋势分析', icon: <BarChartOutlined /> },
    ],
  },
  'group-city-reports': {
    key: 'group-city-reports',
    path: '/reports',
    name: '📋 报告管理',
    icon: <FileTextOutlined />,
    children: [
      { path: '/reports', name: '📄 报告列表', icon: <FileTextOutlined /> },
      { path: '/approval', name: '📋 审批上报', icon: <AuditOutlined /> },
    ],
  },
  'group-agents': {
    key: 'group-agents',
    path: '/agents',
    name: '🤖 智能体管理',
    icon: iconMap.agents,
    children: [
      { path: '/agents', name: '🤖 Agent总览', icon: iconMap.agents },
      { path: '/agents/departments', name: '🏢 部门绑定', icon: <NodeIndexOutlined /> },
      { path: '/skills', name: '🎯 技能配置', icon: iconMap.skills },
      { path: '/memory-knowledge', name: '🧠 记忆与知识', icon: iconMap['memory-knowledge'] },
    ],
  },
  'group-enforcement': {
    key: 'group-enforcement',
    path: '/enforcement',
    name: '⚖️ 业务工作台',
    icon: iconMap.enforcement,
    children: [
      { path: '/enforcement', name: '🔍 执法办案', icon: iconMap.enforcement },
      { path: '/approval', name: '📋 审批中心', icon: iconMap.approval },
      { path: '/reports', name: '📄 报告生成', icon: iconMap.reports },
    ],
  },
  'group-security': {
    key: 'group-security',
    path: '/security',
    name: '🛡️ 安全治理',
    icon: iconMap.security,
    children: [
      { path: '/security', name: '🛡️ 安全态势', icon: iconMap.security },
      { path: '/audit-log', name: '📜 审计日志', icon: iconMap['audit-log'] },
      { path: '/compliance', name: '🔐 合规检查', icon: iconMap.compliance },
    ],
  },
  'group-models': {
    key: 'group-models',
    path: '/models',
    name: '⚙️ 系统管理',
    icon: iconMap.models,
    children: [
      { path: '/models', name: '🧩 模型管理', icon: iconMap.models },
      { path: '/settings', name: '⚙️ 系统设置', icon: iconMap.settings },
      { path: '/users', name: '👥 用户管理', icon: iconMap.users },
    ],
  },
};

/** Build role-filtered menu data */
const buildMenuData = (roleGroups: string[]): MenuDataItem[] => {
  return roleGroups
    .map((key) => ALL_MENU_GROUPS[key])
    .filter(Boolean);
};

/** Main application layout with ProLayout — Multi-Role Edition */
const MainLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, sidebarCollapsed, setSidebarCollapsed } = useAppStore();
  const { logout, getRoleConfig } = useAuthStore();

  const roleConfig = getRoleConfig();
  const menuData = React.useMemo(() => buildMenuData(roleConfig.menuGroups), [roleConfig.menuGroups]);

  /** Match the current path to automatically open the correct submenu */
  const openKeys = React.useMemo(() => {
    const path = location.pathname;
    // Check each visible menu group
    for (const group of roleConfig.menuGroups) {
      const menuDef = ALL_MENU_GROUPS[group];
      if (menuDef?.children?.some((child: any) => child.path === path || path.startsWith(child.path + '/'))) {
        return [group];
      }
    }
    // Fallbacks
    if (path.startsWith('/chief-dashboard')) return ['group-chief-dashboard'];
    if (path.startsWith('/city-dashboard')) return ['group-city-dashboard'];
    if (path.startsWith('/command-cockpit') || path.startsWith('/monitoring-map') || path.startsWith('/dashboard')) return ['group-command-cockpit'];
    if (path.startsWith('/agents') || path.startsWith('/skills') || path.startsWith('/memory-knowledge')) return ['group-agents'];
    if (path.startsWith('/enforcement') || path.startsWith('/approval') || path.startsWith('/reports')) return ['group-enforcement'];
    if (path.startsWith('/security') || path.startsWith('/audit-log') || path.startsWith('/compliance')) return ['group-security'];
    if (path.startsWith('/models') || path.startsWith('/settings') || path.startsWith('/users')) return ['group-models'];
    return [roleConfig.menuGroups[0] || 'group-command-cockpit'];
  }, [location.pathname, roleConfig.menuGroups]);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <ProLayout
      title="EcoMind OS"
      logo={null}
      layout="mix"
      theme={theme === 'dark' ? 'dark' : 'light'}
      navTheme={theme === 'dark' ? 'realDark' : 'light'}
      fixSiderbar
      fixedHeader
      collapsed={sidebarCollapsed}
      onCollapse={setSidebarCollapsed}
      location={{ pathname: location.pathname }}
      menuDataRender={() => menuData}
      defaultOpenKeys={openKeys}
      menuItemRender={(item, dom) => (
        <div onClick={() => item.path && navigate(item.path)}>{dom}</div>
      )}
      subMenuItemRender={(item, dom) => (
        <div onClick={() => item.path && navigate(item.path)}>{dom}</div>
      )}
      headerTitleRender={(logo, title) => (
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate(roleConfig.homePath)}>
          {logo}
          <span className="font-bold text-lg">{title}</span>
        </div>
      )}
      actionsRender={() => [
        <WsStatusIndicator key="ws-status" />,
        <DeployModeBadge key="deploy-mode" />,
        <RoleSwitcher key="role-switcher" />,
        <Button
          key="logout"
          type="text"
          size="small"
          icon={<LogoutOutlined />}
          onClick={handleLogout}
          style={{ color: '#94A3B8' }}
        />,
      ]}
    >
      <Outlet />
    </ProLayout>
  );
};

/** Deploy mode badge displayed in the header */
const DeployModeBadge: React.FC = () => {
  const { t } = useTranslation();
  const { deployMode } = useAppStore();

  const modeConfig = {
    local: { color: 'bg-green-500', label: t('common.localOnly') },
    cloud: { color: 'bg-blue-500', label: 'Cloud' },
    hybrid: { color: 'bg-orange-500', label: 'Hybrid' },
  };

  const config = modeConfig[deployMode];

  return (
    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800">
      <span className={`w-2 h-2 rounded-full ${config.color}`} />
      <span className="text-xs font-medium">{config.label}</span>
    </div>
  );
};

export default MainLayout;
