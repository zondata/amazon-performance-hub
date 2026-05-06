import { Pool } from "pg";

import type { QueryExecutor, QueryResultRow } from "./types.js";

export class PgQueryExecutor implements QueryExecutor {
  private readonly pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      max: 4,
      allowExitOnIdle: true,
    });
  }

  async query<T extends QueryResultRow>(text: string, values: readonly unknown[]): Promise<{ rows: T[] }> {
    return this.pool.query<T>(text, [...values]);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
