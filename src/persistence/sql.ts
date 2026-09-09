/**
 * Minimal SQL ports. Adapters depend on these interfaces, not on a driver,
 * so they can be unit-tested with a fake and run against PostgreSQL through
 * the optional `pg` driver.
 */
export type SqlRow = Record<string, unknown>;

export interface SqlClient {
  query(text: string, params?: readonly unknown[]): Promise<{ rows: SqlRow[] }>;
}

export interface SqlDatabase extends SqlClient {
  /** Runs fn inside BEGIN/COMMIT on one connection; rolls back on error. */
  transaction<T>(fn: (tx: SqlClient) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
