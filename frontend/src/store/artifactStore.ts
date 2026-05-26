import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Artifact, TaskItem, NotificationItem, ArtifactPanelTab } from '@/types/artifact';

// ============================================================
// Constants
// ============================================================

const MAX_ARTIFACTS = 200;
const MAX_TASKS = 50;
const MAX_NOTIFICATIONS = 100;

// ============================================================
// State Interface
// ============================================================

interface ArtifactState {
  // Artifacts
  artifacts: Artifact[];
  activeArtifactId: string | null;

  // Tasks
  tasks: TaskItem[];

  // Notifications
  notifications: NotificationItem[];
  unreadCount: number;

  // Panel UI
  panelTab: ArtifactPanelTab;
  panelCollapsed: boolean;

  // Actions
  addArtifact: (artifact: Omit<Artifact, 'id' | 'createdAt'>) => string;
  removeArtifact: (artifactId: string) => void;
  setActiveArtifact: (artifactId: string | null) => void;
  clearArtifacts: () => void;

  addTask: (task: Omit<TaskItem, 'id' | 'createdAt' | 'updatedAt'>) => string;
  updateTaskProgress: (taskId: string, progress: number, status?: TaskItem['status']) => void;
  completeTask: (taskId: string, errorMessage?: string) => void;
  removeTask: (taskId: string) => void;
  clearTasks: () => void;

  addNotification: (notification: Omit<NotificationItem, 'id' | 'timestamp' | 'read'>) => string;
  markNotificationRead: (notificationId: string) => void;
  markAllNotificationsRead: () => void;
  removeNotification: (notificationId: string) => void;
  clearNotifications: () => void;

  setPanelTab: (tab: ArtifactPanelTab) => void;
  togglePanel: () => void;
  setPanelCollapsed: (collapsed: boolean) => void;
}

// ============================================================
// Helpers
// ============================================================

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function now(): string {
  return new Date().toISOString();
}

// ============================================================
// Store
// ============================================================

export const useArtifactStore = create<ArtifactState>()(
  persist(
    (set, get) => ({
      artifacts: [],
      activeArtifactId: null,
      tasks: [],
      notifications: [],
      unreadCount: 0,
      panelTab: 'artifacts',
      panelCollapsed: false,

      addArtifact: (artifact) => {
        const id = generateId();
        const fullArtifact: Artifact = {
          ...artifact,
          id,
          createdAt: now(),
        };
        set((state) => {
          const updated = [fullArtifact, ...state.artifacts];
          if (updated.length > MAX_ARTIFACTS) {
            updated.splice(MAX_ARTIFACTS);
          }
          return { artifacts: updated };
        });
        return id;
      },

      removeArtifact: (artifactId) =>
        set((state) => ({
          artifacts: state.artifacts.filter((a) => a.id !== artifactId),
          activeArtifactId:
            state.activeArtifactId === artifactId ? null : state.activeArtifactId,
        })),

      setActiveArtifact: (artifactId) => set({ activeArtifactId: artifactId }),

      clearArtifacts: () => set({ artifacts: [], activeArtifactId: null }),

      addTask: (task) => {
        const id = generateId();
        const fullTask: TaskItem = {
          ...task,
          id,
          createdAt: now(),
          updatedAt: now(),
        };
        set((state) => {
          const updated = [fullTask, ...state.tasks];
          if (updated.length > MAX_TASKS) {
            updated.splice(MAX_TASKS);
          }
          return { tasks: updated };
        });
        return id;
      },

      updateTaskProgress: (taskId, progress, status) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId
              ? { ...t, progress: Math.min(100, Math.max(0, progress)), status: status || t.status, updatedAt: now() }
              : t
          ),
        })),

      completeTask: (taskId, errorMessage) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  progress: errorMessage ? t.progress : 100,
                  status: errorMessage ? 'failed' : 'completed',
                  errorMessage: errorMessage || t.errorMessage,
                  updatedAt: now(),
                }
              : t
          ),
        })),

      removeTask: (taskId) =>
        set((state) => ({
          tasks: state.tasks.filter((t) => t.id !== taskId),
        })),

      clearTasks: () => set({ tasks: [] }),

      addNotification: (notification) => {
        const id = generateId();
        const fullNotification: NotificationItem = {
          ...notification,
          id,
          timestamp: now(),
          read: false,
        };
        set((state) => {
          const updated = [fullNotification, ...state.notifications];
          if (updated.length > MAX_NOTIFICATIONS) {
            updated.splice(MAX_NOTIFICATIONS);
          }
          return {
            notifications: updated,
            unreadCount: state.unreadCount + 1,
          };
        });
        return id;
      },

      markNotificationRead: (notificationId) =>
        set((state) => {
          const wasUnread = state.notifications.find((n) => n.id === notificationId && !n.read);
          return {
            notifications: state.notifications.map((n) =>
              n.id === notificationId ? { ...n, read: true } : n
            ),
            unreadCount: wasUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
          };
        }),

      markAllNotificationsRead: () =>
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
          unreadCount: 0,
        })),

      removeNotification: (notificationId) =>
        set((state) => {
          const wasUnread = state.notifications.find((n) => n.id === notificationId && !n.read);
          return {
            notifications: state.notifications.filter((n) => n.id !== notificationId),
            unreadCount: wasUnread ? Math.max(0, state.unreadCount - 1) : state.unreadCount,
          };
        }),

      clearNotifications: () => set({ notifications: [], unreadCount: 0 }),

      setPanelTab: (tab) => set({ panelTab: tab }),

      togglePanel: () =>
        set((state) => ({ panelCollapsed: !state.panelCollapsed })),

      setPanelCollapsed: (collapsed) => set({ panelCollapsed: collapsed }),
    }),
    {
      name: 'ecomind-artifact-storage',
      partialize: (state) => ({
        artifacts: state.artifacts,
        tasks: state.tasks,
        notifications: state.notifications,
        panelCollapsed: state.panelCollapsed,
      }),
    }
  )
);
