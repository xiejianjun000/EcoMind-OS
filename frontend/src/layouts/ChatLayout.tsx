import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '@/components/Sidebar';
import ArtifactPanel from '@/components/ArtifactPanel';

/**
 * ChatLayout - Main three-panel layout for chat interface
 * Left: Sidebar | Center: Chat | Right: Artifact Panel
 */
const ChatLayout: React.FC = () => {
  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Outlet />
      </main>
      <ArtifactPanel />
    </div>
  );
};

export default ChatLayout;
