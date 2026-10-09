import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { createApp } from '../src/app';
import { createDb, schema } from '../src/db/client';
import { runMigrations } from '../src/db/migrate';
import { runSeed } from '../src/db/seed';
import { SEMANAS_AUSENTES_POR_UNIDADE, TOTAL_SEMANAS, UNIDADES } from '../src/db/seed-data';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('Defina DATABASE_URL apontando para um Postgres de TESTE.');

// Trava de segurança: este arquivo APAGA o schema. Só roda em banco cujo nome contém "test".
if (!/\/[^/?]*test[^/?]*(\?|$)/.test(url)) {
  throw new Error('Recusado: DATABASE_URL deve apontar para um banco de teste (nome com "test").');
}

const { db, close } = createDb(url);
const app = createApp(db);

beforeAll(async () => {
  // começa de um schema limpo para provar que as migrations aplicam do zero
  await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`);
  await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
  await db.execute(sql`CREATE SCHEMA public`);
  await runMigrations(url);
  await runSeed(db);
});

afterAll(async () => {
  await close();
});

async function contar(tabela: 'unidade' | 'lancamento_semanal'): Promise<number> {
  const r = await db.execute<{ n: number }>(sql.raw(`SELECT count(*)::int AS n FROM ${tabela}`));
  return r.rows[0]?.n ?? -1;
}

describe('API + Postgres real', () => {
  it('GET /api/health responde ok', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('GET /api/unidades devolve as 6 unidades do seed', async () => {
    const res = await app.request('/api/unidades');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { unidades: { nome: string; ativa: boolean }[] };
    expect(body.unidades.map((u) => u.nome)).toEqual([...UNIDADES]);
    expect(body.unidades.every((u) => u.ativa)).toBe(true);
  });

  it('seed é idempotente: rodar de novo não duplica nada', async () => {
    await runSeed(db);
    expect(await contar('unidade')).toBe(6);
    expect(await contar('lancamento_semanal')).toBe(
      UNIDADES.length * (TOTAL_SEMANAS - SEMANAS_AUSENTES_POR_UNIDADE) * 4,
    );
  });

  it('o banco impede lançamento duplicado (UNIQUE) e semana que não é segunda', async () => {
    const [u] = await db.select().from(schema.unidade).limit(1);
    const [i] = await db.select().from(schema.indicador).limit(1);
    const base = { unidadeId: u!.id, indicadorId: i!.id, valor: '1' };
    // pega uma semana ausente para inserir limpo e depois duplicar
    await db.insert(schema.lancamentoSemanal).values({ ...base, semanaInicio: '2030-01-07' });
    await expect(
      db.insert(schema.lancamentoSemanal).values({ ...base, semanaInicio: '2030-01-07' }),
    ).rejects.toThrow();
    await expect(
      db.insert(schema.lancamentoSemanal).values({ ...base, semanaInicio: '2030-01-08' }),
    ).rejects.toThrow();
  });
});
