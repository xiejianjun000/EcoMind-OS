/**
 * Chat API service layer — 对话相关 API 封装
 * v6.5: DeepSeek 真实 API 集成 + Mock 降级
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
import { chatStream, isApiKeyConfigured } from '@/services/deepseek';

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
 * Send a message and receive streaming response.
 * v6.5: Uses DeepSeek API when key is configured, falls back to mock.
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
  // ── 优先使用 WebSocket (后端已部署时) ──
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(
      JSON.stringify({
        action: 'chat',
        session_id: sessionId,
        message,
        expert_id: expertId,
        message_id: messageId,
      })
    );
    return () => {};
  }

  // ── DeepSeek API 真实调用 ──
  if (isApiKeyConfigured()) {
    return chatStream(message, {
      expertId,
      onChunk: (text) => {
        onChunk({ type: 'chunk', sessionId, messageId, content: text });
      },
      onDone: () => {
        onChunk({ type: 'done', sessionId, messageId });
      },
      onError: (err) => {
        console.warn('[DeepSeek] Stream error, falling back to mock:', err.message);
        // 降级到 Mock 回复
        sendMockStream(sessionId, message, messageId, onChunk);
      },
    });
  }

  // ── Mock 降级 ──
  sendMockStream(sessionId, message, messageId, onChunk);
  return () => {};
}

/** Mock 流式回复 (API Key 未配置时的降级方案) */
function sendMockStream(
  sessionId: string,
  message: string,
  messageId: string,
  onChunk: StreamCallback
) {
  const mockReply = `收到您的消息："${message}"。

我是 EcoMind OS 智能助手。当前为 Mock 模式回复。

💡 提示：配置 DeepSeek API Key 即可启用真实 AI 对话。
   在项目根目录 .env 文件中设置：
   VITE_DEEPSEEK_API_KEY=你的API密钥

   获取免费 Key: https://platform.deepseek.com/api_keys

当前系统能力：
• 12 个业务域专家 Agent
• 实时流式对话
• 产物/任务/通知面板
• 3D 地图内嵌预览
• 技能市场 & 自动化`;

  const chars = mockReply.split('');
  let index = 0;

  const interval = setInterval(() => {
    const batch = chars.slice(index, index + 3);
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
