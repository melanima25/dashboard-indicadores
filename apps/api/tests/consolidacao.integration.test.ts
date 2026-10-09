import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import {
  agregarEmMemoria,
  chavePeriodo,
  finalizarItens,
  segundasEntre,
  somarDias,
  type ConsolidadoResponse,
  type FiltrosConsolidacao,
  type ItemConsolidado,
  type PendenciasResponse,
} from '@dashboard/shared';
import { createApp } from '../src/app';
import { schema } from '../src/db/client';
import { agregarSql, carregarLancamentos } from '../src/consolidacao/consultas';
import { carregarIndicadores } from '../src/importacao/servico';
import { gerarDadosSinteticos } from '../src/db/seed-data';
import { prepararBanco } from './helpers';

let conexao: Awaited<ReturnType<typeof prepararBanco>>;
let hoje = '2026-10-09';
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  conexao = await prepararBanco();
  app = createApp(conexao.db, { hoje: () => hoje });
});
afterAll(async () => {
  await conexao.close();
});

const get = async <T>(url: string): Promise<{ status: number; body: T }> => {
  const res = await app.request(url);
  return { status: res.status, body: (await res.json()) as T };
};

function iguais(a: ItemConsolidado[], b: ItemConsolidado[]) {
  expect(a.length).toBe(b.length);
  a.forEach((x, i) => {
    const y = b[i]!;
    expect([x.periodo, x.unidadeId, x.indicador]).toEqual([y.periodo, y.unidadeId, y.indicador]);
    expect(x.semanasInformadas).toBe(y.semanasInformadas);
    expect(x.semanasEsperadas).toBe(y.semanasEsperadas);
    for (const campo of ['valor', 'numerador', 'denominador'] as const) {
      if (x[campo] === null || y[campo] === null) expect(x[campo]).toBe(y[campo]);
      else expect(x[campo]).toBeCloseTo(y[campo], 6);
    }
  });
}

describe('o SQL e a referência em memória fazem a mesma conta (dados do seed)', () => {
  const combinacoes: FiltrosConsolidacao[] = [];
  for (const granularidade of ['semanal', 'mensal', 'anual'] as const)
    for (const agrupar of ['rede', 'unidade'] as const)
      combinacoes.push({ granularidade, agrupar });
  combinacoes.push(
    { granularidade: 'mensal', agrupar: 'rede', de: '2024-03-01', ate: '2025-06-30' },
    { granularidade: 'mensal', agrupar: 'unidade', unidadeId: 3, indicador: 'taxa_absenteismo' },
    { granularidade: 'anual', agrupar: 'rede', indicador: 'tempo_medio_espera' },
  );

  it.each(combinacoes)('%j', async (f) => {
    const indicadores = await carregarIndicadores(conexao.db);
    const lancs = await carregarLancamentos(conexao.db);
    const ctx = {
      indicadores,
      granularidade: f.granularidade,
      hoje,
      de: f.de,
      ate: f.ate,
      unidadesNaRede: f.unidadeId !== undefined ? 1 : 6,
    };
    const doSql = finalizarItens(await agregarSql(conexao.db, f), ctx);
    const emMemoria = finalizarItens(agregarEmMemoria(lancs, indicadores, f), ctx);
    expect(doSql.length).toBeGreaterThan(0);
    iguais(doSql, emMemoria);
  });
});

describe('a regra da quinta-feira no SQL = no TypeScript', () => {
  it('mês e ano de todas as segundas de 2020 a 2035', async () => {
    const r = await conexao.db.execute<{ s: string; m: string; a: string }>(sql`
      SELECT to_char(d::date, 'YYYY-MM-DD') AS s,
             to_char(d::date + 3, 'YYYY-MM') AS m,
             to_char(d::date + 3, 'YYYY') AS a
        FROM generate_series('2020-01-06'::date, '2035-12-31'::date, '7 days') AS d`);
    const esperadas = segundasEntre('2020-01-06', '2035-12-31');
    expect(r.rows.length).toBe(esperadas.length);
    for (const row of r.rows) {
      expect(row.m).toBe(chavePeriodo(row.s, 'mensal'));
      expect(row.a).toBe(chavePeriodo(row.s, 'anual'));
    }
  });
});

describe('GET /api/consolidado', () => {
  it('anual = soma dos 12 meses (faltas, rede)', async () => {
    const q = (g: string) =>
      `/api/consolidado?granularidade=${g}&indicador=faltas&de=2025-01-01&ate=2025-12-31`;
    const anual = (await get<ConsolidadoResponse>(q('anual'))).body.itens;
    const meses = (await get<ConsolidadoResponse>(q('mensal'))).body.itens;
    expect(anual).toHaveLength(1);
    expect(meses).toHaveLength(12);
    expect(anual[0]!.valor).toBeCloseTo(
      meses.reduce((s, m) => s + (m.valor ?? 0), 0),
      6,
    );
  });

  it('semana sem envio não vira zero: cobertura mostra 5 de 6 e a soma só conta quem enviou', async () => {
    const aus = gerarDadosSinteticos().semanasAusentes[0]!;
    const { body } = await get<ConsolidadoResponse>(
      `/api/consolidado?granularidade=semanal&indicador=faltas&de=${aus.semanaInicio}&ate=${somarDias(aus.semanaInicio, 6)}`,
    );
    const item = body.itens.find((i) => i.periodo === aus.semanaInicio)!;
    expect(item.semanasInformadas).toBeLessThanOrEqual(5);
    expect(item.semanasEsperadas).toBe(6);
  });

  it('validações: 400 para parâmetros ruins', async () => {
    for (const url of [
      '/api/consolidado?granularidade=diaria',
      '/api/consolidado?de=2025-12-31&ate=2025-01-01',
      '/api/consolidado?indicador=pizzas',
      '/api/consolidado?unidadeId=999',
      '/api/consolidado?de=ontem',
    ])
      expect((await get(url)).status, url).toBe(400);
  });
});

describe('caso calculado à mão (março/2025, 2 unidades ativas)', () => {
  beforeAll(async () => {
    const db = conexao.db;
    await db.delete(schema.lancamentoSemanal);
    await db.execute(sql`UPDATE unidade SET ativa = false WHERE id > 2`);
    const ind = new Map((await carregarIndicadores(db)).map((i) => [i.codigo, i.id]));
    const L = (unidadeId: number, semanaInicio: string, codigo: string, valor: number) => ({
      unidadeId,
      semanaInicio,
      indicadorId: ind.get(codigo)!,
      valor: String(valor),
    });
    await db.insert(schema.lancamentoSemanal).values([
      L(1, '2025-03-17', 'atendimentos_agendados', 10),
      L(1, '2025-03-17', 'faltas', 1),
      L(1, '2025-03-24', 'atendimentos_agendados', 100),
      L(1, '2025-03-24', 'faltas', 50),
      L(2, '2025-03-17', 'atendimentos_agendados', 20),
      L(2, '2025-03-17', 'faltas', 4),
      L(1, '2025-03-31', 'atendimentos_agendados', 40), // quinta é 03/04: entra em ABRIL
      L(1, '2025-03-31', 'faltas', 4),
      L(1, '2025-03-17', 'tempo_medio_espera', 10),
      L(1, '2025-03-24', 'tempo_medio_espera', 30),
    ]);
  });

  it('mensal (rede): soma 130, taxa 55/130 = 42,31% (não 26,7%), média de espera 20', async () => {
    const { body } = await get<ConsolidadoResponse>('/api/consolidado?granularidade=mensal');
    const m = (periodo: string, indicador: string) =>
      body.itens.find((i) => i.periodo === periodo && i.indicador === indicador)!;
    expect(m('2025-03', 'atendimentos_agendados')).toMatchObject({
      valor: 130,
      semanasInformadas: 3,
    });
    expect(m('2025-03', 'taxa_absenteismo')).toMatchObject({ numerador: 55, denominador: 130 });
    expect(m('2025-03', 'taxa_absenteismo').valor).toBeCloseTo(42.3077, 3);
    expect(m('2025-03', 'tempo_medio_espera').valor).toBe(20);
    expect(m('2025-04', 'atendimentos_agendados').valor).toBe(40);
    // 4 semanas em março × 2 unidades ativas = 8; só 3 unidade-semanas informadas
    expect(m('2025-03', 'atendimentos_agendados').semanasEsperadas).toBe(8);
    expect(body.itens.some((i) => i.periodo === '2025-02')).toBe(false);
  });

  it('por unidade: unidade 2 tem 4/20 = 20%', async () => {
    const { body } = await get<ConsolidadoResponse>(
      '/api/consolidado?granularidade=mensal&agrupar=unidade&indicador=taxa_absenteismo',
    );
    const u2 = body.itens.find((i) => i.unidadeId === 2 && i.periodo === '2025-03')!;
    expect(u2.valor).toBeCloseTo(20, 6);
    expect(u2.semanasEsperadas).toBe(4);
  });

  it('numerador sem denominador na semana: a taxa ignora essa semana inteira', async () => {
    const ind = new Map((await carregarIndicadores(conexao.db)).map((i) => [i.codigo, i.id]));
    await conexao.db.insert(schema.lancamentoSemanal).values({
      unidadeId: 2,
      semanaInicio: '2025-03-24',
      indicadorId: ind.get('faltas')!,
      valor: '999',
    });
    const { body } = await get<ConsolidadoResponse>(
      '/api/consolidado?granularidade=mensal&indicador=taxa_absenteismo',
    );
    const t = body.itens.find((i) => i.periodo === '2025-03')!;
    expect(t).toMatchObject({ numerador: 55, denominador: 130 });
    await conexao.db.execute(sql`DELETE FROM lancamento_semanal WHERE valor = 999`);
  });
});

describe('GET /api/pendencias (dados do seed)', () => {
  beforeAll(async () => {
    await conexao.close();
    conexao = await prepararBanco();
    app = createApp(conexao.db, { hoje: () => hoje });
  });

  it('lista exatamente as semanas que o seed deixou sem envio (3 por unidade)', async () => {
    const { body } = await get<PendenciasResponse>('/api/pendencias');
    const esperado = gerarDadosSinteticos().semanasAusentes;
    expect(body.totalPendentes).toBe(esperado.length);
    expect(body.totalIncompletas).toBe(0);
    for (const u of body.unidades) {
      const dele = esperado
        .filter((e) => e.unidade === u.nome)
        .map((e) => e.semanaInicio)
        .sort();
      expect(u.semanasPendentes).toEqual(dele);
    }
  });

  it('padrão: do início dos dados até a última semana que eles alcançam', async () => {
    const { body } = await get<PendenciasResponse>('/api/pendencias');
    expect(body.de).toBe('2024-01-01');
    expect(body.ate).toBe('2025-12-22');
    expect(body.semanasEsperadas).toBe(104);
  });

  it('semana em andamento nunca é pendente: com hoje = qua 24/12/2025 a semana de 22/12 fica de fora', async () => {
    hoje = '2025-12-24';
    const { body } = await get<PendenciasResponse>('/api/pendencias');
    expect(body.ate).toBe('2025-12-15');
    expect(body.semanasEsperadas).toBe(103);
    hoje = '2026-10-09';
  });

  it('intervalo explícito é ajustado para segundas e respeita o limite', async () => {
    const ok = await get<PendenciasResponse>('/api/pendencias?de=2024-02-07&ate=2024-02-20');
    expect(ok.body).toMatchObject({ de: '2024-02-05', ate: '2024-02-19', semanasEsperadas: 3 });
    expect((await get('/api/pendencias?de=2000-01-03&ate=2025-12-22')).status).toBe(400);
    expect((await get('/api/pendencias?de=ontem')).status).toBe(400);
  });
});
