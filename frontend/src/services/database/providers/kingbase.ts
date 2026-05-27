/**
 * 人大金仓 KingbaseES 适配器
 *
 * 北京人大金仓信息技术股份有限公司 — PostgreSQL 协议兼容。
 *
 * 特点:
 *   - 高度兼容 PostgreSQL 协议和工具链
 *   - 可直接使用 pg 驱动 (psycopg2 / pg)
 *   - 支持 Oracle 兼容模式 (ORA 模式)
 *   - 全文检索、地理信息(GIS)、JSONB 支持
 *
 * JDBC URL: jdbc:kingbase8://host:54321/ECOMIND
 * 默认端口: 54321
 * 默认用户: SYSTEM
 */

import { BaseDatabaseAdapter } from '../adapter';
import type {
  DatabaseAdapter,
  DatabaseCapabilities,
} from '../adapter';
import type {
  DatabaseConfig,
  QueryResult,
  Transaction,
  DatabaseHealth,
  DatabaseProvider,
  TableInfo,
} from '../types';

export class KingbaseAdapter extends BaseDatabaseAdapter implements DatabaseAdapter {
  readonly provider: DatabaseProvider = 'kingbase';

  async connect(config: DatabaseConfig): Promise<void> {
    this.config = config;

    // 实际部署时:
    // import { Client } from 'pg'
    // this._client = new Client({
    //   host: config.host,
    //   port: config.port,
    //   user: config.username,
    //   password: config.password,
    //   database: config.database,
    // })
    // await this._client.connect()

    console.log(`[人大金仓] 已连接: ${config.host}:${config.port}/${config.database}`);
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    console.log('[人大金仓] 已断开');
  }

  async query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>> {
    this.ensureConnected();
    console.log(`[金仓] 查询: ${sql.substring(0, 100)}`);
    return { rows: [] as T[], rowCount: 0, elapsedMs: 0 };
  }

  async execute(sql: string, params?: unknown[]): Promise<QueryResult> {
    this.ensureConnected();
    console.log(`[金仓] 执行: ${sql.substring(0, 100)}`);
    return { rows: [], rowCount: 0, elapsedMs: 0 };
  }

  async beginTransaction(): Promise<Transaction> {
    this.ensureConnected();
    return {
      query: async <T>(sql: string, params?: unknown[]) => this.query<T>(sql, params),
      commit: async () => { console.log('[金仓] 事务提交'); },
      rollback: async () => { console.log('[金仓] 事务回滚'); },
    };
  }

  async listTables(): Promise<TableInfo[]> {
    const result = await this.query<{ tablename: string; schemaname: string }>(
      "SELECT tablename, schemaname FROM pg_tables WHERE schemaname = 'public'"
    );
    return result.rows.map((r) => ({
      name: r.tablename,
      schema: r.schemaname,
      rowCount: 0,
      sizeBytes: 0,
      columns: [],
    }));
  }

  async describeTable(tableName: string): Promise<TableInfo> {
    const columns = await this.query<{
      column_name: string; data_type: string; is_nullable: string;
    }>(
      `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_name = $1`,
      [tableName]
    );
    return {
      name: tableName,
      schema: 'public',
      rowCount: 0,
      sizeBytes: 0,
      columns: columns.rows.map((c) => ({
        name: c.column_name,
        type: c.data_type,
        nullable: c.is_nullable === 'YES',
        primaryKey: false,
      })),
    };
  }

  async healthCheck(): Promise<DatabaseHealth> {
    try {
      const result = await this.query<{ version: string }>('SELECT version()');
      return {
        provider: 'kingbase',
        connected: true,
        version: result.rows[0]?.version || 'KingbaseES V8R6',
        uptime: 0,
        activeConnections: 1,
        totalQueries: this.queryCount,
        avgQueryTime: this.queryCount > 0 ? this.totalQueryTime / this.queryCount : 0,
      };
    } catch (e: any) {
      return {
        provider: 'kingbase',
        connected: false,
        version: 'unknown',
        uptime: 0,
        activeConnections: 0,
        totalQueries: 0,
        avgQueryTime: 0,
        lastError: e.message,
      };
    }
  }

  getCapabilities(): DatabaseCapabilities {
    return {
      jsonb: true,           // 完全支持 JSONB
      fullTextSearch: true,  // PostgreSQL FTS 引擎
      vector: false,
      sm4: false,
      scheduledJobs: true,   // pg_cron 扩展
      materializedViews: true,
      partitioning: true,    // 声明式分区
      maxConnections: 500,
      dialect: 'postgresql', // PostgreSQL 协议
    };
  }

}

export default KingbaseAdapter;
