/**
 * Entrada da API no Cloudflare Workers (a demo pública).
 * O app Hono é o mesmo do servidor local (`createApp`); aqui só muda de onde vêm a conexão e a chave.
 * O Hyperdrive guarda um pool de conexões com o Postgres (Neon) perto do Worker.
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import type { ExecutionContext } from 'hono';
import pg from 'pg';
import { createApp } from './app';
import { schema } from './db/client';

type Env = {
  HYPERDRIVE: { connectionString: string };
  /** Opcional. Sem ela a demo só faz prévia de importação (gravar responde 403). */
  ADMIN_KEY?: string;
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // uma conexão por requisição; o Hyperdrive faz o pool de verdade
    const pool = new pg.Pool({ connectionString: env.HYPERDRIVE.connectionString, max: 1 });
    try {
      const app = createApp(drizzle(pool, { schema }), { adminKey: env.ADMIN_KEY || undefined });
      return await app.fetch(request, env, ctx);
    } finally {
      ctx.waitUntil(pool.end());
    }
  },
};
