/**
 * 本地资料库服务 — 对接后端文件扫描与分类 API
 */

export interface KnowledgeFile {
  name: string;
  path: string;
  size: number;
  size_display: string;
  extension: string;
  category: string;
  category_name: string;
  icon: string;
  modified: string;
}

export interface KnowledgeCategory {
  id: string;
  name: string;
  icon: string;
  count: number;
  files: KnowledgeFile[];
}

export interface KnowledgeScanResult {
  scanned_dirs: string[];
  total_files: number;
  categories: KnowledgeCategory[];
}

let scanCache: KnowledgeScanResult | null = null;
let scanCacheTime = 0;
const CACHE_TTL = 60_000; // 1 min

/**
 * 扫描本地资料库，返回分类文件列表
 */
export async function scanKnowledgeBase(dirs?: string[]): Promise<KnowledgeScanResult> {
  const now = Date.now();
  if (scanCache && (now - scanCacheTime) < CACHE_TTL) {
    return scanCache;
  }

  const params = dirs?.length ? `?dirs=${encodeURIComponent(dirs.join(','))}` : '';
  const resp = await fetch(`/api/knowledge/scan${params}`);
  if (!resp.ok) throw new Error(`扫描失败: HTTP ${resp.status}`);
  const json = await resp.json();
  if (json.code === 200 && json.data) {
    scanCache = json.data;
    scanCacheTime = now;
    return json.data;
  }
  throw new Error('扫描返回数据异常');
}

/**
 * 获取资料库配置（扫描目录）
 */
export async function getKnowledgeConfig(): Promise<{ default_scan_dirs: string[]; current_scan_dirs: string[] }> {
  const resp = await fetch('/api/knowledge/config');
  const json = await resp.json();
  return json.data;
}

/**
 * 清除缓存（强制重新扫描）
 */
export function clearKnowledgeCache() {
  scanCache = null;
  scanCacheTime = 0;
}

// ─── 文件内容读取 ───

export interface FileContentResult {
  name: string;
  path: string;
  size: number;
  size_display: string;
  extension: string;
  readable: boolean;
  content?: string;
  truncated?: boolean;
  reason?: string;
  note?: string;
}

/**
 * 读取本地文件内容（仅文本文件）
 */
export async function readKnowledgeFile(filepath: string): Promise<FileContentResult> {
  const resp = await fetch(`/api/knowledge/file?path=${encodeURIComponent(filepath)}`);
  const json = await resp.json();
  if (json.code === 200) return json.data;
  throw new Error(json.data?.error || '文件读取失败');
}

// ─── 搜索 ───

export interface SearchResultFile extends KnowledgeFile {
  score: number;
  match_category: string;
}

/**
 * 按关键词搜索资料库文件
 */
export async function searchKnowledgeFiles(query: string): Promise<SearchResultFile[]> {
  const resp = await fetch(`/api/knowledge/search?q=${encodeURIComponent(query)}`);
  const json = await resp.json();
  if (json.code === 200) return json.data || [];
  return [];
}

// ─── 摘要 ───

/**
 * 获取资料库摘要（供 system prompt 使用）
 */
export async function getKnowledgeSummary(): Promise<string> {
  try {
    const resp = await fetch('/api/knowledge/summary');
    const json = await resp.json();
    return json.data || '';
  } catch {
    return '';
  }
}
