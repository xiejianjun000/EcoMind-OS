/**
 * DeepSeek Bridge Service — 统一走后端 POST /api/chat/stream
 */

import { getActiveApiKey, getActiveBaseUrl, getActiveModel, hasRealModel } from './modelConfig';

export type DeepSeekModel = 'deepseek-chat' | 'deepseek-reasoner';
export const MODEL_CONFIGS: Record<DeepSeekModel, { name: string; maxTokens: number; description: string }> = {
  'deepseek-chat': { name: 'DeepSeek-V3', maxTokens: 8192, description: '通用' },
  'deepseek-reasoner': { name: 'DeepSeek-R1', maxTokens: 8192, description: '推理' },
};

export interface EnvContext {
  city?: string; aqi?: number; level?: string;
  pm25?: number; pm10?: number; o3?: number; no2?: number; so2?: number; co?: number;
  primaryPollutant?: string; temperature?: number; humidity?: number; wind?: string; updateTime?: string;
  knowledgeSummary?: string; knowledgeFiles?: Array<{ name: string; content: string; path: string }>;
}

export function isApiKeyConfigured(): boolean { return true; }
export function getMaskedKey(): string { return '***'; }

export async function chat(msg: string, opts?: { expertId?: string; expertName?: string; model?: DeepSeekModel; temperature?: number; conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>; envContext?: EnvContext }) {
  const r = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: msg, expert_id: opts?.expertId || 'ecomind', model: opts?.model || 'deepseek-chat', temperature: opts?.temperature ?? 0.7, conversation_history: opts?.conversationHistory || [], env_context: opts?.envContext || null, stream: false }) });
  if (!r.ok) { const e = await r.json().catch(() => ({ detail: r.statusText })); throw new Error(typeof e.detail === 'string' ? e.detail : JSON.stringify(e.detail)); }
  const d = await r.json(); return { content: d.content || '', tokensUsed: 0 };
}

export interface ChatStreamOptions {
  expertId?: string; expertName?: string; model?: DeepSeekModel; temperature?: number;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>; envContext?: EnvContext;
  onChunk: (text: string) => void; onDone: (fullContent: string) => void; onError: (error: Error) => void;
  onToolCall?: (toolName: string, params: Record<string, any>, callId: string) => void;
  onToolResult?: (toolName: string, summary: string, callId: string) => void;
  onExpertMessage?: (expertId: string, expertName: string, content: string, toolsUsed: string[], duration: number) => void;
}

export function chatStream(msg: string, opts: ChatStreamOptions): () => void {
  const ac = new AbortController();
  (async () => {
    try {
      const r = await fetch('/api/chat/stream', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: msg, expert_id: opts.expertId || 'ecomind', model: opts.model || 'deepseek-chat', temperature: opts.temperature ?? 0.7, conversation_history: opts.conversationHistory || [], env_context: opts.envContext || null, stream: true }), signal: ac.signal });
      if (!r.ok) { const e = await r.json().catch(() => ({ detail: r.statusText })); throw new Error(typeof e.detail === 'string' ? e.detail : JSON.stringify(e.detail)); }
      const rd = r.body?.getReader(); if (!rd) throw new Error('no reader');
      const d = new TextDecoder(); let b = ''; let fc = '';
      console.log('[chatStream] 开始读取流...');
      while (true) { const { done, value } = await rd.read(); if (done) break; b += d.decode(value, { stream: true }); const ls = b.split('\n'); b = ls.pop() || ''; for (const l of ls) { if (!l.trim().startsWith('data: ')) continue; try { const p = JSON.parse(l.trim().slice(6)); if (p.type === 'text_delta') { fc += p.text; opts.onChunk(p.text); } else if (p.type === 'tool_call') { opts.onToolCall?.(p.name, p.params || {}, p.call_id || ''); } else if (p.type === 'tool_result') { opts.onToolResult?.(p.name, p.summary || '', p.call_id || ''); } else if (p.type === 'expert_message') { opts.onExpertMessage?.(p.expert_id, p.expert_name, p.content, p.tools_used || [], p.duration || 0); } else if (p.type === 'done') { console.log('[chatStream] done, len:', (p.content || fc).length); opts.onDone(p.content || fc); return; } else if (p.type === 'error') { opts.onError(new Error(p.message)); return; } } catch {} } }
      console.log('[chatStream] 流结束, fc长度:', fc.length);
      opts.onDone(fc);
    } catch (err: any) { if (err.name !== 'AbortError') opts.onError(err instanceof Error ? err : new Error(String(err))); }
  })();
  return () => ac.abort();
}

export default { chat, chatStream, isApiKeyConfigured, getMaskedKey, MODEL_CONFIGS };
