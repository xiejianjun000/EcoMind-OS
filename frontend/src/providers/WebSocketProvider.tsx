import React, { useMemo, useCallback } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import type { WebSocketMessage } from '@/hooks/useWebSocket';
import { useAppStore } from '@/store';
import type {
  AgentStatus,
  SecurityAlert,
  ApprovalNotification,
  WorkflowProgressInfo,
} from '@/store';

/** WebSocket server URL */
const WS_URL = 'ws://localhost:8000/ws';

/**
 * WebSocket message dispatcher.
 * Routes incoming messages to the appropriate Zustand store actions.
 */
function dispatchMessage(message: WebSocketMessage): void {
  const store = useAppStore.getState();
  const { type, data, timestamp } = message;

  switch (type) {
    case 'agent_status_changed': {
      const agentId = data.agent_id as string | undefined;
      const status = data.status as AgentStatus | undefined;
      if (agentId && status) {
        store.updateAgentStatus(agentId, status);
      }
      break;
    }

    case 'security_alert': {
      const alert: SecurityAlert = {
        eventId: (data.event_id as string) ?? '',
        eventType: (data.event_type as SecurityAlert['eventType']) ?? 'other',
        severity: (data.severity as SecurityAlert['severity']) ?? 'medium',
        description: (data.description as string) ?? '',
        timestamp: timestamp ?? new Date().toISOString(),
      };
      store.addSecurityAlert(alert);
      break;
    }

    case 'approval_notification': {
      const notification: ApprovalNotification = {
        approvalId: (data.approval_id as string) ?? '',
        title: (data.title as string) ?? '',
        department: (data.department as string) ?? '',
        action: (data.action as ApprovalNotification['action']) ?? 'pending',
        timestamp: timestamp ?? new Date().toISOString(),
      };
      store.addApprovalNotification(notification);
      break;
    }

    case 'workflow_progress': {
      const workflowId = data.workflow_id as string | undefined;
      if (workflowId) {
        const info: WorkflowProgressInfo = {
          step: (data.step as number) ?? 0,
          totalSteps: (data.total_steps as number) ?? 0,
          status: (data.status as WorkflowProgressInfo['status']) ?? 'pending',
          timestamp: timestamp ?? new Date().toISOString(),
        };
        store.updateWorkflowProgress(workflowId, info);
      }
      break;
    }

    default: {
      if (import.meta.env.DEV) {
        console.warn('[WebSocketProvider] Unknown message type:', type);
      }
      break;
    }
  }
}

/**
 * Provider component that establishes a WebSocket connection
 * and dispatches incoming messages to the Zustand store.
 * Wrap your application with this at the top level.
 */
export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const setWsConnected = useAppStore((s) => s.setWsConnected);
  const setWsReconnectCount = useAppStore((s) => s.setWsReconnectCount);
  const setWsLastMessageTime = useAppStore((s) => s.setWsLastMessageTime);

  /** Stable message handler — dispatches to store */
  const handleMessage = useCallback((message: WebSocketMessage) => {
    dispatchMessage(message);
  }, []);

  const {
    isConnected,
    reconnectCount,
    lastMessageTime,
    sendMessage,
    connect,
    disconnect,
  } = useWebSocket({
    url: WS_URL,
    onMessage: handleMessage,
    autoReconnect: true,
    reconnectInterval: 3000,
    maxReconnectInterval: 30000,
    heartbeatInterval: 30000,
  });

  // Sync connection state to store
  React.useEffect(() => {
    setWsConnected(isConnected);
  }, [isConnected, setWsConnected]);

  React.useEffect(() => {
    setWsReconnectCount(reconnectCount);
  }, [reconnectCount, setWsReconnectCount]);

  React.useEffect(() => {
    setWsLastMessageTime(lastMessageTime?.toISOString() ?? null);
  }, [lastMessageTime, setWsLastMessageTime]);

  // Expose send/connect/disconnect via context-like mechanism (window) for debugging
  React.useEffect(() => {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__ws = { sendMessage, connect, disconnect };
    }
    return () => {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (window as any).__ws;
      }
    };
  }, [sendMessage, connect, disconnect]);

  // Memo-ize children to avoid unnecessary re-renders
  const childrenContent = useMemo(() => children, [children]);

  return <>{childrenContent}</>;
};
