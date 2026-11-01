import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { PGlite } from '@electric-sql/pglite';
export type Row = Record<string, any>;
export type Query = (sql: string, values?: any[]) => Promise<Row[]>;
export interface Database { query: Query; transaction<T>(fn: (query: Query) => Promise<T>): Promise<T>; close(): Promise<void> }
export async function database(url?: string, directory?: string): Promise<Database> {
  const schema = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
  if (url) {
    const pool = new Pool({ connectionString: url, max: 12, connectionTimeoutMillis: 5000, idleTimeoutMillis: 30000 });
    await pool.query(schema);
    return {
      query: async (sql, values) => (await pool.query(sql, values)).rows,
      transaction: async fn => { const client = await pool.connect(); try { await client.query('BEGIN'); const value = await fn(async (sql, values) => (await client.query(sql, values)).rows); await client.query('COMMIT'); return value; } catch(e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); } },
      close: () => pool.end()
    };
  }
  const db = new PGlite(directory); await db.exec(schema);
  // PGlite has one connection. Serialize whole transactions, not individual queries.
  let tail: Promise<unknown> = Promise.resolve();
  function serial<T>(fn: () => Promise<T>): Promise<T> { const p = tail.then(fn, fn); tail = p.catch(() => {}); return p; }
  return { query: (sql, values) => serial(async () => (await db.query<Row>(sql, values)).rows),
    transaction: fn => serial(() => db.transaction(async tx => fn(async (sql, values) => (await tx.query<Row>(sql, values)).rows))), close: () => db.close() };
}
