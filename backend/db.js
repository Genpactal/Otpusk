import { readFile, mkdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

export async function openDatabase({ connectionString = process.env.DATABASE_URL, memory = false } = {}) {
  let engine;
  let db;
  if (connectionString) {
    engine = new pg.Pool({ connectionString });
    db = {
      query: (sql, args) => engine.query(sql, args),
      transaction: async fn => {
        const client = await engine.connect();
        try {
          await client.query('BEGIN');
          // Serialize company leave mutations, including balance reads, across server processes.
          await client.query('SELECT pg_advisory_xact_lock(740128)');
          const value = await fn(client);
          await client.query('COMMIT');
          return value;
        } catch (error) { await client.query('ROLLBACK'); throw error; }
        finally { client.release(); }
      },
      close: () => engine.end(),
      kind: 'PostgreSQL',
    };
    await engine.query(await readFile(new URL('./schema.sql', import.meta.url), 'utf8'));
  } else {
    if (!memory) await mkdir(new URL('../.data/', import.meta.url), { recursive: true });
    engine = new PGlite(memory ? undefined : fileURLToPath(new URL('../.data/otpusk/', import.meta.url)));
    await engine.exec(await readFile(new URL('./schema.sql', import.meta.url), 'utf8'));
    db = { query: (sql, args) => engine.query(sql, args), transaction: fn => engine.transaction(fn), close: () => engine.close(), kind: 'Embedded PostgreSQL (PGlite)' };
  }
  return db;
}
