import { fileURLToPath } from 'node:url';
import { eq, sql } from 'drizzle-orm';
import { createDb, schema, type Db } from './client';
import { parseEnv } from '../env';
import { INDICADORES, UNIDADES, gerarDadosSinteticos } from './seed-data';

/**
 * Popula o banco com dados fictícios. Idempotente: apaga lançamentos e reinsere,
 * então rodar duas vezes dá exatamente o mesmo resultado (semente fixa).
 */
export async function runSeed(db: Db): Promise<{ unidades: number; lancamentos: number }> {
  const dados = gerarDadosSinteticos();

  return db.transaction(async (tx) => {
    await tx.delete(schema.erroImportacao);
    await tx.delete(schema.lancamentoSemanal);
    await tx.delete(schema.importacao);

    await tx
      .insert(schema.unidade)
      .values(UNIDADES.map((nome) => ({ nome, ativa: true })))
      .onConflictDoNothing({ target: schema.unidade.nome });

    // 1º as somas/médias, 2º as taxas (dependem dos ids das somas)
    const ordenados = [...INDICADORES].sort(
      (a, b) => Number(a.tipo === 'taxa') - Number(b.tipo === 'taxa'),
    );
    const idPorCodigo = new Map<string, number>();
    for (const ind of ordenados) {
      const numeradorId = ind.numeradorCodigo ? idPorCodigo.get(ind.numeradorCodigo) : undefined;
      const denominadorId = ind.denominadorCodigo
        ? idPorCodigo.get(ind.denominadorCodigo)
        : undefined;
      const [row] = await tx
        .insert(schema.indicador)
        .values({
          codigo: ind.codigo,
          nome: ind.nome,
          unidadeMedida: ind.unidadeMedida,
          tipo: ind.tipo,
          numeradorId: numeradorId ?? null,
          denominadorId: denominadorId ?? null,
        })
        .onConflictDoUpdate({
          target: schema.indicador.codigo,
          set: { nome: ind.nome, unidadeMedida: ind.unidadeMedida },
        })
        .returning({ id: schema.indicador.id });
      if (!row) throw new Error(`Falha ao gravar indicador ${ind.codigo}`);
      idPorCodigo.set(ind.codigo, row.id);
    }

    const unidades = await tx.select().from(schema.unidade);
    const idUnidade = new Map(unidades.map((u) => [u.nome, u.id]));

    const linhas = dados.lancamentos.map((l) => ({
      unidadeId: idUnidade.get(l.unidade)!,
      indicadorId: idPorCodigo.get(l.indicador)!,
      semanaInicio: l.semanaInicio,
      valor: l.valor.toString(),
    }));
    for (let i = 0; i < linhas.length; i += 2000) {
      await tx.insert(schema.lancamentoSemanal).values(linhas.slice(i, i + 2000));
    }

    const [{ total } = { total: 0 }] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(schema.unidade)
      .where(eq(schema.unidade.ativa, true));
    return { unidades: total, lancamentos: linhas.length };
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const env = parseEnv();
  const { db, close } = createDb(env.DATABASE_URL);
  try {
    const r = await runSeed(db);
    console.log(
      `Seed concluído: ${r.unidades} unidades, ${r.lancamentos} lançamentos (dados fictícios).`,
    );
  } finally {
    await close();
  }
}
