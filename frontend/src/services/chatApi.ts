/**
 * Chat API service layer — 对话相关 API 封装
 * 后端暂未实现，先提供 Mock 数据支持前端开发
 */

import type {
  CreateSessionRequest,
  CreateSessionResponse,
  SessionsListResponse,
  MessagesListResponse,
  SendMessageRequest,
  SendMessageResponse,
  StreamChunk,
} from '@/types/chat';

const API_BASE = '/api';

/** Generic request helper with error handling */
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail));
  }
  return res.json() as Promise<T>;
}

// ============================================================
// Session APIs
// ============================================================

export async function createSession(params: CreateSessionRequest): Promise<CreateSessionResponse> {
  // TODO: replace with real API when backend is ready
  // return request<CreateSessionResponse>('/chat/sessions', {
  //   method: 'POST',
  //   body: JSON.stringify(params),
  // });

  // Mock response for frontend development
  const session = {
    id: `session-${Date.now()}`,
    title: params.title || '新会话',
    expertId: params.expert_id,
    expertName: undefined,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messageCount: 0,
    workspaceId: params.workspace_id,
  };
  return { session };
}

export async function listSessions(): Promise<SessionsListResponse> {
  // TODO: real API
  // return request<SessionsListResponse>('/chat/sessions');
  return { sessions: [], total: 0 };
}

export async function getSessionMessages(sessionId: string): Promise<MessagesListResponse> {
  // TODO: real API
  // return request<MessagesListResponse>(`/chat/sessions/${sessionId}/messages`);
  return { messages: [], total: 0 };
}

export async function deleteSession(sessionId: string): Promise<void> {
  // TODO: real API
  // await request(`/chat/sessions/${sessionId}`, { method: 'DELETE' });
}

// ============================================================
// Message APIs
// ============================================================

export async function sendMessage(
  sessionId: string,
  message: string,
  expertId?: string
): Promise<SendMessageResponse> {
  // TODO: replace with real API
  // return request<SendMessageResponse>(`/chat/sessions/${sessionId}/messages`, {
  //   method: 'POST',
  //   body: JSON.stringify({ session_id: sessionId, message, expert_id: expertId }),
  // });

  // Mock response
  return {
    message_id: `msg-${Date.now()}`,
    session_id: sessionId,
    content: `已收到您的消息："${message}"。\n\n后端 API 尚未接入，这是 Mock 回复。后续将接入 TAIJI-AGENT 实现真实对话能力。`,
    expert: expertId
      ? { id: expertId, name: 'AI助手' }
      : undefined,
  };
}

// ============================================================
// Streaming API (WebSocket-based)
// ============================================================

export type StreamCallback = (chunk: StreamChunk) => void;

/**
 * Send a message and receive streaming response via WebSocket.
 * Returns a cleanup function to abort the stream.
 */
export function sendMessageStream(
  sessionId: string,
  message: string,
  expertId: string | undefined,
  messageId: string,
  onChunk: StreamCallback,
  ws: WebSocket | null
): () => void {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    onChunk({
      type: 'error',
      sessionId,
      messageId,
      error: 'WebSocket 未连接，无法发送消息',
    });
    return () => {};
  }

  // Send the message via WebSocket
  ws.send(
    JSON.stringify({
      action: 'chat',
      session_id: sessionId,
      message,
      expert_id: expertId,
      message_id: messageId,
    })
  );

  // The WebSocketProvider will route response chunks to the store.
  // For now, simulate a mock streaming response.
  const mockReply = `收到您的消息："${message}"。\n\n这是模拟的流式回复。实际部署后将通过 WebSocket 接收 TAIJI-AGENT 的实时推理输出。\n\n当前系统能力：\n- 12 个业务域专家 Agent\n- WebSocket 实时推送\n- 产物/任务/通知面板\n- 3D 地图内嵌预览`;

  const words = mockReply.split('');
  let index = 0;

  const interval = setInterval(() => {
    const batch = words.slice(index, index + 3);
    if (batch.length === 0) {
      clearInterval(interval);
      onChunk({ type: 'done', sessionId, messageId });
      return;
    }
    onChunk({
      type: 'chunk',
      sessionId,
      messageId,
      content: batch.join(''),
    });
    index += 3;
  }, 30);

  return () => clearInterval(interval);
}

// ============================================================
// Expert APIs
// ============================================================

export async function listExperts() {
  // TODO: real API
  // return request('/experts');
  return { experts: [] };
}

export async function getExpert(expertId: string) {
  // TODO: real API
  // return request(`/experts/${expertId}`);
  return { expert: null };
}
