import { describe, expect, it } from 'vitest';
import { mesDeReferenciaDaSemana } from '@dashboard/shared';
import {
  SEMANAS_AUSENTES_POR_UNIDADE,
  TOTAL_SEMANAS,
  UNIDADES,
  gerarDadosSinteticos,
} from './seed-data';

describe('gerarDadosSinteticos', () => {
  const dados = gerarDadosSinteticos();

  it('é determinístico (mesma semente, mesmo resultado)', () => {
    expect(gerarDadosSinteticos()).toEqual(dados);
  });

  it('semente diferente muda os dados', () => {
    expect(gerarDadosSinteticos(1)).not.toEqual(dados);
  });

  it('deixa semanas ausentes por unidade, sem lançamentos nelas', () => {
    expect(dados.semanasAusentes).toHaveLength(UNIDADES.length * SEMANAS_AUSENTES_POR_UNIDADE);
    const ausentes = new Set(dados.semanasAusentes.map((a) => `${a.unidade}|${a.semanaInicio}`));
    expect(dados.lancamentos.some((l) => ausentes.has(`${l.unidade}|${l.semanaInicio}`))).toBe(
      false,
    );
    const porUnidade = dados.lancamentos.filter(
      (l) => l.unidade === UNIDADES[0] && l.indicador === 'faltas',
    );
    expect(porUnidade).toHaveLength(TOTAL_SEMANAS - SEMANAS_AUSENTES_POR_UNIDADE);
  });

  it('respeita as invariantes: agendados = realizados + faltas, sem negativos', () => {
    const chave = (l: { unidade: string; semanaInicio: string }) =>
      `${l.unidade}|${l.semanaInicio}`;
    const mapa = new Map<string, Record<string, number>>();
    for (const l of dados.lancamentos) {
      expect(l.valor).toBeGreaterThanOrEqual(0);
      const m = mapa.get(chave(l)) ?? {};
      m[l.indicador] = l.valor;
      mapa.set(chave(l), m);
    }
    for (const m of mapa.values()) {
      expect(m.atendimentos_agendados).toBe((m.atendimentos_realizados ?? 0) + (m.faltas ?? 0));
    }
  });

  it('só gera segundas-feiras, cobrindo 2 anos (virada de ano incluída)', () => {
    const semanas = [...new Set(dados.lancamentos.map((l) => l.semanaInicio))];
    for (const s of semanas) expect(new Date(`${s}T00:00:00Z`).getUTCDay()).toBe(1);
    const meses = new Set(semanas.map((s) => JSON.stringify(mesDeReferenciaDaSemana(s))));
    expect(meses.size).toBe(24);
  });
});
