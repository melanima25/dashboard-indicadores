import { useState } from 'react';
import { escalaLinear, marcasDoEixo } from './escala';
import { useLargura } from './useLargura';
import { formatarEixo, formatarValor } from '../../format';

export type BarraUnidade = {
  id: number;
  nome: string;
  valor: number | null;
  /** linha extra do tooltip, ex.: cobertura de semanas */
  detalhe?: string;
};

type Props = {
  titulo: string;
  nomeIndicador: string;
  unidadeMedida: string;
  barras: BarraUnidade[];
  /** unidade escolhida no filtro: ela ganha a cor; as outras viram contexto (ênfase) */
  destaqueId: number | null;
  atenuado?: boolean;
};

const LINHA = 40; // altura de cada faixa
const ESPESSURA = 18; // barra fina (máx. 24px), com ar em volta
const M = { esq: 112, dir: 72, topo: 8, base: 26 };

/**
 * Comparação entre unidades no período: barras horizontais ordenadas, base no zero,
 * ponta de 4px arredondada, valor na ponta. Uma série só => sem legenda.
 */
export function GraficoBarras({
  titulo,
  nomeIndicador,
  unidadeMedida,
  barras,
  destaqueId,
  atenuado,
}: Props) {
  const { ref, largura } = useLargura();
  const [ativo, setAtivo] = useState<number | null>(null);

  const ordenadas = [...barras].sort(
    (a, b) => (b.valor ?? -Infinity) - (a.valor ?? -Infinity) || a.nome.localeCompare(b.nome),
  );
  const max = Math.max(0, ...ordenadas.map((b) => b.valor ?? 0));
  const marcas = marcasDoEixo(0, max || 1, 4);
  const topoEixo = marcas[marcas.length - 1] as number;
  const x = escalaLinear(0, topoEixo, M.esq, largura - M.dir);
  const altura = M.topo + ordenadas.length * LINHA + M.base;

  return (
    <figure
      className={`min-w-0 rounded-lg border border-border bg-surface p-5 transition-opacity ${atenuado ? 'opacity-60' : ''}`}
      data-testid="grafico-barras"
    >
      <figcaption className="mb-3">
        <h3 className="text-base font-semibold">{titulo}</h3>
        <p className="text-sm text-text-muted">{nomeIndicador}</p>
      </figcaption>

      <div
        ref={ref}
        className="relative overflow-hidden"
        role="group"
        aria-label={`Gráfico de barras: ${titulo}. Os mesmos dados estão na tabela abaixo.`}
      >
        <svg width={largura} height={altura} viewBox={`0 0 ${largura} ${altura}`} className="block">
          {marcas.map((m) => (
            <g key={m}>
              <line
                x1={x(m)}
                x2={x(m)}
                y1={M.topo}
                y2={altura - M.base}
                stroke="var(--color-viz-grade)"
                strokeWidth={1}
              />
              <text
                x={x(m)}
                y={altura - M.base + 16}
                textAnchor="middle"
                fontSize={11}
                fill="var(--color-text-muted)"
              >
                {formatarEixo(m, unidadeMedida)}
              </text>
            </g>
          ))}
          <line
            x1={x(0)}
            x2={x(0)}
            y1={M.topo}
            y2={altura - M.base}
            stroke="var(--color-viz-eixo)"
            strokeWidth={1}
          />

          {ordenadas.map((b, i) => {
            const topo = M.topo + i * LINHA;
            const meio = topo + LINHA / 2;
            const destacada = destaqueId === null || b.id === destaqueId;
            const comprimento = b.valor === null ? 0 : Math.max(0, x(b.valor) - x(0));
            const r = Math.min(4, comprimento / 2);
            const fim = x(0) + comprimento;
            const cor = destacada ? 'var(--color-viz-1)' : 'var(--color-viz-mudo)';
            return (
              <g
                key={b.id}
                data-testid={`barra-${b.id}`}
                tabIndex={0}
                role="img"
                aria-label={`${b.nome}: ${formatarValor(b.valor, unidadeMedida)}`}
                onPointerEnter={() => setAtivo(b.id)}
                onPointerLeave={() => setAtivo(null)}
                onFocus={() => setAtivo(b.id)}
                onBlur={() => setAtivo(null)}
                style={{ outline: 'none' }}
              >
                {/* área de toque/hover maior que a barra */}
                <rect x={0} y={topo} width={largura} height={LINHA} fill="transparent" />
                {ativo === b.id && (
                  <rect
                    x={0}
                    y={topo + 2}
                    width={largura}
                    height={LINHA - 4}
                    rx={4}
                    fill="var(--color-text)"
                    opacity={0.06}
                  />
                )}
                <text
                  x={M.esq - 10}
                  y={meio}
                  dy="0.32em"
                  textAnchor="end"
                  fontSize={12}
                  fill="var(--color-text)"
                  fontWeight={b.id === destaqueId ? 600 : 400}
                >
                  {b.nome}
                </text>
                {b.valor !== null && comprimento > 0 && (
                  // base reta no zero, ponta arredondada (4px)
                  <path
                    d={`M${x(0)},${meio - ESPESSURA / 2} H${fim - r} Q${fim},${meio - ESPESSURA / 2} ${fim},${meio - ESPESSURA / 2 + r} V${meio + ESPESSURA / 2 - r} Q${fim},${meio + ESPESSURA / 2} ${fim - r},${meio + ESPESSURA / 2} H${x(0)} Z`}
                    fill={cor}
                    opacity={ativo === b.id ? 1 : 0.92}
                  />
                )}
                <text
                  x={fim + 8}
                  y={meio}
                  dy="0.32em"
                  fontSize={12}
                  fontWeight={600}
                  fill="var(--color-text)"
                >
                  {formatarValor(b.valor, unidadeMedida)}
                </text>
              </g>
            );
          })}
        </svg>
        {ativo !== null &&
          (() => {
            const i = ordenadas.findIndex((b) => b.id === ativo);
            const b = ordenadas[i];
            if (!b) return null;
            return (
              <div
                className="pointer-events-none absolute z-10 w-44 rounded-md border border-border bg-bg px-3 py-2 text-sm shadow-lg"
                // abaixo da linha: as barras de baixo são mais curtas, então o lado direito está livre
                style={{ right: 0, top: Math.min(M.topo + (i + 1) * LINHA - 14, altura - 78) }}
              >
                <p className="text-xs text-text-muted">{b.nome}</p>
                <p className="flex items-center gap-2 font-semibold">
                  <span
                    aria-hidden="true"
                    className="inline-block h-2 w-3 rounded-sm"
                    style={{ background: 'var(--color-viz-1)' }}
                  />
                  {formatarValor(b.valor, unidadeMedida)}
                </p>
                {b.detalhe && <p className="text-xs text-text-muted">{b.detalhe}</p>}
              </div>
            );
          })()}
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
                Unidade
              </th>
              <th scope="col" className="py-1 text-right font-medium">
                Valor
              </th>
            </tr>
          </thead>
          <tbody>
            {ordenadas.map((b) => (
              <tr key={b.id} className="border-t border-border">
                <th scope="row" className="py-1 pr-4 font-normal">
                  {b.nome}
                </th>
                <td className="py-1 text-right tabular-nums">
                  {formatarValor(b.valor, unidadeMedida)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
