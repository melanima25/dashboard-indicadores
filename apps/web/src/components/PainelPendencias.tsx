import type { PendenciasResponse } from '@dashboard/shared';
import { formatarData } from '../format';

type Props = {
  dados: PendenciasResponse;
  /** código do indicador -> nome para exibir */
  nomes: Record<string, string>;
  unidadeId: number | null;
};

export function PainelPendencias({ dados, nomes, unidadeId }: Props) {
  const unidades = dados.unidades.filter(
    (u) =>
      (unidadeId === null || u.unidadeId === unidadeId) &&
      (u.semanasPendentes.length > 0 || u.semanasIncompletas.length > 0),
  );
  const totalPendentes = unidades.reduce((s, u) => s + u.semanasPendentes.length, 0);
  const totalIncompletas = unidades.reduce((s, u) => s + u.semanasIncompletas.length, 0);

  return (
    <section
      aria-labelledby="titulo-pendencias"
      className="rounded-lg border border-border bg-surface p-5"
    >
      <h2 id="titulo-pendencias" className="text-xl font-semibold">
        Pendências de envio
      </h2>
      <p className="mt-1 text-sm text-text-muted">
        {dados.de && dados.ate
          ? `Semanas já concluídas, de ${formatarData(dados.de)} a ${formatarData(dados.ate)}. Semana sem envio não é contada como zero.`
          : 'Ainda não há dados.'}
      </p>

      {unidades.length === 0 ? (
        <p className="mt-4" role="status">
          Nenhuma pendência.
        </p>
      ) : (
        <>
          <p className="mt-4" role="status">
            <strong>{totalPendentes}</strong>{' '}
            {totalPendentes === 1 ? 'semana sem envio' : 'semanas sem envio'}
            {totalIncompletas > 0 && (
              <>
                {' '}
                e <strong>{totalIncompletas}</strong>{' '}
                {totalIncompletas === 1 ? 'semana incompleta' : 'semanas incompletas'}
              </>
            )}
            .
          </p>
          <div className="mt-3 space-y-2">
            {unidades.map((u) => (
              <details key={u.unidadeId} className="rounded border border-border px-3 py-2">
                <summary className="cursor-pointer">
                  {u.nome}{' '}
                  <span className="text-sm text-warn">
                    ({u.semanasPendentes.length} sem envio
                    {u.semanasIncompletas.length > 0 &&
                      `, ${u.semanasIncompletas.length} incompleta(s)`}
                    )
                  </span>
                </summary>
                <ul className="mt-2 list-disc space-y-1 pl-6 text-sm">
                  {u.semanasPendentes.map((s) => (
                    <li key={`p-${s}`}>Semana de {formatarData(s)}: nada enviado</li>
                  ))}
                  {u.semanasIncompletas.map((i) => (
                    <li key={`i-${i.semana}`}>
                      Semana de {formatarData(i.semana)}: faltou{' '}
                      {i.faltando.map((c) => nomes[c] ?? c).join(', ')}
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
