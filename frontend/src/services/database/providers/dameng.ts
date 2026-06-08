/**
 * 达梦 DM8 适配器
 *
 * 武汉达梦数据库股份有限公司 — 国产数据库市场份额第一。
 * 
 * 特点:
 *   - Oracle 兼容模式, 支持 PL/SQL
 *   - 支持行列混合存储 (HUGE TABLE)
 *   - 支持 MPP 分布式集群
 *   - 客户端: dmPython / JDBC / ODBC / dm-dialect
 *
 * JDBC URL: jdbc:dm://host:5236/ECOMIND
 * 默认端口: 5236
 * 默认用户: SYSDBA
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

// ─── 达梦适配器 ───

export class DamengAdapter extends BaseDatabaseAdapter implements DatabaseAdapter {
  readonly provider: DatabaseProvider = 'dameng';

  async connect(config: DatabaseConfig): Promise<void> {
    this.config = config;

    // 实际部署时使用 dmPython:
    // import dmPython
    // this._conn = dmPython.connect(
    //   user=config.username,
    //   password=config.password,
    //   server=config.host,
    //   port=config.port,
    //   database=config.database,
    // )

    console.log(`[达梦 DM8] 已连接: ${config.host}:${config.port}/${config.database}`);
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    console.log('[达梦 DM8] 已断开');
  }

  async query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<QueryResult<T>> {
    this.ensureConnected();
    console.log(`[达梦] 查询: ${sql.substring(0, 100)}`);

    // Mock: 返回空结果
    return { rows: [] as T[], rowCount: 0, elapsedMs: 0 };
  }

  async execute(sql: string, params?: unknown[]): Promise<QueryResult> {
    this.ensureConnected();
    console.log(`[达梦] 执行: ${sql.substring(0, 100)}`);
    return { rows: [], rowCount: 0, elapsedMs: 0 };
  }

  async beginTransaction(): Promise<Transaction> {
    this.ensureConnected();
    // 达梦事务: conn.begin() / conn.commit() / conn.rollback()
    return {
      query: async <T>(sql: string, params?: unknown[]) => {
        return this.query<T>(sql, params);
      },
      commit: async () => {
        console.log('[达梦] 事务提交');
      },
      rollback: async () => {
        console.log('[达梦] 事务回滚');
      },
    };
  }

  async listTables(): Promise<TableInfo[]> {
    const result = await this.query<{ TABLE_NAME: string }>(
      "SELECT TABLE_NAME FROM USER_TABLES"
    );
    return result.rows.map((r) => ({
      name: r.TABLE_NAME,
      schema: 'ECOMIND',
      rowCount: 0,
      sizeBytes: 0,
      columns: [],
    }));
  }

  async describeTable(tableName: string): Promise<TableInfo> {
    return {
      name: tableName,
      schema: 'ECOMIND',
      rowCount: 0,
      sizeBytes: 0,
      columns: [],
    };
  }

  async healthCheck(): Promise<DatabaseHealth> {
    const start = Date.now();
    try {
      const result = await this.query<{ BANNER: string }>(
        "SELECT BANNER FROM V$VERSION WHERE ROWNUM = 1"
      );
      return {
        provider: 'dameng',
        connected: true,
        version: result.rows[0]?.BANNER || 'DM8',
        uptime: Date.now() - start,
        activeConnections: 1,
        totalQueries: this.queryCount,
        avgQueryTime: this.queryCount > 0 ? this.totalQueryTime / this.queryCount : 0,
      };
    } catch (e: any) {
      return {
        provider: 'dameng',
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
      jsonb: true,        // DM8 支持 JSON 类型
      fullTextSearch: true, // 支持全文索引 (CTXCAT)
      vector: false,       // 不支持原生向量 (需扩展)
      sm4: false,          // 达梦使用国密 SM2/SM3/SM4, 但需额外配置
      scheduledJobs: true, // 支持定时任务 (DBMS_JOB)
      materializedViews: true,
      partitioning: true,  // 支持水平/垂直分区
      maxConnections: 2000,
      dialect: 'oracle',   // 达梦兼容 Oracle 语法
    };
  }

}

export default DamengAdapter;
