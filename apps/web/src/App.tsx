import { useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  janelaDeTendencia,
  limitesDoPeriodo,
  periodoAnterior,
  JANELA_TENDENCIA,
  type Granularidade,
} from '@dashboard/shared';
import {
  buscarConsolidado,
  buscarIndicadores,
  buscarKpis,
  buscarPendencias,
  buscarPeriodos,
  buscarUnidades,
} from './api';
import { CartaoKpi } from './components/CartaoKpi';
import { Filtros } from './components/Filtros';
import { PainelImportacao } from './components/PainelImportacao';
import { PainelPendencias } from './components/PainelPendencias';
import { GraficoBarras } from './components/graficos/GraficoBarras';
import { GraficoLinha } from './components/graficos/GraficoLinha';
import { TabelaConsolidada, type LinhaTabela } from './components/TabelaConsolidada';
import { baixarCsv, csvDaTabela, nomeDoArquivo } from './exportar';
import { rotuloPeriodo, textoCobertura } from './format';

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
  const [indicadorEscolhido, setIndicadorEscolhido] = useState<string | null>(null);

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
  const indicadores = useQuery({ queryKey: ['indicadores'], queryFn: buscarIndicadores });
  const indicador = indicadorEscolhido ?? indicadores.data?.[0]?.codigo ?? null;
  const metaIndicador = indicadores.data?.find((i) => i.codigo === indicador);

  const pronto = periodo !== null && indicador !== null;
  // evolução: últimos períodos até o escolhido, da unidade escolhida (ou da rede)
  const tendencia = useQuery({
    queryKey: ['tendencia', granularidade, periodo, indicador, unidadeId],
    queryFn: () =>
      buscarConsolidado({
        granularidade,
        agrupar: 'rede',
        indicador: indicador as string,
        ...janelaDeTendencia(periodo as string, granularidade),
        unidadeId,
      }),
    enabled: pronto,
    placeholderData: keepPreviousData,
  });
  // comparação: todas as unidades no período (a escolhida ganha destaque)
  const porUnidade = useQuery({
    queryKey: ['por-unidade', granularidade, periodo, indicador],
    queryFn: () =>
      buscarConsolidado({
        granularidade,
        agrupar: 'unidade',
        indicador: indicador as string,
        ...limitesDoPeriodo(periodo as string, granularidade),
      }),
    enabled: pronto,
    placeholderData: keepPreviousData,
  });
  const redeNoPeriodo = useQuery({
    queryKey: ['rede-periodo', granularidade, periodo, indicador],
    queryFn: () =>
      buscarConsolidado({
        granularidade,
        agrupar: 'rede',
        indicador: indicador as string,
        ...limitesDoPeriodo(periodo as string, granularidade),
      }),
    enabled: pronto,
    placeholderData: keepPreviousData,
  });
  const pendencias = useQuery({ queryKey: ['pendencias'], queryFn: buscarPendencias });

  const nomes = Object.fromEntries((kpis.data?.kpis ?? []).map((k) => [k.indicador, k.nome]));
  const rotuloAnterior = kpis.data?.periodoAnterior
    ? rotuloPeriodo(kpis.data.periodoAnterior, granularidade)
    : '';
  const unidadeSelecionada = unidades.data?.find((u) => u.id === unidadeId)?.nome ?? 'Rede inteira';

  // ---- dados derivados dos gráficos e da tabela (as contas já vieram do banco) ----
  const listaUnidades = unidades.data ?? [];
  const janela: string[] = [];
  if (periodo) {
    let p = periodo;
    for (let i = 0; i < JANELA_TENDENCIA[granularidade]; i++) {
      janela.unshift(p);
      p = periodoAnterior(p, granularidade);
    }
  }
  const pontosTendencia = janela.map((per) => ({
    periodo: per,
    valor: tendencia.data?.itens.find((it) => it.periodo === per)?.valor ?? null,
  }));
  const itemUnidade = (id: number) =>
    porUnidade.data?.itens.find((it) => it.unidadeId === id) ?? null;
  const barras = listaUnidades.map((u) => {
    const it = itemUnidade(u.id);
    return {
      id: u.id,
      nome: u.nome,
      valor: it?.valor ?? null,
      detalhe: it ? textoCobertura(it.semanasInformadas, it.semanasEsperadas) : 'Sem dados',
    };
  });
  const linhasTabela: LinhaTabela[] = [
    { chave: 'rede', nome: 'Rede inteira', item: redeNoPeriodo.data?.itens[0] ?? null },
    ...listaUnidades.map((u) => ({ chave: `u${u.id}`, nome: u.nome, item: itemUnidade(u.id) })),
  ];
  const rotuloPer = periodo ? rotuloPeriodo(periodo, granularidade) : '';
  const carregandoGraficos =
    tendencia.isFetching || porUnidade.isFetching || redeNoPeriodo.isFetching;

  function exportar() {
    if (!periodo || !indicador || !metaIndicador) return;
    const linhas = linhasTabela.flatMap((l) => (l.item ? [{ unidade: l.nome, item: l.item }] : []));
    baixarCsv(csvDaTabela(linhas, metaIndicador.nome), nomeDoArquivo(indicador, periodo));
  }

  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 py-10 sm:px-6">
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
          indicadores={indicadores.data}
          indicador={indicador}
          onIndicador={setIndicadorEscolhido}
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

        {pronto && metaIndicador && (
          <section aria-labelledby="titulo-graficos" aria-busy={carregandoGraficos}>
            <h2 id="titulo-graficos" className="mb-3 text-xl font-semibold">
              {metaIndicador.nome}{' '}
              <span className="ml-2 text-base font-normal text-text-muted">em gráficos</span>
            </h2>
            {(tendencia.isError || porUnidade.isError || redeNoPeriodo.isError) && (
              <Erro
                mensagem={
                  (tendencia.error ?? porUnidade.error ?? redeNoPeriodo.error)?.message ?? ''
                }
                onRetry={() => {
                  void tendencia.refetch();
                  void porUnidade.refetch();
                  void redeNoPeriodo.refetch();
                }}
              />
            )}
            <div className="grid gap-4 lg:grid-cols-2">
              <GraficoLinha
                titulo={`Evolução · ${unidadeSelecionada}`}
                nomeIndicador={metaIndicador.nome}
                unidadeMedida={metaIndicador.unidadeMedida}
                granularidade={granularidade}
                pontos={pontosTendencia}
                atenuado={tendencia.isPlaceholderData || tendencia.isFetching}
              />
              <GraficoBarras
                titulo={`Comparação entre unidades · ${rotuloPer}`}
                nomeIndicador={metaIndicador.nome}
                unidadeMedida={metaIndicador.unidadeMedida}
                barras={barras}
                destaqueId={unidadeId}
                atenuado={porUnidade.isPlaceholderData || porUnidade.isFetching}
              />
            </div>
          </section>
        )}

        {pronto && metaIndicador && (
          <TabelaConsolidada
            titulo={rotuloPer}
            nomeIndicador={metaIndicador.nome}
            unidadeMedida={metaIndicador.unidadeMedida}
            tipo={metaIndicador.tipo}
            linhas={linhasTabela}
            destaqueId={unidadeId}
            onExportar={exportar}
            podeExportar={porUnidade.isSuccess && !porUnidade.isPlaceholderData}
            atenuado={porUnidade.isPlaceholderData || redeNoPeriodo.isPlaceholderData}
          />
        )}

        <PainelImportacao />

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
