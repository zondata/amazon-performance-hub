import { Pool, type PoolClient, type QueryResultRow } from "pg";
import type { RuntimeConfig } from "./config";

export type ReadOnlyDb = {
  queryRows<T extends QueryResultRow>(text: string, values?: unknown[]): Promise<T[]>;
  close(): Promise<void>;
};

const READ_ONLY_BOOTSTRAP_SQL = [
  "begin read only",
  "set local statement_timeout = '5000ms'",
  "set local idle_in_transaction_session_timeout = '5000ms'",
].join(";");

export const createReadOnlyDb = (config: RuntimeConfig): ReadOnlyDb => {
  const pool = new Pool({
    connectionString: config.databaseUrl,
    max: 5,
    allowExitOnIdle: true,
  });

  const withClient = async <T>(fn: (client: PoolClient) => Promise<T>): Promise<T> => {
    const client = await pool.connect();
    try {
      await client.query(READ_ONLY_BOOTSTRAP_SQL);
      const result = await fn(client);
      await client.query("commit");
      return result;
    } catch (error) {
      try {
        await client.query("rollback");
      } catch {
        // Ignore rollback failures and preserve the original error.
      }
      throw error;
    } finally {
      client.release();
    }
  };

  return {
    async queryRows<T extends QueryResultRow>(text: string, values: unknown[] = []): Promise<T[]> {
      return withClient(async (client) => {
        const result = await client.query<T>(text, values);
        return result.rows;
      });
    },
    async close(): Promise<void> {
      await pool.end();
    },
  };
};
