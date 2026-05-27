/**
 * 国产数据库适配层 — 类型定义
 *
 * 支持:
 *   - 达梦 DM8 (武汉达梦)
 *   - 人大金仓 KingbaseES (北京金仓)
 *   - openGauss (华为开源)
 *   - PostgreSQL (降级)
 *   - SQLite (本地开发)
 */

/** 支持的数据库类型 */
export type DatabaseProvider = 'dameng' | 'kingbase' | 'opengauss' | 'postgresql' | 'sqlite';

/** 数据库连接配置 */
export interface DatabaseConfig {
  /** 数据库类型 */
  provider: DatabaseProvider;
  /** 主机地址 */
  host: string;
  /** 端口 */
  port: number;
  /** 数据库名 */
  database: string;
  /** 用户名 */
  username: string;
  /** 密码 */
  password: string;
  /** 额外参数 */
  params?: Record<string, string>;
  /** 连接池大小 */
  poolSize?: number;
  /** 连接超时(ms) */
  connectTimeout?: number;
  /** 启用 SSL */
  ssl?: boolean;
  /** 启用 SM4 国密加密 (openGauss) */
  enableSM4?: boolean;
}

/** SQL 查询结果 */
export interface QueryResult<T = Record<string, unknown>> {
  /** 结果行 */
  rows: T[];
  /** 行数 */
  rowCount: number;
  /** 字段信息 */
  fields?: { name: string; type: string }[];
  /** 执行耗时(ms) */
  elapsedMs: number;
}

/** 事务上下文 */
export interface Transaction {
  /** 执行 SQL */
  query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<QueryResult<T>>;
  /** 提交 */
  commit: () => Promise<void>;
  /** 回滚 */
  rollback: () => Promise<void>;
}

/** 数据库健康检查 */
export interface DatabaseHealth {
  provider: DatabaseProvider;
  connected: boolean;
  version: string;
  uptime: number;
  activeConnections: number;
  totalQueries: number;
  avgQueryTime: number;
  lastError?: string;
}

/** 表结构信息 */
export interface TableInfo {
  name: string;
  schema: string;
  rowCount: number;
  sizeBytes: number;
  columns: ColumnInfo[];
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  defaultValue?: string;
}

/** 定时任务/物化视图 (达梦特有) */
export interface ScheduledJob {
  name: string;
  schedule: string;
  lastRun: string;
  nextRun: string;
  status: 'running' | 'idle' | 'failed';
}
