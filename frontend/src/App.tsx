import React from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from '@/router';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { WebSocketProvider } from '@/providers/WebSocketProvider';
import '@/locales';
import { Toaster } from 'sonner';

const AppContent: React.FC = () => {
  return (
    <>
      <RouterProvider router={router} />
      <Toaster position="top-right" richColors closeButton />
    </>
  );
};

const App: React.FC = () => {
  return (
    <WebSocketProvider>
      <ThemeProvider defaultTheme="system" storageKey="ecomind-ui-theme">
        <AppContent />
      </ThemeProvider>
    </WebSocketProvider>
  );
};

export default App;
