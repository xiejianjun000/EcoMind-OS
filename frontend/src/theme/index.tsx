import React from 'react';
import type { ThemeConfig } from 'antd';

/** Light theme configuration */
export const lightTheme: ThemeConfig = {
  token: {
    colorPrimary: '#1890ff',
    colorSuccess: '#52c41a',
    colorWarning: '#faad14',
    colorError: '#ff4d4f',
    colorInfo: '#1890ff',
    borderRadius: 6,
    fontSize: 14,
    colorBgContainer: '#ffffff',
    colorBgLayout: '#f0f2f5',
    colorText: 'rgba(0, 0, 0, 0.88)',
  },
  components: {
    Layout: {
      siderBg: '#001529',
      headerBg: '#ffffff',
    },
    Menu: {
      darkItemBg: '#001529',
      darkSubMenuItemBg: '#000c17',
    },
  },
};

/** Dark theme configuration */
export const darkTheme: ThemeConfig = {
  token: {
    colorPrimary: '#177ddc',
    colorSuccess: '#49aa19',
    colorWarning: '#d89614',
    colorError: '#d32029',
    colorInfo: '#177ddc',
    borderRadius: 6,
    fontSize: 14,
    colorBgContainer: '#141414',
    colorBgLayout: '#1a1a1a',
    colorText: 'rgba(255, 255, 255, 0.88)',
  },
  components: {
    Layout: {
      siderBg: '#1f1f1f',
      headerBg: '#141414',
    },
    Menu: {
      darkItemBg: '#1f1f1f',
      darkSubMenuItemBg: '#141414',
    },
    Card: {
      colorBgContainer: '#1f1f1f',
    },
    Table: {
      colorBgContainer: '#1f1f1f',
      headerBg: '#262626',
    },
  },
};

/**
 * Theme provider component that wraps children with Ant Design theme context.
 * Sets data-theme attribute on document for CSS variable-based theming.
 */
export const ThemeInitializer: React.FC<{ children: React.ReactNode; theme: 'light' | 'dark' }> = ({
  children,
  theme,
}) => {
  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return <>{children}</>;
};
