/**
 * DeepSeek API 集成服务 — v6.5
 *
 * 支持:
 *   - 标准对话 (chat completion)
 *   - 流式对话 (streaming SSE)
 *   - 多模型切换 (deepseek-chat / deepseek-reasoner)
 *   - 智能体角色系统提示词注入
 *
 * API 文档: https://platform.deepseek.com/api-docs
 */

import { getActiveApiKey, getActiveBaseUrl, getActiveModel, hasRealModel } from './modelConfig';

// 开发环境使用 Vite 代理避免 CORS，生产环境直连
const isDev = import.meta.env.DEV;

/** 获取当前有效的 API Key (浏览器配置 > .env) */
function getApiKey(): string { return getActiveApiKey(); }
function getBaseUrl(): string { return getActiveBaseUrl(); }
function getModel(): string { return getActiveModel(); }

// ─── 模型配置 ───

export type DeepSeekModel = 'deepseek-chat' | 'deepseek-reasoner';

export const MODEL_CONFIGS: Record<DeepSeekModel, { name: string; maxTokens: number; description: string }> = {
  'deepseek-chat': {
    name: 'DeepSeek-V3',
    maxTokens: 8192,
    description: '通用对话模型，快速响应',
  },
  'deepseek-reasoner': {
    name: 'DeepSeek-R1',
    maxTokens: 8192,
    description: '深度推理模型，复杂分析',
  },
};

// ─── 类型定义 ───

interface DeepSeekMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface DeepSeekRequest {
  model: DeepSeekModel;
  messages: DeepSeekMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
}

interface DeepSeekChoice {
  index: number;
  message: { role: string; content: string };
  finish_reason: string;
}

interface DeepSeekResponse {
  id: string;
  model: string;
  choices: DeepSeekChoice[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ─── 系统提示词 ───

/** 根据智能体角色生成系统提示词 */
function buildSystemPrompt(expertId?: string, expertName?: string): string {
  const basePrompt = `你是 EcoMind OS 生态环境智能助手。`;

  const rolePrompts: Record<string, string> = {
    gaia: `${basePrompt}
你是 GAIA 生态主控，EcoMind OS 的核心协调智能体。
职责：
- 协调 12 个领域专家 Agent 协作
- 回答生态环境法规、政策、标准相关咨询
- 根据用户需求自动分派任务到最合适的专家
- 提供综合分析报告和建议

回复风格：专业、全面、条理清晰，使用中文。`,

    'env-monitoring': `${basePrompt}
你是环境监测专家，专注于空气质量、水质、噪声等实时监测数据分析。
职责：
- 解读实时监测数据，识别异常模式
- 进行多站点对比分析
- 生成监测报告和趋势预测
- 提供污染溯源建议

回复风格：数据驱动、精确、注重细节，使用中文。`,

    enforcement: `${basePrompt}
你是执法监察专家，专注于生态环境执法领域。
职责：
- 辅助现场巡查取证
- 违规行为判定和法律适用分析
- 处罚建议和裁量基准
- 执法文书自动生成

回复风格：严谨、依法依规、条理分明，使用中文。`,

    eia: `${basePrompt}
你是环评审批专家，专注于环境影响评价与排放管理。
职责：
- 环评报告技术审查
- 合规性校验和标准条款匹配
- 审批文书和意见生成
- OCR识别辅助

回复风格：细致、规范、逐条对照，使用中文。`,

    carbon: `${basePrompt}
你是碳排放专家，专注于碳达峰碳中和工作。
职责：
- 碳排放数据计算与核查
- 减排方案设计与评估
- 碳足迹全生命周期分析
- CCER项目评估

回复风格：数据精确、科学严谨，使用中文。`,

    emergency: `${basePrompt}
你是应急管理专家，专注于突发环境事件应急响应。
职责：
- 事件快速研判和等级评估
- 多Agent协同应急指挥
- 应急预案生成和资源调度
- 跨部门协调建议

回复风格：快速、果断、分秒必争，使用中文。`,

    water: `${basePrompt}
你是水资源专家，专注于水生态环境管理。
职责：
- 流域水质分析与评价
- 水量调度和水生态评估
- 污染溯源和扩散模拟
- 水环境治理方案建议

回复风格：科学、系统、注重流域视角，使用中文。`,
  };

  if (expertId && rolePrompts[expertId]) {
    return rolePrompts[expertId];
  }

  if (expertName) {
    return `${basePrompt}\n你正在以「${expertName}」的身份提供专业咨询服务。请根据你的专业知识，给予准确、详尽的回答。使用中文。`;
  }

  return `${basePrompt}\n请根据用户的问题，提供专业、准确的生态环境领域咨询建议。使用中文。`;
}

// ─── API 客户端 ───

/** 检查 API Key 是否已配置 */
export function isApiKeyConfigured(): boolean {
  return hasRealModel();
}

/** 获取 API Key (脱敏显示) */
export function getMaskedKey(): string {
  const key = getApiKey();
  if (!key) return '未配置';
  if (key.length <= 15) return '***';
  return key.slice(0, 5) + '***' + key.slice(-4);
}

/** 非流式对话 */
export async function chat(
  userMessage: string,
  options?: {
    expertId?: string;
    expertName?: string;
    model?: DeepSeekModel;
    temperature?: number;
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  }
): Promise<{ content: string; tokensUsed: number }> {
  if (!isApiKeyConfigured()) {
    throw new Error('DeepSeek API Key 未配置，请在 .env 中设置 VITE_DEEPSEEK_API_KEY');
  }

  const systemPrompt = buildSystemPrompt(options?.expertId, options?.expertName);

  const messages: DeepSeekMessage[] = [
    { role: 'system', content: systemPrompt },
    ...(options?.conversationHistory || []).map((m) => ({
      role: m.role,
      content: m.content,
    })),
    { role: 'user', content: userMessage },
  ];

  const response = await fetch(`${isDev ? '/deepseek' : getBaseUrl()}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model: options?.model || 'deepseek-chat',
      messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: 4096,
      stream: false,
    } satisfies DeepSeekRequest),
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({}));
    const errMsg = (errBody as any)?.error?.message || `HTTP ${response.status}`;
    throw new Error(`DeepSeek API 错误: ${errMsg}`);
  }

  const data: DeepSeekResponse = await response.json();
  return {
    content: data.choices[0]?.message?.content || '',
    tokensUsed: data.usage?.total_tokens || 0,
  };
}

/** 流式对话 — 返回 abort 函数 */
export function chatStream(
  userMessage: string,
  options: {
    expertId?: string;
    expertName?: string;
    model?: DeepSeekModel;
    temperature?: number;
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
    onChunk: (text: string) => void;
    onDone: (fullContent: string) => void;
    onError: (error: Error) => void;
  }
): () => void {
  const abortController = new AbortController();
  let fullContent = '';

  if (!isApiKeyConfigured()) {
    options.onError(new Error('DeepSeek API Key 未配置'));
    return () => {};
  }

  const systemPrompt = buildSystemPrompt(options.expertId, options.expertName);

  const messages: DeepSeekMessage[] = [
    { role: 'system', content: systemPrompt },
    ...(options.conversationHistory || []).map((m) => ({
      role: m.role,
      content: m.content,
    })),
    { role: 'user', content: userMessage },
  ];

  (async () => {
    try {
      const response = await fetch(`${isDev ? '/deepseek' : getBaseUrl()}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getApiKey()}`,
        },
        body: JSON.stringify({
          model: options.model || 'deepseek-chat',
          messages,
          temperature: options.temperature ?? 0.7,
          max_tokens: 4096,
          stream: true,
        } satisfies DeepSeekRequest),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        const errMsg = (errBody as any)?.error?.message || `HTTP ${response.status}`;
        throw new Error(`DeepSeek API 错误: ${errMsg}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法读取流式响应');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const jsonStr = trimmed.slice(6);
          if (jsonStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              fullContent += delta;
              options.onChunk(delta);
            }
          } catch {
            // 忽略解析失败的行
          }
        }
      }

      options.onDone(fullContent);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      options.onError(err instanceof Error ? err : new Error(String(err)));
    }
  })();

  return () => abortController.abort();
}

export default { chat, chatStream, isApiKeyConfigured, getMaskedKey, MODEL_CONFIGS };
