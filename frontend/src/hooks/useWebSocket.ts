import { useState, useEffect, useRef, useCallback } from 'react';

/** WebSocket message types from the backend */
export type WebSocketMessageType =
  | 'agent_status_changed'
  | 'security_alert'
  | 'approval_notification'
  | 'workflow_progress';

/** Structured WebSocket message from the backend */
export interface WebSocketMessage {
  type: WebSocketMessageType;
  data: Record<string, unknown>;
  timestamp: string;
}

/** Options for the useWebSocket hook */
export interface UseWebSocketOptions {
  /** WebSocket server URL */
  url: string;
  /** Callback invoked when a message is received */
  onMessage?: (message: WebSocketMessage) => void;
  /** Whether to auto-reconnect on disconnection (default: true) */
  autoReconnect?: boolean;
  /** Initial reconnect interval in ms (default: 3000) */
  reconnectInterval?: number;
  /** Maximum reconnect interval in ms (default: 30000) */
  maxReconnectInterval?: number;
  /** Heartbeat ping interval in ms (default: 30000) */
  heartbeatInterval?: number;
}

/** Return type of the useWebSocket hook */
export interface UseWebSocketReturn {
  /** Whether the WebSocket is currently connected */
  isConnected: boolean;
  /** The last received message, or null */
  lastMessage: WebSocketMessage | null;
  /** Send arbitrary data through the WebSocket */
  sendMessage: (data: unknown) => void;
  /** Manually initiate a connection */
  connect: () => void;
  /** Manually close the connection */
  disconnect: () => void;
  /** Number of reconnection attempts since last successful connection */
  reconnectCount: number;
  /** Timestamp of the last received message */
  lastMessageTime: Date | null;
}

/**
 * Custom hook for managing a WebSocket connection with
 * auto-reconnect (exponential backoff), heartbeat, and lifecycle management.
 */
export function useWebSocket(options: UseWebSocketOptions): UseWebSocketReturn {
  const {
    url,
    onMessage,
    autoReconnect = true,
    reconnectInterval = 3000,
    maxReconnectInterval = 30000,
    heartbeatInterval = 30000,
  } = options;

  // --- State ---
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [reconnectCount, setReconnectCount] = useState<number>(0);
  const [lastMessageTime, setLastMessageTime] = useState<Date | null>(null);

  // --- Refs for stable references ---
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentReconnectIntervalRef = useRef<number>(reconnectInterval);
  const intentionalCloseRef = useRef<boolean>(false);
  const onMessageRef = useRef(onMessage);

  // Keep onMessageRef in sync without triggering re-connections
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  /** Clear the heartbeat timer */
  const clearHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  }, []);

  /** Start the heartbeat ping loop */
  const startHeartbeat = useCallback(() => {
    clearHeartbeat();
    heartbeatTimerRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, heartbeatInterval);
  }, [heartbeatInterval, clearHeartbeat]);

  /** Clear any pending reconnect timer */
  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  /** Fully close and clean up the current WebSocket connection */
  const cleanup = useCallback(() => {
    clearReconnectTimer();
    clearHeartbeat();
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      if (
        wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING
      ) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }
  }, [clearReconnectTimer, clearHeartbeat]);

  /** Initiate a WebSocket connection */
  const connect = useCallback(() => {
    cleanup();
    intentionalCloseRef.current = false;

    if (import.meta.env.DEV) {
      console.log(`[WebSocket] Connecting to ${url}...`);
    }

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      currentReconnectIntervalRef.current = reconnectInterval;
      setReconnectCount(0);
      startHeartbeat();

      if (import.meta.env.DEV) {
        console.log('[WebSocket] Connected');
      }
    };

    ws.onclose = (event) => {
      setIsConnected(false);
      clearHeartbeat();

      if (import.meta.env.DEV) {
        console.log(`[WebSocket] Disconnected (code=${event.code}, reason=${event.reason || 'none'})`);
      }

      // Auto-reconnect unless intentionally closed
      if (autoReconnect && !intentionalCloseRef.current) {
        const delay = currentReconnectIntervalRef.current;
        if (import.meta.env.DEV) {
          console.log(`[WebSocket] Reconnecting in ${delay}ms...`);
        }

        reconnectTimerRef.current = setTimeout(() => {
          setReconnectCount((prev) => prev + 1);
          currentReconnectIntervalRef.current = Math.min(
            currentReconnectIntervalRef.current * 2,
            maxReconnectInterval
          );
          connect();
        }, delay);
      }
    };

    ws.onerror = (event) => {
      if (import.meta.env.DEV) {
        console.error('[WebSocket] Error', event);
      }
    };

    ws.onmessage = (event: MessageEvent<string>) => {
      try {
        const parsed: WebSocketMessage = JSON.parse(event.data);

        // Ignore pong responses from the server
        if ((parsed as { type?: string }).type === 'pong') {
          return;
        }

        setLastMessage(parsed);
        setLastMessageTime(new Date());
        onMessageRef.current?.(parsed);
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error('[WebSocket] Failed to parse message:', event.data, err);
        }
      }
    };
  }, [url, autoReconnect, reconnectInterval, maxReconnectInterval, cleanup, startHeartbeat]);

  /** Manually disconnect from the WebSocket */
  const disconnect = useCallback(() => {
    intentionalCloseRef.current = true;
    cleanup();
    setIsConnected(false);

    if (import.meta.env.DEV) {
      console.log('[WebSocket] Manually disconnected');
    }
  }, [cleanup]);

  /** Send data through the active WebSocket connection */
  const sendMessage = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(typeof data === 'string' ? data : JSON.stringify(data));
    } else {
      if (import.meta.env.DEV) {
        console.warn('[WebSocket] Cannot send — not connected');
      }
    }
  }, []);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    connect();
    return () => {
      intentionalCloseRef.current = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return {
    isConnected,
    lastMessage,
    sendMessage,
    connect,
    disconnect,
    reconnectCount,
    lastMessageTime,
  };
}
