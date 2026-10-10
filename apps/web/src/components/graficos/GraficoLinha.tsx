/* Widget de teclado próprio: o contêiner do gráfico é focável para as setas percorrerem os períodos. */
/* eslint-disable jsx-a11y/no-noninteractive-tabindex */
import { useState, type KeyboardEvent, type PointerEvent } from 'react';
import { dominioDaLinha, escalaLinear, indiceMaisProximo, marcasDoEixo } from './escala';
import { useLargura } from './useLargura';
import { formatarEixo, formatarValor, rotuloCurto, rotuloPeriodo } from '../../format';
import type { Granularidade } from '@dashboard/shared';

export type PontoLinha = { periodo: string; valor: number | null };

type Props = {
  titulo: string;
  nomeIndicador: string;
  unidadeMedida: string;
  granularidade: Granularidade;
  /** todos os períodos da janela, em ordem; valor null = sem dado (a linha quebra, não vira zero) */
  pontos: PontoLinha[];
  atenuado?: boolean;
};

const ALTURA = 260;
const M = { esq: 52, dir: 64, topo: 14, base: 30 };

/**
 * Evolução de UM indicador no tempo: linha de 2px, sem legenda (uma série só: o título já diz o que é),
 * ponto final com anel, rótulo só na ponta, cursor que gruda no período e tooltip.
 * Funciona por teclado (setas) e tem tabela equivalente logo abaixo.
 */
export function GraficoLinha({
  titulo,
  nomeIndicador,
  unidadeMedida,
  granularidade,
  pontos,
  atenuado,
}: Props) {
  const { ref, largura } = useLargura();
  const [ativo, setAtivo] = useState<number | null>(null);

  const valores = pontos.flatMap((p) => (p.valor === null ? [] : [p.valor]));
  const [d0, d1] = dominioDaLinha(valores);
  const marcas = marcasDoEixo(d0, d1);
  const xs = pontos.map((_, i) =>
    escalaLinear(0, Math.max(1, pontos.length - 1), M.esq, largura - M.dir)(i),
  );
  const y = escalaLinear(d0, d1, ALTURA - M.base, M.topo);

  // segmentos contínuos: um período sem dado quebra a linha
  const segmentos: { i: number; x: number; y: number }[][] = [];
  pontos.forEach((p, i) => {
    if (p.valor === null) {
      segmentos.push([]);
      return;
    }
    if (segmentos.length === 0) segmentos.push([]);
    (segmentos[segmentos.length - 1] as { i: number; x: number; y: number }[]).push({
      i,
      x: xs[i] as number,
      y: y(p.valor),
    });
  });
  const trechos = segmentos.filter((s) => s.length > 0);
  const caminho = (s: { x: number; y: number }[]) =>
    s.map((p, k) => `${k === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = (s: { x: number; y: number }[]) =>
    `${caminho(s)} L${(s[s.length - 1] as { x: number }).x.toFixed(1)},${ALTURA - M.base} L${(s[0] as { x: number }).x.toFixed(1)},${ALTURA - M.base} Z`;

  const ultimo = [...pontos.keys()].reverse().find((i) => pontos[i]?.valor !== null);
  const passoRotulo = Math.max(
    1,
    Math.ceil(pontos.length / Math.max(1, Math.floor((largura - M.esq - M.dir) / 58))),
  );

  function mover(e: PointerEvent<SVGSVGElement>) {
    const caixa = e.currentTarget.getBoundingClientRect();
    setAtivo(indiceMaisProximo(xs, e.clientX - caixa.left));
  }
  function teclado(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'ArrowRight') setAtivo((a) => Math.min(pontos.length - 1, (a ?? -1) + 1));
    else if (e.key === 'ArrowLeft') setAtivo((a) => Math.max(0, (a ?? pontos.length) - 1));
    else if (e.key === 'Escape') setAtivo(null);
    else return;
    e.preventDefault();
  }

  const p = ativo !== null ? pontos[ativo] : undefined;
  const descricao = p
    ? `${rotuloPeriodo(p.periodo, granularidade)}: ${formatarValor(p.valor, unidadeMedida)}`
    : '';

  return (
    <figure
      className={`min-w-0 rounded-lg border border-border bg-surface p-5 transition-opacity ${atenuado ? 'opacity-60' : ''}`}
      data-testid="grafico-linha"
    >
      <figcaption className="mb-3">
        <h3 className="text-base font-semibold">{titulo}</h3>
        <p className="text-sm text-text-muted">{nomeIndicador}</p>
      </figcaption>

      {/* widget de teclado próprio (setas percorrem os períodos); a tabela abaixo é a alternativa completa */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={ref}
        className="relative overflow-hidden"
        tabIndex={0}
        role="group"
        aria-label={`Gráfico de linha: ${titulo}. Use as setas para percorrer os períodos; os mesmos dados estão na tabela abaixo.`}
        onKeyDown={teclado}
        onBlur={() => setAtivo(null)}
      >
        <svg
          width={largura}
          height={ALTURA}
          viewBox={`0 0 ${largura} ${ALTURA}`}
          aria-hidden="true"
          onPointerMove={mover}
          onPointerLeave={() => setAtivo(null)}
          className="block touch-pan-y"
        >
          {marcas.map((m) => (
            <g key={m}>
              <line
                x1={M.esq}
                x2={largura - M.dir}
                y1={y(m)}
                y2={y(m)}
                stroke="var(--color-viz-grade)"
                strokeWidth={1}
              />
              <text
                x={M.esq - 8}
                y={y(m)}
                dy="0.32em"
                textAnchor="end"
                fontSize={11}
                fill="var(--color-text-muted)"
              >
                {formatarEixo(m, unidadeMedida)}
              </text>
            </g>
          ))}
          <line
            x1={M.esq}
            x2={largura - M.dir}
            y1={ALTURA - M.base}
            y2={ALTURA - M.base}
            stroke="var(--color-viz-eixo)"
            strokeWidth={1}
          />
          {pontos.map((pt, i) =>
            i % passoRotulo === 0 ? (
              <text
                key={pt.periodo}
                x={xs[i]}
                y={ALTURA - M.base + 18}
                textAnchor="middle"
                fontSize={11}
                fill="var(--color-text-muted)"
              >
                {rotuloCurto(pt.periodo, granularidade)}
              </text>
            ) : null,
          )}

          {trechos.map((s) => (
            <g key={s[0]?.i}>
              {s.length > 1 && <path d={area(s)} fill="var(--color-viz-1)" opacity={0.1} />}
              <path
                d={caminho(s)}
                fill="none"
                stroke="var(--color-viz-1)"
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </g>
          ))}

          {ultimo !== undefined && ativo === null && (
            <>
              <circle
                cx={xs[ultimo]}
                cy={y(pontos[ultimo]?.valor as number)}
                r={4}
                fill="var(--color-viz-1)"
                stroke="var(--color-surface)"
                strokeWidth={2}
              />
              <text
                x={(xs[ultimo] as number) + 10}
                y={y(pontos[ultimo]?.valor as number)}
                dy="0.32em"
                fontSize={12}
                fontWeight={600}
                fill="var(--color-text)"
              >
                {formatarValor(pontos[ultimo]?.valor as number, unidadeMedida)}
              </text>
            </>
          )}

          {ativo !== null && (
            <>
              <line
                x1={xs[ativo]}
                x2={xs[ativo]}
                y1={M.topo}
                y2={ALTURA - M.base}
                stroke="var(--color-viz-eixo)"
                strokeWidth={1}
              />
              {p?.valor != null && (
                <circle
                  cx={xs[ativo]}
                  cy={y(p.valor)}
                  r={5}
                  fill="var(--color-viz-1)"
                  stroke="var(--color-surface)"
                  strokeWidth={2}
                />
              )}
            </>
          )}
        </svg>

        {p && ativo !== null && (
          <div
            role="status"
            className="pointer-events-none absolute z-10 rounded-md border border-border bg-bg px-3 py-2 text-sm shadow-lg"
            style={{
              left: Math.min(Math.max(0, (xs[ativo] as number) - 70), largura - 150),
              top: 0,
              width: 140,
            }}
          >
            <p className="text-xs text-text-muted">{rotuloPeriodo(p.periodo, granularidade)}</p>
            <p className="flex items-center gap-2 font-semibold">
              <span
                aria-hidden="true"
                className="inline-block h-0.5 w-3"
                style={{ background: 'var(--color-viz-1)' }}
              />
              {p.valor === null ? 'Sem dados' : formatarValor(p.valor, unidadeMedida)}
            </p>
          </div>
        )}
        <span className="sr-only" aria-live="polite">
          {descricao}
        </span>
      </div>

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-text-muted hover:text-text">
          Ver dados do gráfico em tabela
        </summary>
        <table className="mt-2 w-full text-left">
          <caption className="sr-only">
            {titulo}: {nomeIndicador}
          </caption>
          <thead>
            <tr className="text-text-muted">
              <th scope="col" className="py-1 pr-4 font-medium">
                Período
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                Valor
              </th>
            </tr>
          </thead>
          <tbody>
            {pontos.map((pt) => (
              <tr key={pt.periodo} className="border-t border-border">
                <th scope="row" className="py-1 pr-4 font-normal">
                  {rotuloPeriodo(pt.periodo, granularidade)}
                </th>
                <td className="py-1 text-right tabular-nums">
                  {formatarValor(pt.valor, unidadeMedida)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
