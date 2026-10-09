/**
 * Consolidação em SQL. As regras (quinta-feira, soma, taxa recalculada, média) estão em
 * packages/shared/src/consolidacao.ts; aqui está a MESMA conta feita pelo banco com GROUP BY.
 * O teste de integração roda as duas versões nos dados do seed e exige resultado igual.
 */
import { sql, type SQL } from 'drizzle-orm';
import type { Agregado, FiltrosConsolidacao, Granularidade } from '@dashboard/shared';
import type { Db } from '../db/client';

/** Período de uma semana: a quinta-feira é segunda + 3 dias (date + inteiro = date no Postgres). */
function periodoSql(coluna: string, g: Granularidade): SQL {
  const c = sql.raw(coluna);
  if (g === 'semanal') return sql`to_char(${c}, 'YYYY-MM-DD')`;
  if (g === 'mensal') return sql`to_char(${c} + 3, 'YYYY-MM')`;
  return sql`to_char(${c} + 3, 'YYYY')`;
}

function filtrosSql(
  f: FiltrosConsolidacao,
  semanaCol: string,
  unidadeCol: string,
  codigoCol: string,
) {
  const partes: SQL[] = [];
  if (f.de) partes.push(sql` AND (${sql.raw(semanaCol)} + 3) >= ${f.de}::date`);
  if (f.ate) partes.push(sql` AND (${sql.raw(semanaCol)} + 3) <= ${f.ate}::date`);
  if (f.unidadeId !== undefined)
    partes.push(sql` AND ${sql.raw(unidadeCol)} = ${f.unidadeId}::int`);
  if (f.indicador) partes.push(sql` AND ${sql.raw(codigoCol)} = ${f.indicador}`);
  return sql.join(partes, sql``);
}

type LinhaSoma = {
  periodo: string;
  unidade_id: number | null;
  indicador: string;
  valor_bruto: number;
  semanas_informadas: number;
};
type LinhaTaxa = {
  periodo: string;
  unidade_id: number | null;
  indicador: string;
  numerador: number;
  denominador: number;
  semanas_informadas: number;
};

export async function agregarSql(db: Db, f: FiltrosConsolidacao): Promise<Agregado[]> {
  const porUnidade = f.agrupar === 'unidade';

  // Indicadores de soma e de média: SUM ou AVG dos lançamentos do período.
  const somaMedia = await db.execute<LinhaSoma>(sql`
    SELECT ${periodoSql('l.semana_inicio', f.granularidade)} AS periodo,
           ${porUnidade ? sql`l.unidade_id` : sql`NULL::int`} AS unidade_id,
           i.codigo AS indicador,
           (CASE i.tipo WHEN 'soma' THEN SUM(l.valor) ELSE AVG(l.valor) END)::float8 AS valor_bruto,
           COUNT(*)::int AS semanas_informadas
      FROM lancamento_semanal l
      JOIN indicador i ON i.id = l.indicador_id
     WHERE i.tipo IN ('soma', 'media')
       ${filtrosSql(f, 'l.semana_inicio', 'l.unidade_id', 'i.codigo')}
     GROUP BY ${periodoSql('l.semana_inicio', f.granularidade)}, i.codigo, i.tipo
              ${porUnidade ? sql`, l.unidade_id` : sql``}
  `);

  // Indicadores de taxa: soma numerador e denominador SÓ das semanas em que os dois existem.
  // A divisão acontece depois (finalizarItens), sobre as somas, nunca sobre percentuais.
  const taxas = await db.execute<LinhaTaxa>(sql`
    SELECT ${periodoSql('n.semana_inicio', f.granularidade)} AS periodo,
           ${porUnidade ? sql`n.unidade_id` : sql`NULL::int`} AS unidade_id,
           t.codigo AS indicador,
           SUM(n.valor)::float8 AS numerador,
           SUM(d.valor)::float8 AS denominador,
           COUNT(*)::int AS semanas_informadas
      FROM indicador t
      JOIN lancamento_semanal n ON n.indicador_id = t.numerador_id
      JOIN lancamento_semanal d ON d.indicador_id = t.denominador_id
                               AND d.unidade_id = n.unidade_id
                               AND d.semana_inicio = n.semana_inicio
     WHERE t.tipo = 'taxa'
       ${filtrosSql(f, 'n.semana_inicio', 'n.unidade_id', 't.codigo')}
     GROUP BY ${periodoSql('n.semana_inicio', f.granularidade)}, t.codigo
              ${porUnidade ? sql`, n.unidade_id` : sql``}
  `);

  return [
    ...somaMedia.rows.map((r): Agregado => ({
      periodo: r.periodo,
      unidadeId: r.unidade_id,
      indicador: r.indicador,
      valorBruto: r.valor_bruto,
      numerador: null,
      denominador: null,
      semanasInformadas: r.semanas_informadas,
    })),
    ...taxas.rows.map((r): Agregado => ({
      periodo: r.periodo,
      unidadeId: r.unidade_id,
      indicador: r.indicador,
      valorBruto: null,
      numerador: r.numerador,
      denominador: r.denominador,
      semanasInformadas: r.semanas_informadas,
    })),
  ];
}

/** Lançamentos crus (datas como texto) — usado pelo teste de equivalência e pelas pendências. */
export async function carregarLancamentos(db: Db, de?: string, ate?: string) {
  const r = await db.execute<{
    unidade_id: number;
    semana: string;
    indicador: string;
    valor: number;
  }>(sql`
    SELECT l.unidade_id, to_char(l.semana_inicio, 'YYYY-MM-DD') AS semana,
           i.codigo AS indicador, l.valor::float8 AS valor
      FROM lancamento_semanal l JOIN indicador i ON i.id = l.indicador_id
     WHERE TRUE
       ${de ? sql` AND l.semana_inicio >= ${de}::date` : sql``}
       ${ate ? sql` AND l.semana_inicio <= ${ate}::date` : sql``}
  `);
  return r.rows.map((x) => ({
    unidadeId: x.unidade_id,
    semanaInicio: x.semana,
    indicador: x.indicador,
    valor: x.valor,
  }));
}

export async function limitesDosDados(
  db: Db,
): Promise<{ primeira: string; ultima: string } | null> {
  const r = await db.execute<{ primeira: string | null; ultima: string | null }>(sql`
    SELECT to_char(MIN(semana_inicio), 'YYYY-MM-DD') AS primeira,
           to_char(MAX(semana_inicio), 'YYYY-MM-DD') AS ultima
      FROM lancamento_semanal
  `);
  const row = r.rows[0];
  return row?.primeira && row.ultima ? { primeira: row.primeira, ultima: row.ultima } : null;
}

/** Períodos que têm ao menos um lançamento, do mais recente para o mais antigo. */
export async function periodosComDados(db: Db, g: Granularidade): Promise<string[]> {
  const r = await db.execute<{ periodo: string }>(sql`
    SELECT DISTINCT ${periodoSql('semana_inicio', g)} AS periodo
      FROM lancamento_semanal
     ORDER BY periodo DESC
  `);
  return r.rows.map((x) => x.periodo);
}
