import { sql } from 'drizzle-orm';
import { createDb } from '../src/db/client';
import { runMigrations } from '../src/db/migrate';
import { runSeed } from '../src/db/seed';

export function urlDeTeste(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Defina DATABASE_URL apontando para um Postgres de TESTE.');
  // Trava de segurança: estes testes APAGAM o schema. Só rodam em banco cujo nome contém "test".
  if (!/\/[^/?]*test[^/?]*(\?|$)/.test(url)) {
    throw new Error(
      'Recusado: DATABASE_URL deve apontar para um banco de teste (nome com "test").',
    );
  }
  return url;
}

/** Schema limpo + migrations do zero + seed. */
export async function prepararBanco(comSeed = true) {
  const url = urlDeTeste();
  const conexao = createDb(url);
  await conexao.db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`);
  await conexao.db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
  await conexao.db.execute(sql`CREATE SCHEMA public`);
  await runMigrations(url);
  if (comSeed) await runSeed(conexao.db);
  return conexao;
}

export const CAB = 'unidade;semana_inicio;indicador;valor';

/** Monta um CSV de uma unidade/semana: csv('Unidade Norte', '2024-01-08', { faltas: 3 }). */
export function csv(
  unidade: string,
  semana: string,
  valores: Record<string, number | string>,
  cabecalho = CAB,
): string {
  return [
    cabecalho,
    ...Object.entries(valores).map(([i, v]) => `${unidade};${semana};${i};${v}`),
  ].join('\n');
}

export function formulario(texto: string, nome = 'semana.csv'): FormData {
  const f = new FormData();
  f.append('arquivo', new File([texto], nome, { type: 'text/csv' }));
  return f;
}
