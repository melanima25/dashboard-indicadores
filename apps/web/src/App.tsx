import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Granularidade } from '@dashboard/shared';
import { buscarKpis, buscarPendencias, buscarPeriodos, buscarUnidades } from './api';
import { CartaoKpi } from './components/CartaoKpi';
import { Filtros } from './components/Filtros';
import { PainelPendencias } from './components/PainelPendencias';
import { rotuloPeriodo } from './format';

function Erro({ mensagem, onRetry }: { mensagem: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-border bg-surface p-5 text-warn">
      <p>Não foi possível carregar: {mensagem}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded border border-border px-3 py-1.5 text-text hover:border-accent"
      >
        Tentar de novo
      </button>
    </div>
  );
}

export function App() {
  const [granularidade, setGranularidade] = useState<Granularidade>('mensal');
  const [periodoEscolhido, setPeriodoEscolhido] = useState<string | null>(null);
  const [unidadeId, setUnidadeId] = useState<number | null>(null);

  const unidades = useQuery({ queryKey: ['unidades'], queryFn: buscarUnidades });
  const periodos = useQuery({
    queryKey: ['periodos', granularidade],
    queryFn: () => buscarPeriodos(granularidade),
  });
  // sem escolha do usuário, usa o período padrão sugerido pela API (último com dados e concluído)
  const periodo = periodoEscolhido ?? periodos.data?.padrao ?? null;

  const kpis = useQuery({
    queryKey: ['kpis', granularidade, periodo, unidadeId],
    queryFn: () => buscarKpis({ granularidade, periodo, unidadeId }),
    enabled: periodos.isSuccess && periodo !== null,
  });
  const pendencias = useQuery({ queryKey: ['pendencias'], queryFn: buscarPendencias });

  const nomes = Object.fromEntries((kpis.data?.kpis ?? []).map((k) => [k.indicador, k.nome]));
  const rotuloAnterior = kpis.data?.periodoAnterior
    ? rotuloPeriodo(kpis.data.periodoAnterior, granularidade)
    : '';
  const unidadeSelecionada = unidades.data?.find((u) => u.id === unidadeId)?.nome ?? 'Rede inteira';

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 py-10 sm:px-6">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:rounded focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-contrast"
      >
        Pular para o conteúdo
      </a>

      <header className="mb-8">
        <p className="text-sm text-text-muted">Projeto de portfólio · dados fictícios</p>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard de indicadores</h1>
        <p className="mt-2 text-text-muted">
          Indicadores semanais de unidades de atendimento, consolidados por mês e por ano. As contas
          são feitas pelo banco (SQL).
        </p>
      </header>

      <main id="conteudo" className="space-y-6">
        <Filtros
          granularidade={granularidade}
          onGranularidade={(g) => {
            setGranularidade(g);
            setPeriodoEscolhido(null); // o período antigo não existe na nova visão
          }}
          periodos={periodos.data}
          periodo={periodo}
          onPeriodo={setPeriodoEscolhido}
          unidades={unidades.data}
          unidadeId={unidadeId}
          onUnidade={setUnidadeId}
        />

        <section aria-labelledby="titulo-kpis" aria-busy={kpis.isFetching}>
          <h2 id="titulo-kpis" className="mb-1 text-xl font-semibold">
            Indicadores
            {periodo && (
              <span className="ml-2 text-base font-normal text-text-muted">
                {rotuloPeriodo(periodo, granularidade)} · {unidadeSelecionada}
              </span>
            )}
          </h2>

          {(periodos.isPending || (periodo !== null && kpis.isPending)) && (
            <p role="status" className="mt-3">
              Carregando indicadores...
            </p>
          )}
          {periodos.isError && (
            <Erro mensagem={periodos.error.message} onRetry={() => void periodos.refetch()} />
          )}
          {kpis.isError && (
            <Erro mensagem={kpis.error.message} onRetry={() => void kpis.refetch()} />
          )}

          {periodos.isSuccess && periodo === null && (
            <p className="mt-3">
              Ainda não há dados. Rode <code>npm run seed</code> ou envie um CSV.
            </p>
          )}

          {kpis.data && (
            <div
              aria-live="polite"
              className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
              data-testid="grade-kpis"
            >
              {kpis.data.kpis.map((k) => (
                <CartaoKpi key={k.indicador} kpi={k} rotuloAnterior={rotuloAnterior} />
              ))}
            </div>
          )}
        </section>

        {pendencias.isPending && <p role="status">Carregando pendências...</p>}
        {pendencias.isError && (
          <Erro mensagem={pendencias.error.message} onRetry={() => void pendencias.refetch()} />
        )}
        {pendencias.data && (
          <PainelPendencias dados={pendencias.data} nomes={nomes} unidadeId={unidadeId} />
        )}
      </main>
    </div>
  );
}
