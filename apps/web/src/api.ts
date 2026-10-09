import { z } from 'zod';
import {
  KpisResponseSchema,
  PendenciasResponseSchema,
  PeriodosResponseSchema,
  UnidadesResponseSchema,
  type Granularidade,
  type KpisResponse,
  type PendenciasResponse,
  type PeriodosResponse,
  type Unidade,
} from '@dashboard/shared';

/** GET com validação da resposta pelo mesmo schema Zod que a API usa. */
async function buscar<T>(caminho: string, schema: z.ZodType<T>): Promise<T> {
  const res = await fetch(caminho);
  if (!res.ok) {
    let detalhe = '';
    try {
      const corpo: unknown = await res.json();
      if (corpo && typeof corpo === 'object' && 'erro' in corpo)
        detalhe = `: ${String(corpo.erro)}`;
    } catch {
      /* corpo não era JSON */
    }
    throw new Error(`A API respondeu ${res.status}${detalhe}`);
  }
  return schema.parse(await res.json());
}

export async function buscarUnidades(): Promise<Unidade[]> {
  return (await buscar('/api/unidades', UnidadesResponseSchema)).unidades;
}

export function buscarPeriodos(g: Granularidade): Promise<PeriodosResponse> {
  return buscar(`/api/periodos?granularidade=${g}`, PeriodosResponseSchema);
}

export function buscarKpis(args: {
  granularidade: Granularidade;
  periodo: string | null;
  unidadeId: number | null;
}): Promise<KpisResponse> {
  const p = new URLSearchParams({ granularidade: args.granularidade });
  if (args.periodo) p.set('periodo', args.periodo);
  if (args.unidadeId !== null) p.set('unidadeId', String(args.unidadeId));
  return buscar(`/api/kpis?${p}`, KpisResponseSchema);
}

export function buscarPendencias(): Promise<PendenciasResponse> {
  return buscar('/api/pendencias', PendenciasResponseSchema);
}
