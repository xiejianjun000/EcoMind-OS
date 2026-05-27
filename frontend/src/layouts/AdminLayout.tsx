import React from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  ProLayout,
  SettingDrawer,
} from '@ant-design/pro-components';
import {
  DashboardOutlined,
  RobotOutlined,
  NodeIndexOutlined,
  SafetyCertificateOutlined,
  ApiOutlined,
  AppstoreOutlined,
  MessageOutlined,
  GlobalOutlined,
  SettingOutlined,
  ArrowLeftOutlined,
  ThunderboltOutlined,
  AuditOutlined,
  SafetyOutlined,
  FileTextOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons';
import { useAppStore } from '@/store';

/**
 * AdminLayout — Operations management panel layout
 * Reuses the existing ProLayout for backend management pages
 * Provides a path back to the main chat interface
 */
const AdminLayout: React.FC = () => {
  const { theme, toggleTheme, setLocale, locale } = useAppStore();
  const location = useLocation();
  const navigate = useNavigate();
  const isDark = theme === 'dark';

  const menuItems = [
    {
      path: '/admin/dashboard',
      name: '总览面板',
      icon: <DashboardOutlined />,
    },
    {
      path: '/admin/agents',
      name: 'Agent 管理',
      icon: <RobotOutlined />,
    },
    {
      path: '/admin/workflows',
      name: '工作流编排',
      icon: <NodeIndexOutlined />,
    },
    {
      path: '/admin/security',
      name: '安全治理',
      icon: <SafetyCertificateOutlined />,
    },
    {
      path: '/admin/models',
      name: '模型管理',
      icon: <ApiOutlined />,
    },
    {
      path: '/admin/domains',
      name: '业务域配置',
      icon: <AppstoreOutlined />,
    },
    {
      path: '/admin/audit',
      name: '对话审计',
      icon: <MessageOutlined />,
    },
    {
      path: '/admin/cesium',
      name: '3D 数字孪生',
      icon: <GlobalOutlined />,
    },
    {
      path: '/admin/monitor',
      name: '环境监测',
      icon: <EnvironmentOutlined />,
    },
    {
      path: '/admin/enforcement',
      name: '执法办案',
      icon: <ThunderboltOutlined />,
    },
    {
      path: '/admin/approval',
      name: '审批中心',
      icon: <AuditOutlined />,
    },
    {
      path: '/admin/compliance',
      name: '合规检查',
      icon: <SafetyOutlined />,
    },
    {
      path: '/admin/reports',
      name: '报告生成',
      icon: <FileTextOutlined />,
    },
    {
      path: '/settings',
      name: '系统设置',
      icon: <SettingOutlined />,
    },
  ];

  return (
    <ProLayout
      layout="mix"
      navTheme={isDark ? 'realDark' : 'light'}
      fixSiderbar
      fixedHeader
      title="EcoMind OS"
      logo={
        <div className="flex items-center justify-center w-8 h-8 rounded bg-green-600 text-white font-bold text-sm">
          E
        </div>
      }
      route={{ path: '/', routes: menuItems }}
      location={{ pathname: location.pathname }}
      menuItemRender={(item, dom) => (
        <div onClick={() => navigate(item.path || '/admin')} style={{ cursor: 'pointer' }}>
          {dom}
        </div>
      )}
      headerContentRender={() => (
        <div className="flex items-center gap-4">
          <span
            className="flex items-center gap-1 text-sm cursor-pointer hover:opacity-80"
            style={{ color: isDark ? '#a0a0a0' : '#595959' }}
            onClick={() => navigate('/chat')}
          >
            <ArrowLeftOutlined />
            返回对话界面
          </span>
          <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: isDark ? '#333' : '#f0f0f0', color: isDark ? '#999' : '#666' }}>
            运维面板
          </span>
        </div>
      )}
      actionsRender={() => []}
    >
      <Outlet />
    </ProLayout>
  );
};

export default AdminLayout;
