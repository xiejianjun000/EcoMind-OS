/**
 * 国产数据库统一入口 — Factory + Singleton
 *
 * 使用方式:
 *   import { getDatabase } from '@/services/database';
 *   const db = getDatabase('opengauss');
 *   await db.connect({ host: '...', port: 5432, ... });
 *   const result = await db.query('SELECT * FROM audit_logs');
 */

import type { DatabaseProvider } from './types';
import type { DatabaseAdapter } from './adapter';
import { DamengAdapter } from './providers/dameng';
import { KingbaseAdapter } from './providers/kingbase';
import { OpenGaussAdapter } from './providers/opengauss';

// ─── 适配器注册表 ───

const adapterRegistry = new Map<DatabaseProvider, () => DatabaseAdapter>();
adapterRegistry.set('dameng', () => new DamengAdapter());
adapterRegistry.set('kingbase', () => new KingbaseAdapter());
adapterRegistry.set('opengauss', () => new OpenGaussAdapter());
adapterRegistry.set('postgresql', () => new KingbaseAdapter()); // PG 降级
// 'sqlite' 仅本地开发 (非国产化场景)

/** 注册自定义适配器 (扩展使用) */
export function registerAdapter(
  provider: DatabaseProvider,
  factory: () => DatabaseAdapter
): void {
  adapterRegistry.set(provider, factory);
}

// ─── 单例缓存 ───

const instanceCache = new Map<DatabaseProvider, DatabaseAdapter>();

/** 获取数据库实例 (单例模式) */
export function getDatabase(provider: DatabaseProvider): DatabaseAdapter {
  if (!instanceCache.has(provider)) {
    const factory = adapterRegistry.get(provider);
    if (!factory) {
      throw new Error(`[数据库] 不支持的数据库类型: ${provider}`);
    }
    instanceCache.set(provider, factory());
  }
  return instanceCache.get(provider)!;
}

/** 释放所有数据库连接 */
export async function disconnectAll(): Promise<void> {
  for (const [provider, instance] of instanceCache.entries()) {
    try {
      await instance.disconnect();
    } catch (e) {
      console.warn(`[数据库] 断开 ${provider} 失败:`, e);
    }
  }
  instanceCache.clear();
}

/** 获取所有已注册的数据库类型 */
export function getSupportedProviders(): DatabaseProvider[] {
  return Array.from(adapterRegistry.keys());
}

/** 获取数据库能力描述 (用于 UI 展示) */
export function getProviderInfo(provider: DatabaseProvider): {
  name: string;
  vendor: string;
  port: number;
  dialect: string;
  features: string[];
} {
  const info: Record<DatabaseProvider, ReturnType<typeof getProviderInfo>> = {
    dameng: {
      name: '达梦 DM8',
      vendor: '武汉达梦数据库股份有限公司',
      port: 5236,
      dialect: 'oracle',
      features: ['Oracle 兼容', 'PL/SQL', '行列混合存储', 'MPP 集群', '定时任务'],
    },
    kingbase: {
      name: '人大金仓 KingbaseES',
      vendor: '北京人大金仓信息技术股份有限公司',
      port: 54321,
      dialect: 'postgresql',
      features: ['PostgreSQL 兼容', 'JSONB', '全文检索', 'GIS 地理信息', 'Oracle 兼容模式'],
    },
    opengauss: {
      name: 'openGauss',
      vendor: '华为开源社区',
      port: 5432,
      dialect: 'postgresql',
      features: ['NUMA 感知', 'SM4 国密', '向量引擎', 'MOT 内存表', '鲲鹏深度优化'],
    },
    postgresql: {
      name: 'PostgreSQL',
      vendor: 'PostgreSQL Global Development Group',
      port: 5432,
      dialect: 'postgresql',
      features: ['标准 SQL', 'JSONB', '扩展生态', '高可用'],
    },
    sqlite: {
      name: 'SQLite',
      vendor: 'D. Richard Hipp',
      port: 0,
      dialect: 'sqlite',
      features: ['零配置', '嵌入式', '本地开发'],
    },
  };
  return info[provider];
}

export type { DatabaseProvider } from './types';
export type { DatabaseAdapter, DatabaseCapabilities } from './adapter';
export type {
  DatabaseConfig,
  QueryResult,
  Transaction,
  DatabaseHealth,
  TableInfo,
  ColumnInfo,
} from './types';

export default { getDatabase, disconnectAll, getSupportedProviders, getProviderInfo, registerAdapter };
