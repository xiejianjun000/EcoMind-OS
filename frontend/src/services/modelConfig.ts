/**
 * 模型配置管理 — 浏览器端 Key 热配置
 *
 * 用户在模型配置面板粘贴 API Key，无需重启即可切换真实推理。
 * Key 存储在 localStorage，优先级高于 .env 文件。
 */

const STORAGE_KEY = 'ecomind-model-config';

export interface ModelProviderConfig {
  id: string;
  name: string;
  type: 'deepseek' | 'qwen' | 'glm' | 'local';
  apiKey: string;
  baseUrl: string;
  model: string;
  enabled: boolean;
}

export interface ModelGlobalConfig {
  providers: ModelProviderConfig[];
  activeProvider: string;
  /** 本地模型 Ollama 地址 */
  ollamaUrl: string;
}

const DEFAULT_CONFIG: ModelGlobalConfig = {
  activeProvider: 'deepseek',
  ollamaUrl: 'http://localhost:11434',
  providers: [
    {
      id: 'deepseek',
      name: 'DeepSeek (云端)',
      type: 'deepseek',
      apiKey: '',
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-chat',
      enabled: false,
    },
    {
      id: 'qwen',
      name: '通义千问 (云端)',
      type: 'qwen',
      apiKey: '',
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      model: 'qwen-max',
      enabled: false,
    },
    {
      id: 'glm',
      name: '智谱 GLM (云端)',
      type: 'glm',
      apiKey: '',
      baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
      model: 'glm-4',
      enabled: false,
    },
    {
      id: 'local-ollama',
      name: 'Ollama 本地推理 (国产CPU)',
      type: 'local',
      apiKey: '',
      baseUrl: 'http://localhost:11434',
      model: 'qwen2.5:7b',
      enabled: false,
    },
  ],
};

/** 读取 .env 中的 API Key (优先于 localStorage 默认空值) */
function getEnvApiKey(): string {
  const envKey = import.meta.env.VITE_DEEPSEEK_API_KEY || '';
  if (envKey && envKey !== 'sk-请替换为你的DeepSeek_API_Key' && envKey.length > 10) {
    return envKey;
  }
  return '';
}

/** 读取配置 (localStorage 优先, 但 .env Key 总是注入) */
export function getModelConfig(): ModelGlobalConfig {
  const envKey = getEnvApiKey();

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as ModelGlobalConfig;
      // 合并: 用户手动设置的优先, 缺失的用默认值
      const config = { ...DEFAULT_CONFIG, ...saved, providers: saved.providers || DEFAULT_CONFIG.providers };
      // 关键修复: .env 中的 Key 总是注入到对应 provider (除非用户手动清空)
      if (envKey) {
        const dsProvider = config.providers.find(p => p.id === 'deepseek');
        if (dsProvider && !dsProvider.apiKey) {
          dsProvider.apiKey = envKey;
          dsProvider.enabled = true;
        }
      }
      return config;
    }
  } catch { /* ignore */ }

  // 无 localStorage 时, 直接使用 .env Key
  if (envKey) {
    const config = { ...DEFAULT_CONFIG };
    const dsProvider = config.providers.find(p => p.id === 'deepseek');
    if (dsProvider) {
      dsProvider.apiKey = envKey;
      dsProvider.enabled = true;
    }
    return config;
  }

  return DEFAULT_CONFIG;
}

/** 保存配置到 localStorage */
export function saveModelConfig(config: ModelGlobalConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

/** 获取当前激活的 Provider 配置 */
export function getActiveProvider(): ModelProviderConfig | null {
  const config = getModelConfig();
  return config.providers.find(p => p.id === config.activeProvider && p.enabled) || null;
}

/** 获取当前有效的 API Key (浏览器配置 > .env) */
export function getActiveApiKey(): string {
  const active = getActiveProvider();
  if (active?.apiKey) return active.apiKey;

  // 降级到 .env
  const envKey = getEnvApiKey();
  if (envKey) return envKey;

  return '';
}

/** 获取当前 API 地址 */
export function getActiveBaseUrl(): string {
  const active = getActiveProvider();
  return active?.baseUrl || 'https://api.deepseek.com';
}

/** 获取当前模型名称 */
export function getActiveModel(): string {
  const active = getActiveProvider();
  return active?.model || 'deepseek-chat';
}

/** 是否有可用的真实模型 */
export function hasRealModel(): boolean {
  const key = getActiveApiKey();
  return !!key && key.length > 10;
}

export default { getModelConfig, saveModelConfig, getActiveProvider, getActiveApiKey, getActiveBaseUrl, getActiveModel, hasRealModel };
