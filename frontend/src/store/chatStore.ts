import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  ChatMessage,
  ChatSession,
  StreamChunk,
  MessageArtifactRef,
  InlineComponent,
  SessionFile,
  ChangeLogEntry,
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

  // Selected session IDs for batch operations
  selectedSessionIds: string[];

  // Actions — Session
  createSession: (params?: { title?: string; expertId?: string; expertName?: string }) => string;
  deleteSession: (sessionId: string) => void;
  deleteSessions: (sessionIds: string[]) => void;
  setCurrentSession: (sessionId: string) => void;
  updateSessionTitle: (sessionId: string, title: string) => void;
  syncSessionMeta: (sessionId: string, meta: { title?: string; messageCount?: number; expertId?: string; expertName?: string }) => void;
  toggleSessionSelection: (sessionId: string) => void;
  selectAllSessions: () => void;
  clearSelection: () => void;

  // Actions — Conclusion
  setSessionConclusion: (sessionId: string, conclusion: string) => void;
  getSessionConclusion: (sessionId: string) => string | undefined;

  // Actions — File tracking
  addSessionFile: (sessionId: string, file: SessionFile) => void;
  removeSessionFile: (sessionId: string, fileId: string) => void;
  addMessageFile: (sessionId: string, messageId: string, file: SessionFile) => void;

  // Actions — Change log
  addChangeLog: (sessionId: string, entry: ChangeLogEntry) => void;

  // Actions — Tags
  setSessionTags: (sessionId: string, tags: string[]) => void;
  addSessionTag: (sessionId: string, tag: string) => void;
  removeSessionTag: (sessionId: string, tag: string) => void;

  // Actions — Cross-session search
  searchAcrossSessions: (query: string) => { sessionId: string; title: string; matchCount: number; preview: string }[];

  // Actions — Messages
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
      selectedSessionIds: [],

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

          return {
            sessions, messages, inputDrafts, currentSessionId,
            selectedSessionIds: state.selectedSessionIds.filter(id => id !== sessionId),
          };
        });
      },

      deleteSessions: (sessionIds) => {
        set((state) => {
          const idSet = new Set(sessionIds);
          const sessions = state.sessions.filter((s) => !idSet.has(s.id));
          const messages = { ...state.messages };
          const inputDrafts = { ...state.inputDrafts };
          for (const id of sessionIds) {
            delete messages[id];
            delete inputDrafts[id];
          }

          let currentSessionId = state.currentSessionId;
          if (currentSessionId && idSet.has(currentSessionId)) {
            currentSessionId = sessions[0]?.id ?? null;
          }

          return {
            sessions, messages, inputDrafts, currentSessionId,
            selectedSessionIds: [],
          };
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

      syncSessionMeta: (sessionId, meta) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId
              ? {
                  ...s,
                  ...(meta.title !== undefined ? { title: meta.title } : {}),
                  ...(meta.messageCount !== undefined ? { messageCount: meta.messageCount } : {}),
                  ...(meta.expertId !== undefined ? { expertId: meta.expertId } : {}),
                  ...(meta.expertName !== undefined ? { expertName: meta.expertName } : {}),
                  updatedAt: now(),
                }
              : s
          ),
        }));
      },

      // ─── Selection (batch ops) ───
      toggleSessionSelection: (sessionId) => {
        set((state) => {
          const idx = state.selectedSessionIds.indexOf(sessionId);
          if (idx === -1) {
            return { selectedSessionIds: [...state.selectedSessionIds, sessionId] };
          }
          return {
            selectedSessionIds: state.selectedSessionIds.filter(id => id !== sessionId),
          };
        });
      },

      selectAllSessions: () => {
        set((state) => ({
          selectedSessionIds: state.sessions.map(s => s.id),
        }));
      },

      clearSelection: () => set({ selectedSessionIds: [] }),

      // ─── Conclusion ───
      setSessionConclusion: (sessionId, conclusion) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId
              ? { ...s, conclusion, conclusionGeneratedAt: now(), updatedAt: now() }
              : s
          ),
        }));
      },

      getSessionConclusion: (sessionId) => {
        return get().sessions.find(s => s.id === sessionId)?.conclusion;
      },

      // ─── File tracking ───
      addSessionFile: (sessionId, file) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId
              ? { ...s, files: [...(s.files || []), file], updatedAt: now() }
              : s
          ),
        }));
      },

      removeSessionFile: (sessionId, fileId) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId
              ? { ...s, files: (s.files || []).filter(f => f.id !== fileId), updatedAt: now() }
              : s
          ),
        }));
      },

      addMessageFile: (sessionId, messageId, file) => {
        set((state) => {
          const msgs = state.messages[sessionId] || [];
          const idx = msgs.findIndex(m => m.id === messageId);
          if (idx === -1) return state;
          const updated = [...msgs];
          updated[idx] = {
            ...updated[idx],
            files: [...(updated[idx].files || []), file],
          };
          return { messages: { ...state.messages, [sessionId]: updated } };
        });
        // Also add to session file list
        get().addSessionFile(sessionId, file);
      },

      // ─── Change log ───
      addChangeLog: (sessionId, entry) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId
              ? { ...s, changeLog: [...(s.changeLog || []), entry], updatedAt: now() }
              : s
          ),
        }));
      },

      // ─── Tags ───
      setSessionTags: (sessionId, tags) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId ? { ...s, tags, updatedAt: now() } : s
          ),
        }));
      },

      addSessionTag: (sessionId, tag) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId && !(s.tags || []).includes(tag)
              ? { ...s, tags: [...(s.tags || []), tag], updatedAt: now() }
              : s
          ),
        }));
      },

      removeSessionTag: (sessionId, tag) => {
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === sessionId
              ? { ...s, tags: (s.tags || []).filter(t => t !== tag), updatedAt: now() }
              : s
          ),
        }));
      },

      // ─── Cross-session search ───
      searchAcrossSessions: (query) => {
        const state = get();
        const q = query.toLowerCase().trim();
        if (!q) return [];
        const results: { sessionId: string; title: string; matchCount: number; preview: string }[] = [];
        for (const session of state.sessions) {
          const msgs = state.messages[session.id] || [];
          let matchCount = 0;
          let preview = '';
          // Search in messages
          for (const msg of msgs) {
            const content = msg.content.toLowerCase();
            let idx = content.indexOf(q);
            while (idx !== -1) {
              matchCount++;
              if (!preview) {
                const start = Math.max(0, idx - 30);
                const end = Math.min(msg.content.length, idx + q.length + 40);
                preview = (start > 0 ? '...' : '') + msg.content.slice(start, end) + (end < msg.content.length ? '...' : '');
              }
              idx = content.indexOf(q, idx + 1);
            }
          }
          // Also search in title and conclusion
          if (session.title.toLowerCase().includes(q) || (session.conclusion || '').toLowerCase().includes(q)) {
            matchCount++;
            if (!preview) preview = session.conclusion || session.title;
          }
          if (matchCount > 0) {
            results.push({ sessionId: session.id, title: session.title, matchCount, preview });
          }
        }
        return results.sort((a, b) => b.matchCount - a.matchCount);
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

      setSessionMessages: (sessionId, msgs) => {
        set((state) => ({
          messages: { ...state.messages, [sessionId]: msgs },
          sessions: state.sessions.map((s) =>
            s.id === sessionId ? { ...s, messageCount: msgs.length, updatedAt: now() } : s
          ),
        }));
      },

      clearAllData: () => {
        set({
          sessions: [],
          currentSessionId: null,
          messages: {},
          isLoading: false,
          streamingMessageId: null,
          inputDrafts: {},
          selectedSessionIds: [],
        });
      },
    }),
    {
      name: 'ecomind-chat-storage',
      partialize: (state) => ({
        sessions: state.sessions.map(s => ({
          ...s,
          // Ensure new fields are persisted
          conclusion: s.conclusion,
          conclusionGeneratedAt: s.conclusionGeneratedAt,
          files: s.files,
          changeLog: s.changeLog,
          tags: s.tags,
        })),
        messages: state.messages,
        currentSessionId: state.currentSessionId,
        inputDrafts: state.inputDrafts,
      }),
    }
  )
);
