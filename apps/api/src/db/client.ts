/**
 * Único arquivo que conhece o driver do Postgres.
 * Local e CI usam `node-postgres` (pg). Em produção o plano é trocar por um driver serverless
 * (ex.: @neondatabase/serverless) mexendo só aqui; o resto do código usa `Db`.
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';

export type Db = ReturnType<typeof createDb>['db'];

export function createDb(connectionString: string) {
  const pool = new pg.Pool({ connectionString, max: 10 });
  const db = drizzle(pool, { schema });
  return { db, close: () => pool.end() };
}

export { schema };
