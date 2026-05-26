import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  ChatMessage,
  ChatSession,
  StreamChunk,
  MessageArtifactRef,
  InlineComponent,
} from '@/types/chat';

// ============================================================
// Constants
// ============================================================

const MAX_MESSAGES_PER_SESSION = 500;

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
// State Interface
// ============================================================

interface ChatState {
  // Sessions
  sessions: ChatSession[];
  currentSessionId: string | null;

  // Messages per session
  messages: Record<string, ChatMessage[]>;

  // UI state
  isLoading: boolean;
  streamingMessageId: string | null;

  // Input draft per session
  inputDrafts: Record<string, string>;

  // Actions
  createSession: (params?: { title?: string; expertId?: string; expertName?: string }) => string;
  deleteSession: (sessionId: string) => void;
  setCurrentSession: (sessionId: string) => void;
  updateSessionTitle: (sessionId: string, title: string) => void;

  addUserMessage: (sessionId: string, content: string) => string;
  startAssistantMessage: (sessionId: string, expertId?: string, expertName?: string) => string;
  appendStreamChunk: (chunk: StreamChunk) => void;
  finalizeStreamingMessage: (messageId: string) => void;
  addFullAssistantMessage: (sessionId: string, message: Omit<ChatMessage, 'id' | 'role' | 'timestamp'>) => void;

  setInputDraft: (sessionId: string, draft: string) => void;
  setIsLoading: (loading: boolean) => void;

  clearSessionMessages: (sessionId: string) => void;
  clearAllData: () => void;
}

// ============================================================
// Store
// ============================================================

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      sessions: [],
      currentSessionId: null,
      messages: {},
      isLoading: false,
      streamingMessageId: null,
      inputDrafts: {},

      createSession: (params = {}) => {
        const id = generateId();
        const session: ChatSession = {
          id,
          title: params.title || '新会话',
          expertId: params.expertId,
          expertName: params.expertName,
          createdAt: now(),
          updatedAt: now(),
          messageCount: 0,
        };
        set((state) => ({
          sessions: [session, ...state.sessions],
          currentSessionId: id,
          messages: { ...state.messages, [id]: [] },
        }));
        return id;
      },

      deleteSession: (sessionId) => {
        set((state) => {
          const sessions = state.sessions.filter((s) => s.id !== sessionId);
          const messages = { ...state.messages };
          delete messages[sessionId];
          const inputDrafts = { ...state.inputDrafts };
          delete inputDrafts[sessionId];

          let currentSessionId = state.currentSessionId;
          if (currentSessionId === sessionId) {
            currentSessionId = sessions[0]?.id ?? null;
          }

          return { sessions, messages, inputDrafts, currentSessionId };
        });
      },

      setCurrentSession: (sessionId) => {
        set({ currentSessionId: sessionId });
      },

      updateSessionTitle: (sessionId, title) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId ? { ...s, title, updatedAt: now() } : s
          ),
        }));
      },

      addUserMessage: (sessionId, content) => {
        const messageId = generateId();
        const message: ChatMessage = {
          id: messageId,
          role: 'user',
          content,
          timestamp: now(),
        };
        set((state) => {
          const existing = state.messages[sessionId] || [];
          const updated = [...existing, message];
          if (updated.length > MAX_MESSAGES_PER_SESSION) {
            updated.splice(0, updated.length - MAX_MESSAGES_PER_SESSION);
          }
          return {
            messages: { ...state.messages, [sessionId]: updated },
            sessions: state.sessions.map((s) =>
              s.id === sessionId
                ? { ...s, messageCount: updated.length, updatedAt: now() }
                : s
            ),
          };
        });
        return messageId;
      },

      startAssistantMessage: (sessionId, expertId, expertName) => {
        const messageId = generateId();
        const message: ChatMessage = {
          id: messageId,
          role: 'assistant',
          content: '',
          expert: expertId
            ? { id: expertId, name: expertName || 'AI助手' }
            : undefined,
          timestamp: now(),
          isStreaming: true,
          streamContent: '',
        };
        set((state) => {
          const existing = state.messages[sessionId] || [];
          const updated = [...existing, message];
          return {
            messages: { ...state.messages, [sessionId]: updated },
            streamingMessageId: messageId,
            isLoading: true,
          };
        });
        return messageId;
      },

      appendStreamChunk: (chunk) => {
        if (chunk.type === 'error') {
          set((state) => {
            const msgs = state.messages[chunk.sessionId] || [];
            const idx = msgs.findIndex((m) => m.id === chunk.messageId);
            if (idx === -1) return state;
            const updated = [...msgs];
            updated[idx] = {
              ...updated[idx],
              content: updated[idx].content + `\n\n[错误: ${chunk.error}]`,
              isStreaming: false,
            };
            return {
              messages: { ...state.messages, [chunk.sessionId]: updated },
              streamingMessageId: null,
              isLoading: false,
            };
          });
          return;
        }

        if (chunk.type === 'done') {
          set((state) => {
            const msgs = state.messages[chunk.sessionId] || [];
            const idx = msgs.findIndex((m) => m.id === chunk.messageId);
            if (idx === -1) return { streamingMessageId: null, isLoading: false };
            const updated = [...msgs];
            updated[idx] = {
              ...updated[idx],
              isStreaming: false,
              streamContent: undefined,
            };
            return {
              messages: { ...state.messages, [chunk.sessionId]: updated },
              streamingMessageId: null,
              isLoading: false,
            };
          });
          return;
        }

        // chunk or component
        set((state) => {
          const msgs = state.messages[chunk.sessionId] || [];
          const idx = msgs.findIndex((m) => m.id === chunk.messageId);
          if (idx === -1) return state;

          const updated = [...msgs];
          const msg = updated[idx];

          let newContent = msg.content;
          let newComponents = msg.components ? [...msg.components] : undefined;
          let newArtifacts = msg.artifacts ? [...msg.artifacts] : undefined;
          let newThinking = msg.thinking;
          let newTools = msg.toolsUsed ? [...msg.toolsUsed] : undefined;
          let newRisk = msg.hallucinationRisk;

          if (chunk.type === 'chunk' && chunk.content) {
            newContent += chunk.content;
          }
          if (chunk.type === 'component' && chunk.component) {
            newComponents = [...(newComponents || []), chunk.component];
          }
          if (chunk.type === 'artifact' && chunk.artifact) {
            newArtifacts = [...(newArtifacts || []), chunk.artifact];
          }
          if (chunk.thinking) {
            newThinking = (newThinking || '') + chunk.thinking;
          }
          if (chunk.toolsUsed) {
            newTools = [...(newTools || []), ...chunk.toolsUsed];
          }
          if (chunk.hallucinationRisk !== undefined) {
            newRisk = chunk.hallucinationRisk;
          }

          updated[idx] = {
            ...msg,
            content: newContent,
            components: newComponents,
            artifacts: newArtifacts,
            thinking: newThinking,
            toolsUsed: newTools,
            hallucinationRisk: newRisk,
          };

          return {
            messages: { ...state.messages, [chunk.sessionId]: updated },
          };
        });
      },

      finalizeStreamingMessage: (messageId) => {
        set((state) => {
          const sessionId = state.currentSessionId;
          if (!sessionId) return state;
          const msgs = state.messages[sessionId] || [];
          const idx = msgs.findIndex((m) => m.id === messageId);
          if (idx === -1) return { streamingMessageId: null, isLoading: false };
          const updated = [...msgs];
          updated[idx] = {
            ...updated[idx],
            isStreaming: false,
            streamContent: undefined,
          };
          return {
            messages: { ...state.messages, [sessionId]: updated },
            streamingMessageId: null,
            isLoading: false,
          };
        });
      },

      addFullAssistantMessage: (sessionId, message) => {
        const messageId = generateId();
        const fullMessage: ChatMessage = {
          ...message,
          id: messageId,
          role: 'assistant',
          timestamp: now(),
          isStreaming: false,
        };
        set((state) => {
          const existing = state.messages[sessionId] || [];
          const updated = [...existing, fullMessage];
          if (updated.length > MAX_MESSAGES_PER_SESSION) {
            updated.splice(0, updated.length - MAX_MESSAGES_PER_SESSION);
          }
          return {
            messages: { ...state.messages, [sessionId]: updated },
            sessions: state.sessions.map((s) =>
              s.id === sessionId
                ? { ...s, messageCount: updated.length, updatedAt: now() }
                : s
            ),
            isLoading: false,
          };
        });
      },

      setInputDraft: (sessionId, draft) => {
        set((state) => ({
          inputDrafts: { ...state.inputDrafts, [sessionId]: draft },
        }));
      },

      setIsLoading: (loading) => {
        set({ isLoading: loading });
      },

      clearSessionMessages: (sessionId) => {
        set((state) => {
          const messages = { ...state.messages, [sessionId]: [] };
          return {
            messages,
            sessions: state.sessions.map((s) =>
              s.id === sessionId ? { ...s, messageCount: 0 } : s
            ),
          };
        });
      },

      clearAllData: () => {
        set({
          sessions: [],
          currentSessionId: null,
          messages: {},
          isLoading: false,
          streamingMessageId: null,
          inputDrafts: {},
        });
      },
    }),
    {
      name: 'ecomind-chat-storage',
      partialize: (state) => ({
        sessions: state.sessions,
        messages: state.messages,
        currentSessionId: state.currentSessionId,
        inputDrafts: state.inputDrafts,
      }),
    }
  )
);
