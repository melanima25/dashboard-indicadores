import type { ItemConsolidado, TipoIndicador } from '@dashboard/shared';
import { coberturaCompleta, formatarValor, SEM_VALOR, textoCobertura } from '../format';

export type LinhaTabela = { chave: string; nome: string; item: ItemConsolidado | null };

type Props = {
  titulo: string;
  nomeIndicador: string;
  unidadeMedida: string;
  tipo: TipoIndicador;
  linhas: LinhaTabela[];
  destaqueId: number | null;
  onExportar: () => void;
  podeExportar: boolean;
  atenuado?: boolean;
};

const num = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

export function TabelaConsolidada(p: Props) {
  const ehTaxa = p.tipo === 'taxa';
  return (
    <section
      aria-labelledby="titulo-tabela"
      className={`rounded-lg border border-border bg-surface p-5 transition-opacity ${p.atenuado ? 'opacity-60' : ''}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="titulo-tabela" className="text-xl font-semibold">
            Tabela consolidada
          </h2>
          <p className="text-sm text-text-muted">{p.titulo}</p>
        </div>
        <button
          type="button"
          onClick={p.onExportar}
          disabled={!p.podeExportar}
          className="rounded border border-border px-3 py-1.5 text-sm hover:border-accent disabled:opacity-50"
        >
          Exportar CSV
        </button>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[34rem] text-left text-sm" data-testid="tabela-consolidada">
          <caption className="sr-only">
            {p.nomeIndicador} por unidade, {p.titulo}
          </caption>
          <thead>
            <tr className="text-text-muted">
              <th scope="col" className="py-2 pr-4 font-medium">
                Unidade
              </th>
              <th scope="col" className="py-2 pr-4 text-right font-medium">
                {p.nomeIndicador}
              </th>
              {ehTaxa && (
                <>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">
                    Numerador
                  </th>
                  <th scope="col" className="py-2 pr-4 text-right font-medium">
                    Denominador
                  </th>
                </>
              )}
              <th scope="col" className="py-2 font-medium">
                Cobertura
              </th>
            </tr>
          </thead>
          <tbody>
            {p.linhas.map((l) => {
              const destacada = l.chave === `u${p.destaqueId}`;
              const it = l.item;
              const completa = it
                ? coberturaCompleta(it.semanasInformadas, it.semanasEsperadas)
                : true;
              return (
                <tr
                  key={l.chave}
                  className={`border-t border-border ${destacada ? 'bg-bg' : ''}`}
                  aria-current={destacada ? 'true' : undefined}
                >
                  <th
                    scope="row"
                    className={`py-2 pr-4 ${destacada ? 'font-semibold' : 'font-normal'}`}
                  >
                    {l.nome}
                  </th>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {formatarValor(it?.valor ?? null, p.unidadeMedida)}
                  </td>
                  {ehTaxa && (
                    <>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {it?.numerador == null ? SEM_VALOR : num.format(it.numerador)}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {it?.denominador == null ? SEM_VALOR : num.format(it.denominador)}
                      </td>
                    </>
                  )}
                  <td className={`py-2 ${completa ? 'text-text-muted' : 'text-warn'}`}>
                    {it ? textoCobertura(it.semanasInformadas, it.semanasEsperadas) : SEM_VALOR}
                    {!completa && <span className="sr-only"> (incompleto)</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
