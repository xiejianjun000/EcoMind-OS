import React from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { ProLayout } from '@ant-design/pro-components';
import type { MenuDataItem } from '@ant-design/pro-components';
import { useTranslation } from 'react-i18next';
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
} from '@ant-design/icons';
import { useAppStore } from '@/store';
import WsStatusIndicator from '@/components/WsStatusIndicator';

/** Icon mapping for menu items */
const iconMap: Record<string, React.ReactNode> = {
  dashboard: <DashboardOutlined />,
  agents: <RobotOutlined />,
  workflows: <ApartmentOutlined />,
  security: <SafetyCertificateOutlined />,
  models: <ExperimentOutlined />,
  domains: <GlobalOutlined />,
  conversations: <MessageOutlined />,
  cesium: <CompassOutlined />,
  settings: <SettingOutlined />,
};

/** Build menu data from translation keys */
const buildMenuData = (t: (key: string) => string): MenuDataItem[] => [
  {
    path: '/dashboard',
    name: t('dashboard.title'),
    icon: iconMap.dashboard,
  },
  {
    path: '/agents',
    name: t('agents.title'),
    icon: iconMap.agents,
  },
  {
    path: '/workflows',
    name: t('workflows.title'),
    icon: iconMap.workflows,
  },
  {
    path: '/security',
    name: t('security.title'),
    icon: iconMap.security,
  },
  {
    path: '/models',
    name: t('models.title'),
    icon: iconMap.models,
  },
  {
    path: '/domains',
    name: t('domains.title'),
    icon: iconMap.domains,
  },
  {
    path: '/conversations',
    name: t('conversations.title'),
    icon: iconMap.conversations,
  },
  {
    path: '/cesium',
    name: t('cesium.title'),
    icon: iconMap.cesium,
  },
  {
    path: '/settings',
    name: t('settings.title'),
    icon: iconMap.settings,
  },
];

/** Main application layout with ProLayout */
const MainLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { theme, sidebarCollapsed, setSidebarCollapsed } = useAppStore();

  const menuData = React.useMemo(() => buildMenuData(t), [t]);

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
      menuItemRender={(item, dom) => (
        <div onClick={() => item.path && navigate(item.path)}>{dom}</div>
      )}
      headerTitleRender={(logo, title) => (
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/dashboard')}>
          {logo}
          <span className="font-bold text-lg">{title}</span>
        </div>
      )}
      actionsRender={() => [
        <WsStatusIndicator key="ws-status" />,
        <DeployModeBadge key="deploy-mode" />,
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
