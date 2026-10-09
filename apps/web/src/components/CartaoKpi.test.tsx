import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Kpi } from '@dashboard/shared';
import { CartaoKpi } from './CartaoKpi';

const base: Kpi = {
  indicador: 'faltas',
  nome: 'Faltas',
  unidadeMedida: 'atendimentos',
  tipo: 'soma',
  atual: {
    valor: 2190,
    numerador: null,
    denominador: null,
    semanasInformadas: 22,
    semanasEsperadas: 24,
  },
  anterior: {
    valor: 2000,
    numerador: null,
    denominador: null,
    semanasInformadas: 24,
    semanasEsperadas: 24,
  },
  variacao: { tipo: 'percentual', valor: 9.5 },
};

describe('CartaoKpi', () => {
  it('mostra valor, variação, e avisa quando a cobertura é incompleta', () => {
    const html = renderToStaticMarkup(<CartaoKpi kpi={base} rotuloAnterior="nov/2025" />);
    expect(html).toContain('Faltas');
    expect(html).toContain('2.190');
    expect(html).toContain('+9,5%');
    expect(html).toContain('Aumento de 9,5% em relação a nov/2025');
    expect(html).toContain('22 de 24 envios (incompleto: há semanas sem envio)');
  });

  it('cobertura completa não mostra aviso', () => {
    const kpi = { ...base, atual: { ...base.atual!, semanasInformadas: 24 } };
    const html = renderToStaticMarkup(<CartaoKpi kpi={kpi} rotuloAnterior="nov/2025" />);
    expect(html).toContain('24 de 24 envios');
    expect(html).not.toContain('incompleto');
  });

  it('sem dados no período: texto explícito, nunca zero', () => {
    const html = renderToStaticMarkup(
      <CartaoKpi kpi={{ ...base, atual: null }} rotuloAnterior="nov/2025" />,
    );
    expect(html).toContain('Sem dados neste período');
    expect(html).not.toContain('>0<');
  });

  it('taxa mostra % e variação em pontos percentuais', () => {
    const kpi: Kpi = {
      ...base,
      indicador: 'taxa_absenteismo',
      nome: 'Taxa de absenteísmo',
      unidadeMedida: '%',
      tipo: 'taxa',
      atual: {
        valor: 13.27,
        numerador: 2190,
        denominador: 16498,
        semanasInformadas: 24,
        semanasEsperadas: 24,
      },
      variacao: { tipo: 'pontos', valor: -1.3 },
    };
    const html = renderToStaticMarkup(<CartaoKpi kpi={kpi} rotuloAnterior="nov/2025" />);
    expect(html).toContain('13,3%');
    expect(html).toContain('−1,3 p.p.');
    expect(html).toContain('Queda de 1,3 p.p.');
  });
});
