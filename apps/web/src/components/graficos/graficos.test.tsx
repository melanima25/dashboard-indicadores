import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { GraficoBarras } from './GraficoBarras';
import { GraficoLinha } from './GraficoLinha';

const base = {
  titulo: 'Evolução',
  nomeIndicador: 'Atendimentos',
  unidadeMedida: 'atendimentos',
};

describe('GraficoLinha', () => {
  it('período sem dado quebra a linha em vez de virar zero', () => {
    const html = renderToStaticMarkup(
      <GraficoLinha
        {...base}
        granularidade="mensal"
        pontos={[
          { periodo: '2025-01', valor: 10 },
          { periodo: '2025-02', valor: 12 },
          { periodo: '2025-03', valor: null },
          { periodo: '2025-04', valor: 11 },
          { periodo: '2025-05', valor: 13 },
        ]}
      />,
    );
    // dois trechos de 2px (um antes e outro depois do buraco)
    expect(html.match(/<path[^>]*fill="none"[^>]*stroke-width="2"/g)).toHaveLength(2);
    // a tabela alternativa mostra o buraco como travessão
    expect(html).toContain('mar/2025');
    expect(html).toContain('—');
  });

  it('não desenha legenda para uma série só', () => {
    const html = renderToStaticMarkup(
      <GraficoLinha
        {...base}
        granularidade="anual"
        pontos={[
          { periodo: '2024', valor: 1 },
          { periodo: '2025', valor: 2 },
        ]}
      />,
    );
    expect(html).not.toMatch(/legenda/i);
  });
});

describe('GraficoBarras', () => {
  const barras = [
    { id: 1, nome: 'Norte', valor: 30 },
    { id: 2, nome: 'Sul', valor: 50 },
    { id: 3, nome: 'Centro', valor: null },
  ];

  it('ordena do maior para o menor e deixa quem não tem dado por último', () => {
    const html = renderToStaticMarkup(
      <GraficoBarras {...base} barras={barras} destaqueId={null} />,
    );
    const ordem = [...html.matchAll(/data-testid="barra-(\d)"/g)].map((m) => m[1]);
    expect(ordem).toEqual(['2', '1', '3']);
  });

  it('unidade sem dado não ganha barra e mostra travessão', () => {
    const html = renderToStaticMarkup(
      <GraficoBarras {...base} barras={barras} destaqueId={null} />,
    );
    const centro = html.split('data-testid="barra-3"')[1]?.split('</g>')[0] ?? '';
    expect(centro).not.toContain('<path');
    expect(centro).toContain('—');
  });

  it('com unidade escolhida, as outras viram contexto (cor de de-ênfase)', () => {
    const html = renderToStaticMarkup(<GraficoBarras {...base} barras={barras} destaqueId={1} />);
    expect(html).toContain('var(--color-viz-mudo)');
    expect(html).toContain('var(--color-viz-1)');
  });
});
