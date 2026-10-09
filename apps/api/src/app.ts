import { Hono } from 'hono';
import { asc } from 'drizzle-orm';
import { HealthResponseSchema, UnidadesResponseSchema } from '@dashboard/shared';
import { schema, type Db } from './db/client';

export function createApp(db: Db) {
  const app = new Hono();

  app.get('/api/health', (c) => c.json(HealthResponseSchema.parse({ status: 'ok' })));

  app.get('/api/unidades', async (c) => {
    const rows = await db
      .select({ id: schema.unidade.id, nome: schema.unidade.nome, ativa: schema.unidade.ativa })
      .from(schema.unidade)
      .orderBy(asc(schema.unidade.id));
    return c.json(UnidadesResponseSchema.parse({ unidades: rows }));
  });

  app.notFound((c) => c.json({ erro: 'Rota não encontrada' }, 404));
  app.onError((err, c) => {
    console.error(err);
    return c.json({ erro: 'Erro interno' }, 500);
  });

  return app;
}
