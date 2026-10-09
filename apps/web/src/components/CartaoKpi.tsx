import type { Kpi } from '@dashboard/shared';
import {
  coberturaCompleta,
  descricaoVariacao,
  formatarValor,
  legendaDaUnidade,
  setaVariacao,
  textoCobertura,
  textoVariacao,
} from '../format';

type Props = { kpi: Kpi; rotuloAnterior: string };

export function CartaoKpi({ kpi, rotuloAnterior }: Props) {
  const titulo = `kpi-${kpi.indicador}`;
  const legenda = legendaDaUnidade(kpi.unidadeMedida);
  const atual = kpi.atual;

  return (
    <article aria-labelledby={titulo} className="rounded-lg border border-border bg-surface p-5">
      <h3 id={titulo} className="text-sm font-medium text-text-muted">
        {kpi.nome}
      </h3>

      {atual === null ? (
        <p className="mt-2 text-text-muted">Sem dados neste período</p>
      ) : (
        <>
          <p className="mt-2 text-3xl font-bold tabular-nums">
            {formatarValor(atual.valor, kpi.unidadeMedida)}
            {legenda && (
              <span className="ml-2 text-base font-normal text-text-muted">{legenda}</span>
            )}
          </p>

          <p className="mt-2 text-sm">
            <span className="sr-only">{descricaoVariacao(kpi.variacao, rotuloAnterior)}</span>
            <span aria-hidden="true">
              <span className="mr-1 text-text-muted">{setaVariacao(kpi.variacao)}</span>
              {textoVariacao(kpi.variacao)}{' '}
              <span className="text-text-muted">vs {rotuloAnterior}</span>
            </span>
          </p>

          <p
            className={`mt-3 text-xs ${coberturaCompleta(atual.semanasInformadas, atual.semanasEsperadas) ? 'text-text-muted' : 'text-warn'}`}
          >
            {textoCobertura(atual.semanasInformadas, atual.semanasEsperadas)}
            {coberturaCompleta(atual.semanasInformadas, atual.semanasEsperadas)
              ? ''
              : ' (incompleto: há semanas sem envio)'}
          </p>
        </>
      )}
    </article>
  );
}
