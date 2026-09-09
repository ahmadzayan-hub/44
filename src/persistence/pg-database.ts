import type { SqlClient, SqlDatabase } from './sql.ts';

interface PgLikeClient {
  query(text: string, params?: readonly unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  release(): void;
}

interface PgLikePool {
  query(text: string, params?: readonly unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  connect(): Promise<PgLikeClient>;
  end(): Promise<void>;
}

/**
 * Creates a SqlDatabase over the optional `pg` driver. The driver is loaded
 * lazily so the domain layer, tests and the static preview never depend on it.
 * Set DATABASE_URL to enable it; otherwise the in-memory adapters are used.
 */
export async function createPgDatabase(connectionString: string): Promise<SqlDatabase> {
  const specifier = 'pg';
  let driver: { Pool: new (config: { connectionString: string }) => PgLikePool };
  try {
    driver = await import(specifier) as typeof driver;
  } catch {
    throw new Error('PostgreSQL requested through DATABASE_URL but the optional "pg" driver is not installed. Run `npm install pg`.');
  }
  const pool = new driver.Pool({ connectionString });
  return {
    query: (text, params) => pool.query(text, params),
    async transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await fn({ query: (text, params) => client.query(text, params) });
        await client.query('COMMIT');
        return result;
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
    close: () => pool.end(),
  };
}
