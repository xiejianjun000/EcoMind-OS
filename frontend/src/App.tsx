import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { ConfigProvider, App as AntdApp, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';
import { router } from '@/router';
import { useAppStore } from '@/store';
import { lightTheme, darkTheme, ThemeInitializer } from '@/theme';
import { WebSocketProvider } from '@/providers/WebSocketProvider';
import '@/locales';

/** Inner application content — separated so WebSocketProvider wraps it */
const AppContent: React.FC = () => {
  const { theme: themeMode, locale } = useAppStore();

  const antdTheme = themeMode === 'dark' ? darkTheme : lightTheme;
  const antdLocale = locale === 'zh-CN' ? zhCN : enUS;

  return (
    <ConfigProvider
      locale={antdLocale}
      theme={{
        ...antdTheme,
        algorithm: themeMode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
      }}
    >
      <ThemeInitializer theme={themeMode}>
        <AntdApp>
          <RouterProvider router={router} />
        </AntdApp>
      </ThemeInitializer>
    </ConfigProvider>
  );
};

/** Root application component with WebSocket provider */
const App: React.FC = () => {
  return (
    <WebSocketProvider>
      <AppContent />
    </WebSocketProvider>
  );
};

export default App;
