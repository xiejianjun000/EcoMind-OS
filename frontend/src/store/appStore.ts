import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ============================================================
// Type Definitions
// ============================================================

/** Application theme type */
type ThemeMode = 'light' | 'dark';

/** Deployment mode type */
type DeployMode = 'local' | 'cloud' | 'hybrid';

/** Agent status enum */
export type AgentStatus = 'idle' | 'running' | 'paused' | 'error' | 'offline' | 'terminated';

/** Security alert severity */
export type SecuritySeverity = 'low' | 'medium' | 'high' | 'critical';

/** Security alert event type */
export type SecurityEventType = 'intrusion' | 'malware' | 'policy_violation' | 'anomaly' | 'data_leak' | 'other';

/** Approval notification action */
export type ApprovalAction = 'pending' | 'approved' | 'rejected';

/** Workflow status */
export type WorkflowStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

/** Security alert data structure */
export interface SecurityAlert {
  eventId: string;
  eventType: SecurityEventType;
  severity: SecuritySeverity;
  description: string;
  timestamp: string;
}

/** Approval notification data structure */
export interface ApprovalNotification {
  approvalId: string;
  title: string;
  department: string;
  action: ApprovalAction;
  timestamp: string;
}

/** Workflow progress info */
export interface WorkflowProgressInfo {
  step: number;
  totalSteps: number;
  status: WorkflowStatus;
  timestamp: string;
}

// ============================================================
// Store State Interface
// ============================================================

/** Application global state interface */
interface AppState {
  // --- Original state ---
  /** Current theme mode */
  theme: ThemeMode;
  /** Current deployment mode */
  deployMode: DeployMode;
  /** Sidebar collapsed state */
  sidebarCollapsed: boolean;
  /** Current locale */
  locale: 'zh-CN' | 'en-US';

  // --- WebSocket connection state ---
  /** Whether the WebSocket is connected */
  wsConnected: boolean;
  /** Number of reconnection attempts */
  wsReconnectCount: number;
  /** Timestamp of last received WebSocket message */
  wsLastMessageTime: string | null;

  // --- Real-time agent updates ---
  /** Agent status map: agent_id → AgentStatus */
  agentUpdates: Record<string, AgentStatus>;

  // --- Security alerts (most recent 50) ---
  securityAlerts: SecurityAlert[];

  // --- Approval notifications (most recent 20) ---
  approvalNotifications: ApprovalNotification[];

  // --- Workflow progress ---
  /** Workflow progress map: workflow_id → WorkflowProgressInfo */
  workflowProgress: Record<string, WorkflowProgressInfo>;

  // --- Original actions ---
  /** Toggle theme between light and dark */
  toggleTheme: () => void;
  /** Set deployment mode */
  setDeployMode: (mode: DeployMode) => void;
  /** Toggle sidebar collapsed state */
  toggleSidebar: () => void;
  /** Set sidebar collapsed state */
  setSidebarCollapsed: (collapsed: boolean) => void;
  /** Set locale */
  setLocale: (locale: 'zh-CN' | 'en-US') => void;

  // --- WebSocket actions ---
  /** Set WebSocket connection status */
  setWsConnected: (connected: boolean) => void;
  /** Set WebSocket reconnect count */
  setWsReconnectCount: (count: number) => void;
  /** Set timestamp of last WebSocket message */
  setWsLastMessageTime: (time: string | null) => void;

  // --- Agent actions ---
  /** Update a single agent's status */
  updateAgentStatus: (agentId: string, status: AgentStatus) => void;

  // --- Security alert actions ---
  /** Add a new security alert (keeps the most recent 50) */
  addSecurityAlert: (alert: SecurityAlert) => void;
  /** Clear all security alerts */
  clearSecurityAlerts: () => void;

  // --- Approval notification actions ---
  /** Add a new approval notification (keeps the most recent 20) */
  addApprovalNotification: (notification: ApprovalNotification) => void;
  /** Clear all approval notifications */
  clearApprovalNotifications: () => void;

  // --- Workflow progress actions ---
  /** Update progress for a specific workflow */
  updateWorkflowProgress: (workflowId: string, info: WorkflowProgressInfo) => void;
}

// ============================================================
// Constants
// ============================================================

/** Maximum number of security alerts to retain */
const MAX_SECURITY_ALERTS = 50;

/** Maximum number of approval notifications to retain */
const MAX_APPROVAL_NOTIFICATIONS = 20;

// ============================================================
// Store
// ============================================================

/**
 * Global application state store using Zustand.
 * Persists theme and locale preferences to localStorage.
 * Integrates real-time WebSocket data for agents, security, approvals, and workflows.
 */
export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // --- Original state ---
      theme: 'dark',
      deployMode: 'local',
      sidebarCollapsed: false,
      locale: 'zh-CN',

      // --- WebSocket connection state ---
      wsConnected: false,
      wsReconnectCount: 0,
      wsLastMessageTime: null,

      // --- Real-time data ---
      agentUpdates: {},
      securityAlerts: [],
      approvalNotifications: [],
      workflowProgress: {},

      // --- Original actions ---
      toggleTheme: () =>
        set((state) => ({
          theme: state.theme === 'light' ? 'dark' : 'light',
        })),

      setDeployMode: (mode) => set({ deployMode: mode }),

      toggleSidebar: () =>
        set((state) => ({
          sidebarCollapsed: !state.sidebarCollapsed,
        })),

      setSidebarCollapsed: (collapsed) =>
        set({ sidebarCollapsed: collapsed }),

      setLocale: (locale) => set({ locale }),

      // --- WebSocket connection actions ---
      setWsConnected: (connected) => set({ wsConnected: connected }),

      setWsReconnectCount: (count) => set({ wsReconnectCount: count }),

      setWsLastMessageTime: (time) => set({ wsLastMessageTime: time }),

      // --- Agent actions ---
      updateAgentStatus: (agentId, status) =>
        set((state) => ({
          agentUpdates: {
            ...state.agentUpdates,
            [agentId]: status,
          },
        })),

      // --- Security alert actions ---
      addSecurityAlert: (alert) =>
        set((state) => {
          const updated = [alert, ...state.securityAlerts];
          return {
            securityAlerts: updated.slice(0, MAX_SECURITY_ALERTS),
          };
        }),

      clearSecurityAlerts: () => set({ securityAlerts: [] }),

      // --- Approval notification actions ---
      addApprovalNotification: (notification) =>
        set((state) => {
          const updated = [notification, ...state.approvalNotifications];
          return {
            approvalNotifications: updated.slice(0, MAX_APPROVAL_NOTIFICATIONS),
          };
        }),

      clearApprovalNotifications: () => set({ approvalNotifications: [] }),

      // --- Workflow progress actions ---
      updateWorkflowProgress: (workflowId, info) =>
        set((state) => ({
          workflowProgress: {
            ...state.workflowProgress,
            [workflowId]: info,
          },
        })),
    }),
    {
      name: 'ecomind-app-storage',
      partialize: (state) => ({
        theme: state.theme,
        locale: state.locale,
      }),
    }
  )
);
