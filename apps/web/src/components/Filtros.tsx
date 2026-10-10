import type { Granularidade, Indicador, PeriodosResponse, Unidade } from '@dashboard/shared';
import { rotuloPeriodo } from '../format';

const GRANULARIDADES: { valor: Granularidade; rotulo: string }[] = [
  { valor: 'mensal', rotulo: 'Mensal' },
  { valor: 'semanal', rotulo: 'Semanal' },
  { valor: 'anual', rotulo: 'Anual' },
];

type Props = {
  granularidade: Granularidade;
  onGranularidade: (g: Granularidade) => void;
  periodos: PeriodosResponse | undefined;
  periodo: string | null;
  onPeriodo: (p: string) => void;
  unidades: Unidade[] | undefined;
  unidadeId: number | null;
  onUnidade: (id: number | null) => void;
  indicadores: Indicador[] | undefined;
  indicador: string | null;
  onIndicador: (codigo: string) => void;
};

const campo =
  'w-full rounded border border-border bg-bg px-3 py-2 text-text focus:border-accent disabled:opacity-60';

export function Filtros(p: Props) {
  return (
    <section
      aria-label="Filtros"
      className="grid gap-4 rounded-lg border border-border bg-surface p-5 sm:grid-cols-2 lg:grid-cols-4"
    >
      <div>
        <label htmlFor="f-granularidade" className="mb-1 block text-sm text-text-muted">
          Visão
        </label>
        <select
          id="f-granularidade"
          className={campo}
          value={p.granularidade}
          onChange={(e) => p.onGranularidade(e.target.value as Granularidade)}
        >
          {GRANULARIDADES.map((g) => (
            <option key={g.valor} value={g.valor}>
              {g.rotulo}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="f-periodo" className="mb-1 block text-sm text-text-muted">
          Período
        </label>
        <select
          id="f-periodo"
          className={campo}
          value={p.periodo ?? ''}
          disabled={!p.periodos || p.periodos.periodos.length === 0}
          onChange={(e) => p.onPeriodo(e.target.value)}
        >
          {(p.periodos?.periodos ?? []).map((per) => (
            <option key={per} value={per}>
              {rotuloPeriodo(per, p.granularidade)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="f-unidade" className="mb-1 block text-sm text-text-muted">
          Unidade
        </label>
        <select
          id="f-unidade"
          className={campo}
          value={p.unidadeId ?? ''}
          disabled={!p.unidades}
          onChange={(e) => p.onUnidade(e.target.value === '' ? null : Number(e.target.value))}
        >
          <option value="">Rede inteira</option>
          {(p.unidades ?? []).map((u) => (
            <option key={u.id} value={u.id}>
              {u.nome}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="f-indicador" className="mb-1 block text-sm text-text-muted">
          Indicador (gráficos e tabela)
        </label>
        <select
          id="f-indicador"
          className={campo}
          value={p.indicador ?? ''}
          disabled={!p.indicadores}
          onChange={(e) => p.onIndicador(e.target.value)}
        >
          {(p.indicadores ?? []).map((i) => (
            <option key={i.codigo} value={i.codigo}>
              {i.nome}
            </option>
          ))}
        </select>
      </div>
    </section>
  );
}
