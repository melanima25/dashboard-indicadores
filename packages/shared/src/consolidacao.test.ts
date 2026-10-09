import { describe, expect, it } from 'vitest';
import {
  agregarEmMemoria,
  calcularPendencias,
  chavePeriodo,
  finalizarItens,
  semanasDoPeriodo,
  type FiltrosConsolidacao,
  type LancamentoRef,
} from './consolidacao';
import type { IndicadorRegra } from './csv';
import { quintaDaSemana, segundasEntre, semanaConcluida, ultimaSemanaConcluida } from './semana';
import { mesDeReferenciaDaSemana } from './semana';

const indicadores: IndicadorRegra[] = [
  { codigo: 'atendimentos_agendados', tipo: 'soma' },
  { codigo: 'faltas', tipo: 'soma' },
  {
    codigo: 'taxa_absenteismo',
    tipo: 'taxa',
    numeradorCodigo: 'faltas',
    denominadorCodigo: 'atendimentos_agendados',
  },
  { codigo: 'tempo_medio_espera', tipo: 'media' },
];

const L = (
  unidadeId: number,
  semanaInicio: string,
  indicador: string,
  valor: number,
): LancamentoRef => ({
  unidadeId,
  semanaInicio,
  indicador,
  valor,
});

/**
 * Caso calculado à mão (março/2025 tem 4 semanas: seg 03, 10, 17 e 24; a de 31/03 vai para abril).
 * Unidade 1 mandou as 4 semanas de março; unidade 2 só a de 17/03.
 *   sem 17/03: u1 agendados 10, faltas 1 (10%)    | u2 agendados 20, faltas 4
 *   sem 24/03: u1 agendados 100, faltas 50 (50%)
 *   sem 31/03 (ABRIL): u1 agendados 40, faltas 4
 */
const fixture: LancamentoRef[] = [
  L(1, '2025-03-17', 'atendimentos_agendados', 10),
  L(1, '2025-03-17', 'faltas', 1),
  L(1, '2025-03-24', 'atendimentos_agendados', 100),
  L(1, '2025-03-24', 'faltas', 50),
  L(2, '2025-03-17', 'atendimentos_agendados', 20),
  L(2, '2025-03-17', 'faltas', 4),
  L(1, '2025-03-31', 'atendimentos_agendados', 40),
  L(1, '2025-03-31', 'faltas', 4),
  L(1, '2025-03-17', 'tempo_medio_espera', 10),
  L(1, '2025-03-24', 'tempo_medio_espera', 30),
];

const HOJE = '2026-10-09';
const consolidar = (f: Partial<FiltrosConsolidacao>) => {
  const filtros: FiltrosConsolidacao = { granularidade: 'mensal', agrupar: 'rede', ...f };
  return finalizarItens(agregarEmMemoria(fixture, indicadores, filtros), {
    indicadores,
    granularidade: filtros.granularidade,
    hoje: HOJE,
    de: filtros.de,
    ate: filtros.ate,
    unidadesNaRede: 2,
  });
};
const item = (itens: ReturnType<typeof consolidar>, periodo: string, indicador: string) =>
  itens.find((i) => i.periodo === periodo && i.indicador === indicador);

describe('regra do mês: a quinta-feira manda', () => {
  it('chavePeriodo concorda com mesDeReferenciaDaSemana em 15 anos de segundas-feiras', () => {
    for (const s of segundasEntre('2020-01-06', '2035-12-31')) {
      const { ano, mes } = mesDeReferenciaDaSemana(s);
      expect(chavePeriodo(s, 'mensal')).toBe(`${ano}-${String(mes).padStart(2, '0')}`);
      expect(chavePeriodo(s, 'anual')).toBe(String(ano));
      expect(quintaDaSemana(s).slice(0, 7)).toBe(chavePeriodo(s, 'mensal'));
    }
  });

  it('semanasDoPeriodo: março/2025 = 4 semanas, abril/2025 = 4, maio/2025 = 5', () => {
    expect(semanasDoPeriodo('2025-03', 'mensal')).toEqual([
      '2025-03-03',
      '2025-03-10',
      '2025-03-17',
      '2025-03-24',
    ]);
    expect(semanasDoPeriodo('2025-04', 'mensal')[0]).toBe('2025-03-31');
    expect(semanasDoPeriodo('2025-04', 'mensal')).toHaveLength(4);
    expect(semanasDoPeriodo('2025-05', 'mensal')).toHaveLength(5);
  });

  it('anual: 2025 tem 52 semanas; 2026 tem 53 e começa em 29/12/2025', () => {
    expect(semanasDoPeriodo('2025', 'anual')).toHaveLength(52);
    const a2026 = semanasDoPeriodo('2026', 'anual');
    expect(a2026).toHaveLength(53);
    expect(a2026[0]).toBe('2025-12-29');
  });

  it('cada semana pertence a exatamente um mês, e os meses somam o ano', () => {
    for (let ano = 2020; ano <= 2035; ano++) {
      let soma = 0;
      for (let mes = 1; mes <= 12; mes++)
        soma += semanasDoPeriodo(`${ano}-${String(mes).padStart(2, '0')}`, 'mensal').length;
      expect(soma).toBe(semanasDoPeriodo(String(ano), 'anual').length);
    }
  });
});

describe('consolidação mensal (rede), conta feita à mão', () => {
  const marco = consolidar({});

  it('soma: agendados de março = 10 + 100 + 20 = 130 (a semana de 31/03 NÃO entra)', () => {
    expect(item(marco, '2025-03', 'atendimentos_agendados')).toMatchObject({
      valor: 130,
      semanasInformadas: 3,
    });
  });

  it('a semana de 31/03 cai em abril', () => {
    expect(item(marco, '2025-04', 'atendimentos_agendados')?.valor).toBe(40);
  });

  it('taxa recalculada: (1+50+4) ÷ (10+100+20) = 55/130 = 42,31%, NÃO a média dos percentuais', () => {
    const t = item(marco, '2025-03', 'taxa_absenteismo')!;
    expect(t.numerador).toBe(55);
    expect(t.denominador).toBe(130);
    expect(t.valor).toBeCloseTo(42.3077, 3);
    // média dos percentuais de cada unidade-semana: (10% + 50% + 20%) / 3 = 26,7% (errado)
    expect(t.valor).not.toBeCloseTo(26.667, 1);
  });

  it('média: tempo de espera de março = (10 + 30) ÷ 2 = 20', () => {
    expect(item(marco, '2025-03', 'tempo_medio_espera')?.valor).toBe(20);
  });

  it('cobertura: 3 de 8 unidade-semanas (4 semanas × 2 unidades); semanas sem envio não viram zero', () => {
    const a = item(marco, '2025-03', 'atendimentos_agendados')!;
    expect(a.semanasInformadas).toBe(3);
    expect(a.semanasEsperadas).toBe(8);
    expect(consolidar({}).some((i) => i.periodo === '2025-02')).toBe(false);
  });
});

describe('agrupar por unidade e filtros', () => {
  it('por unidade: a unidade 2 em março tem taxa 4/20 = 20%', () => {
    const itens = consolidar({ agrupar: 'unidade' });
    const u2 = itens.find((i) => i.unidadeId === 2 && i.indicador === 'taxa_absenteismo')!;
    expect(u2.valor).toBeCloseTo(20, 6);
    expect(u2.semanasEsperadas).toBe(4);
    const u1 = itens.find(
      (i) => i.unidadeId === 1 && i.periodo === '2025-03' && i.indicador === 'taxa_absenteismo',
    )!;
    expect(u1.valor).toBeCloseTo((51 / 110) * 100, 6);
  });

  it('taxa só conta semanas em que numerador E denominador existem', () => {
    const parcial = [...fixture, L(3, '2025-03-17', 'faltas', 9)]; // unidade 3 sem agendados
    const ags = agregarEmMemoria(parcial, indicadores, {
      granularidade: 'mensal',
      agrupar: 'rede',
      indicador: 'taxa_absenteismo',
    });
    expect(ags.find((a) => a.periodo === '2025-03')).toMatchObject({
      numerador: 55,
      denominador: 130,
    });
  });

  it('taxa com denominador zero é indefinida (null), não 0 nem NaN', () => {
    const zeros = [
      L(1, '2025-03-17', 'atendimentos_agendados', 0),
      L(1, '2025-03-17', 'faltas', 0),
    ];
    const [t] = finalizarItens(
      agregarEmMemoria(zeros, indicadores, {
        granularidade: 'mensal',
        agrupar: 'rede',
        indicador: 'taxa_absenteismo',
      }),
      { indicadores, granularidade: 'mensal', hoje: HOJE, unidadesNaRede: 1 },
    );
    expect(t!.valor).toBeNull();
  });

  it('filtro de datas olha a quinta-feira: ate=2025-03-31 inclui março e exclui a semana de 31/03', () => {
    const itens = consolidar({ ate: '2025-03-31' });
    expect(itens.every((i) => i.periodo === '2025-03')).toBe(true);
  });

  it('semanal devolve cada semana separada', () => {
    const itens = consolidar({ granularidade: 'semanal', unidadeId: 1, indicador: 'faltas' });
    expect(itens.map((i) => [i.periodo, i.valor])).toEqual([
      ['2025-03-17', 1],
      ['2025-03-24', 50],
      ['2025-03-31', 4],
    ]);
  });

  it('anual = soma dos meses (propriedade)', () => {
    const anual = item(consolidar({ granularidade: 'anual' }), '2025', 'faltas')!;
    const meses = consolidar({}).filter((i) => i.indicador === 'faltas');
    expect(anual.valor).toBe(meses.reduce((s, i) => s + (i.valor ?? 0), 0));
  });
});

describe('semanas concluídas', () => {
  it('semana só conta como concluída depois do domingo', () => {
    expect(semanaConcluida('2026-09-28', '2026-10-05')).toBe(true); // hoje é segunda
    expect(semanaConcluida('2026-09-28', '2026-10-04')).toBe(false); // hoje é domingo
    expect(ultimaSemanaConcluida('2026-10-09')).toBe('2026-09-28');
    expect(ultimaSemanaConcluida('2026-10-05')).toBe('2026-09-28');
  });

  it('período em andamento: semanas futuras não entram em "esperadas"', () => {
    const itens = finalizarItens(
      [
        {
          periodo: '2026-10',
          unidadeId: null,
          indicador: 'faltas',
          valorBruto: 5,
          numerador: null,
          denominador: null,
          semanasInformadas: 1,
        },
      ],
      { indicadores, granularidade: 'mensal', hoje: '2026-10-09', unidadesNaRede: 1 },
    );
    // outubro/2026 (quintas 1, 8, 15, 22, 29): só as semanas de 28/09 (quinta 01/10) concluiu
    expect(itens[0]!.semanasEsperadas).toBe(1);
  });
});

describe('calcularPendencias', () => {
  const importaveis = ['atendimentos_agendados', 'faltas', 'tempo_medio_espera'];
  const semanas = ['2025-03-03', '2025-03-10', '2025-03-17'];
  const presentes = new Map<string, Set<string>>([
    ['1|2025-03-03', new Set(importaveis)],
    ['1|2025-03-10', new Set(['faltas'])],
    ['2|2025-03-03', new Set(importaveis)],
    ['2|2025-03-10', new Set(importaveis)],
    ['2|2025-03-17', new Set(importaveis)],
  ]);
  const r = calcularPendencias({
    unidades: [
      { id: 1, nome: 'Unidade Norte' },
      { id: 2, nome: 'Unidade Sul' },
    ],
    semanas,
    presentes,
    importaveis,
  });

  it('semana sem nenhum envio é pendente (não é zero)', () => {
    expect(r[0]!.semanasPendentes).toEqual(['2025-03-17']);
    expect(r[1]!.semanasPendentes).toEqual([]);
  });
  it('semana enviada pela metade é incompleta, com a lista do que falta', () => {
    expect(r[0]!.semanasIncompletas).toEqual([
      { semana: '2025-03-10', faltando: ['atendimentos_agendados', 'tempo_medio_espera'] },
    ]);
  });
});
