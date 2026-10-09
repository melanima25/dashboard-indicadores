import { and, eq, sql } from 'drizzle-orm';
import {
  contarLinhasComErro,
  validarCsv,
  type ContextoValidacao,
  type ImportacaoResponse,
  type IndicadorRegra,
} from '@dashboard/shared';
import { schema, type Db } from '../db/client';

export type Cadastro = {
  ctx: ContextoValidacao;
  unidadeIdPorNome: Map<string, number>;
  indicadorIdPorCodigo: Map<string, number>;
};

export async function carregarIndicadores(db: Db): Promise<(IndicadorRegra & { id: number })[]> {
  const rows = await db.select().from(schema.indicador).orderBy(schema.indicador.id);
  const codigoPorId = new Map(rows.map((r) => [r.id, r.codigo]));
  return rows.map((r) => ({
    id: r.id,
    codigo: r.codigo,
    tipo: r.tipo,
    numeradorCodigo: r.numeradorId ? (codigoPorId.get(r.numeradorId) ?? null) : null,
    denominadorCodigo: r.denominadorId ? (codigoPorId.get(r.denominadorId) ?? null) : null,
  }));
}

export async function carregarCadastro(db: Db, hoje: string): Promise<Cadastro> {
  const [unidades, indicadores] = await Promise.all([
    db.select().from(schema.unidade).where(eq(schema.unidade.ativa, true)),
    carregarIndicadores(db),
  ]);
  return {
    ctx: { unidades: unidades.map((u) => u.nome), indicadores, hoje },
    unidadeIdPorNome: new Map(unidades.map((u) => [u.nome, u.id])),
    indicadorIdPorCodigo: new Map(indicadores.map((i) => [i.codigo, i.id])),
  };
}

const DIA_MS = 86_400_000;

/**
 * Valida o CSV e, se `gravar`, aplica. Regras:
 * - Arquivo com QUALQUER erro é rejeitado inteiro (nada entra no dashboard). Aceitar só parte das
 *   linhas deixaria uma taxa com numerador e sem denominador. O erro fica registrado no histórico.
 * - Reenviar a mesma unidade/semana SUBSTITUI os lançamentos anteriores, numa única transação.
 * - Prévia (`gravar = false`) faz as mesmas contas e não escreve nada.
 */
export async function processarImportacao(
  db: Db,
  args: { texto: string; arquivoNome: string; gravar: boolean; hoje: string },
): Promise<ImportacaoResponse> {
  const cad = await carregarCadastro(db, args.hoje);
  const v = validarCsv(args.texto, cad.ctx);
  const ok = v.erros.length === 0;
  const unidadeId = v.unidade ? (cad.unidadeIdPorNome.get(v.unidade) ?? null) : null;
  const semana = v.semanaInicio;

  const base = {
    arquivoNome: args.arquivoNome,
    status: ok ? ('ok' as const) : ('rejeitada' as const),
    unidade: v.unidade,
    semanaInicio: semana,
    linhasLidas: v.linhasLidas,
    linhasOk: v.linhasValidas.length,
    linhasErro: contarLinhasComErro(v.erros),
    erros: v.erros,
    avisos: v.avisos,
  };

  const contarExistentes = async (): Promise<number> => {
    if (unidadeId === null || semana === null) return 0;
    const [r] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.lancamentoSemanal)
      .where(
        and(
          eq(schema.lancamentoSemanal.unidadeId, unidadeId),
          eq(schema.lancamentoSemanal.semanaInicio, semana),
        ),
      );
    return r?.n ?? 0;
  };

  if (!args.gravar) {
    return {
      ...base,
      modo: 'previa',
      inseridos: ok ? v.linhasValidas.length : 0,
      substituidos: ok ? await contarExistentes() : 0,
      importacaoId: null,
    };
  }

  // Sem unidade/semana identificadas não há onde registrar a tentativa: devolve só o relatório.
  if (unidadeId === null || semana === null) {
    return { ...base, modo: 'gravado', inseridos: 0, substituidos: 0, importacaoId: null };
  }

  return db.transaction(async (tx) => {
    // Dois envios simultâneos da mesma unidade/semana esperam um ao outro (sem violar o UNIQUE).
    const dias = Math.floor(Date.parse(`${semana}T00:00:00Z`) / DIA_MS);
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${unidadeId}::int, ${dias}::int)`);

    const [imp] = await tx
      .insert(schema.importacao)
      .values({
        arquivoNome: args.arquivoNome,
        unidadeId,
        semanaInicio: semana,
        linhasOk: base.linhasOk,
        linhasErro: base.linhasErro,
        status: base.status,
      })
      .returning({ id: schema.importacao.id });
    if (!imp) throw new Error('Falha ao registrar a importação');

    if (v.erros.length > 0) {
      await tx.insert(schema.erroImportacao).values(
        v.erros.map((e) => ({
          importacaoId: imp.id,
          linha: e.linha,
          campo: e.campo,
          mensagem: e.mensagem,
        })),
      );
    }

    let substituidos = 0;
    if (ok) {
      const apagados = await tx
        .delete(schema.lancamentoSemanal)
        .where(
          and(
            eq(schema.lancamentoSemanal.unidadeId, unidadeId),
            eq(schema.lancamentoSemanal.semanaInicio, semana),
          ),
        )
        .returning({ id: schema.lancamentoSemanal.id });
      substituidos = apagados.length;
      await tx.insert(schema.lancamentoSemanal).values(
        v.linhasValidas.map((l) => ({
          unidadeId,
          indicadorId: cad.indicadorIdPorCodigo.get(l.indicador)!,
          semanaInicio: semana,
          valor: l.valor.toFixed(2),
          importacaoId: imp.id,
        })),
      );
    }

    return {
      ...base,
      modo: 'gravado' as const,
      inseridos: ok ? v.linhasValidas.length : 0,
      substituidos,
      importacaoId: imp.id,
    };
  });
}
