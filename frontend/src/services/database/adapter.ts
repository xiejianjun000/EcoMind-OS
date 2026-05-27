/**
 * 数据库适配器接口 — Abstract Adapter Pattern
 *
 * 每种国产数据库实现此接口, 上层业务代码无需关心底层差异。
 */

import type {
  DatabaseConfig,
  QueryResult,
  Transaction,
  DatabaseHealth,
  DatabaseProvider,
  TableInfo,
  ScheduledJob,
} from './types';

/** 数据库适配器抽象接口 */
export interface DatabaseAdapter {
  /** 适配器标识 */
  readonly provider: DatabaseProvider;

  /** 建立连接 */
  connect(config: DatabaseConfig): Promise<void>;

  /** 断开连接 */
  disconnect(): Promise<void>;

  /** 连接状态 */
  isConnected(): boolean;

  /** 执行查询 */
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<QueryResult<T>>;

  /** 执行更新 (INSERT/UPDATE/DELETE) */
  execute(sql: string, params?: unknown[]): Promise<QueryResult>;

  /** 批量执行 */
  batch(statements: Array<{ sql: string; params?: unknown[] }>): Promise<QueryResult[]>;

  /** 开启事务 */
  beginTransaction(): Promise<Transaction>;

  /** 获取所有表 */
  listTables(): Promise<TableInfo[]>;

  /** 获取表结构 */
  describeTable(tableName: string): Promise<TableInfo>;

  /** 健康检查 */
  healthCheck(): Promise<DatabaseHealth>;

  /** 获取适配器版本和能力 */
  getCapabilities(): DatabaseCapabilities;
}

/** 数据库能力声明 */
export interface DatabaseCapabilities {
  /** 支持 JSONB 类型 */
  jsonb: boolean;
  /** 支持全文搜索 */
  fullTextSearch: boolean;
  /** 支持向量存储 */
  vector: boolean;
  /** 支持国密加密 */
  sm4: boolean;
  /** 支持定时任务 */
  scheduledJobs: boolean;
  /** 支持物化视图 */
  materializedViews: boolean;
  /** 支持分区表 */
  partitioning: boolean;
  /** 最大连接数 */
  maxConnections: number;
  /** SQL 方言 (用于 SQL 生成器) */
  dialect: 'mysql' | 'postgresql' | 'oracle' | 'sqlite';
}

// ============================================================
// 基础适配器实现 (共享逻辑)
// ============================================================

export abstract class BaseDatabaseAdapter implements DatabaseAdapter {
  abstract readonly provider: DatabaseProvider;
  protected connected = false;
  protected config: DatabaseConfig | null = null;
  protected queryCount = 0;
  protected totalQueryTime = 0;

  isConnected(): boolean {
    return this.connected;
  }

  abstract connect(config: DatabaseConfig): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract query<T>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  abstract execute(sql: string, params?: unknown[]): Promise<QueryResult>;
  abstract beginTransaction(): Promise<Transaction>;
  abstract listTables(): Promise<TableInfo[]>;
  abstract describeTable(tableName: string): Promise<TableInfo>;
  abstract healthCheck(): Promise<DatabaseHealth>;
  abstract getCapabilities(): DatabaseCapabilities;

  async batch(
    statements: Array<{ sql: string; params?: unknown[] }>
  ): Promise<QueryResult[]> {
    const results: QueryResult[] = [];
    for (const stmt of statements) {
      results.push(await this.execute(stmt.sql, stmt.params));
    }
    return results;
  }

  /** 记录查询统计 */
  protected trackQuery(elapsedMs: number): void {
    this.queryCount++;
    this.totalQueryTime += elapsedMs;
  }

  /** 确保已连接 */
  protected ensureConnected(): void {
    if (!this.connected) {
      throw new Error(`[${this.provider}] 数据库未连接`);
    }
  }
}
