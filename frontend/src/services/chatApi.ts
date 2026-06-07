/**
 * Chat API service layer — 对话走后端 EcoAgentEngine
 */

import type {
  CreateSessionRequest, CreateSessionResponse, SessionsListResponse,
  MessagesListResponse, SendMessageResponse, StreamChunk,
} from '@/types/chat';

const API_BASE = '/api';
async function req<T>(url: string, opts?: RequestInit): Promise<T> {
  const r = await fetch(`${API_BASE}${url}`, { headers: { 'Content-Type': 'application/json' }, ...opts });
  if (!r.ok) { const e = await r.json().catch(() => ({ detail: r.statusText })); throw new Error(typeof e.detail === 'string' ? e.detail : JSON.stringify(e.detail)); }
  return r.json() as Promise<T>;
}

const SK = 'ecomind_sessions';
function ls(): SessionsListResponse { try { const r = localStorage.getItem(SK); return r ? JSON.parse(r) : { sessions: [], total: 0 }; } catch { return { sessions: [], total: 0 }; } }
function ss(d: SessionsListResponse) { localStorage.setItem(SK, JSON.stringify(d)); }

export async function createSession(p: CreateSessionRequest): Promise<CreateSessionResponse> {
  const d = ls(); const s = { id: `s-${Date.now()}`, title: p.title || '新会话', expertId: p.expert_id, expertName: undefined, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), messageCount: 0, workspaceId: p.workspace_id };
  d.sessions.unshift(s); d.total = d.sessions.length; ss(d); return { session: s };
}
export async function listSessions(): Promise<SessionsListResponse> { return ls(); }
export async function getSessionMessages(sid: string): Promise<MessagesListResponse> { try { const r = localStorage.getItem(`ecomind_msgs_${sid}`); return r ? JSON.parse(r) : { messages: [], total: 0 }; } catch { return { messages: [], total: 0 }; } }
export async function deleteSession(sid: string): Promise<void> { const d = ls(); d.sessions = d.sessions.filter(s => s.id !== sid); d.total = d.sessions.length; ss(d); localStorage.removeItem(`ecomind_msgs_${sid}`); }

export async function sendMessage(sid: string, msg: string, eid?: string): Promise<SendMessageResponse> {
  const r = await req<{ content: string; session_id: string; status: string; tools_used: string[]; iterations: number }>('/chat', { method: 'POST', body: JSON.stringify({ message: msg, expert_id: eid || 'ecomind', session_id: sid }) });
  return { message_id: `m-${Date.now()}`, session_id: r.session_id || sid, content: r.content, tools_used: r.tools_used, expert: eid ? { id: eid, name: '助手' } : undefined };
}

export type StreamCallback = (c: StreamChunk) => void;

export function sendMessageStream(sid: string, msg: string, eid: string | undefined, mid: string, on: StreamCallback, ws: WebSocket | null): () => void {
  const ac = new AbortController(); let aborted = false;
  if (ws?.readyState === WebSocket.OPEN) { ws.send(JSON.stringify({ action: 'chat', session_id: sid, message: msg, expert_id: eid, message_id: mid })); return () => {}; }
  (async () => {
    try {
      const r = await fetch('/api/chat/stream', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: msg, expert_id: eid || 'ecomind', session_id: sid, stream: true }), signal: ac.signal });
      if (!r.ok) { const e = await r.json().catch(() => ({ detail: r.statusText })); throw new Error(typeof e.detail === 'string' ? e.detail : JSON.stringify(e.detail)); }
      const rd = r.body?.getReader(); if (!rd) throw new Error('no reader');
      const d = new TextDecoder(); let b = '';
      while (true) { const { done, val } = await rd.read(); if (done || aborted) break; b += d.decode(val, { stream: true }); const ls = b.split('\n'); b = ls.pop() || ''; for (const l of ls) { if (!l.trim().startsWith('data: ')) continue; try { const p = JSON.parse(l.trim().slice(6)); if (p.type === 'text_delta') on({ type: 'chunk', sessionId: sid, messageId: mid, content: p.text }); else if (p.type === 'done') on({ type: 'done', sessionId: sid, messageId: mid, content: p.content, toolsUsed: p.tools_used }); else if (p.type === 'error') on({ type: 'error', sessionId: sid, messageId: mid, error: p.message }); } catch {} } }
    } catch (err: any) { if (err.name !== 'AbortError') on({ type: 'error', sessionId: sid, messageId: mid, error: err.message }); }
  })();
  return () => { aborted = true; ac.abort(); };
}

export async function listExperts() { try { const r = await req<{ agents: any[] }>('/agents/'); return { experts: r.agents.map((a: any) => ({ id: a.agent_id || a.id, name: a.name, role: a.role, status: a.status })) }; } catch { return { experts: [] }; } }
export async function getExpert(eid: string) { try { const r = await req<any>(`/agents/${eid}`); return { expert: { id: r.agent_id || r.id, name: r.name } }; } catch { return { expert: null }; } }
