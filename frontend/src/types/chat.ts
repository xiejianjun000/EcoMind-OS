/**
 * Chat-related type definitions for the conversational UI
 */

/** Message role types */
export type MessageRole = 'user' | 'assistant' | 'system';

/** Expert agent reference in a message */
export interface MessageExpert {
  id: string;
  name: string;
  avatar?: string;
  role?: string;
}

/** Inline component embedded in a message */
export interface InlineComponent {
  type: 'chart' | 'map' | 'table' | 'approval' | 'alert' | 'document' | 'task' | 'image';
  data: unknown;
  title?: string;
}

/** Artifact reference attached to a message */
export interface MessageArtifactRef {
  artifactId: string;
  name: string;
  type: 'document' | 'chart' | 'map' | 'table' | 'image' | 'video';
  previewUrl?: string;
}

/** A single chat message */
export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  expert?: MessageExpert;
  timestamp: string;
  artifacts?: MessageArtifactRef[];
  components?: InlineComponent[];
  thinking?: string;
  hallucinationRisk?: number;
  toolsUsed?: string[];
  /** For streaming: whether this message is still being generated */
  isStreaming?: boolean;
  /** For streaming: partial content being built */
  streamContent?: string;
}

/** Chat session metadata */
export interface ChatSession {
  id: string;
  title: string;
  expertId?: string;
  expertName?: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  workspaceId?: string;
}

/** WebSocket streaming chunk */
export interface StreamChunk {
  type: 'chunk' | 'done' | 'error' | 'component' | 'artifact';
  sessionId: string;
  messageId: string;
  content?: string;
  component?: InlineComponent;
  artifact?: MessageArtifactRef;
  error?: string;
  thinking?: string;
  toolsUsed?: string[];
  hallucinationRisk?: number;
}

/** Chat API request payload */
export interface SendMessageRequest {
  session_id: string;
  message: string;
  expert_id?: string;
  attachments?: string[];
}

/** Chat API response */
export interface SendMessageResponse {
  message_id: string;
  session_id: string;
  content: string;
  expert?: MessageExpert;
  artifacts?: MessageArtifactRef[];
  components?: InlineComponent[];
  thinking?: string;
  tools_used?: string[];
  hallucination_risk?: number;
}

/** Session creation request */
export interface CreateSessionRequest {
  title?: string;
  expert_id?: string;
  workspace_id?: string;
}

/** Session creation response */
export interface CreateSessionResponse {
  session: ChatSession;
}

/** Sessions list response */
export interface SessionsListResponse {
  sessions: ChatSession[];
  total: number;
}

/** Messages list response */
export interface MessagesListResponse {
  messages: ChatMessage[];
  total: number;
}
