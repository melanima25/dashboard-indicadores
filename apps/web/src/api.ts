import { z } from 'zod';
import {
  ConsolidadoResponseSchema,
  ImportacaoResponseSchema,
  IndicadoresResponseSchema,
  KpisResponseSchema,
  PendenciasResponseSchema,
  PeriodosResponseSchema,
  UnidadesResponseSchema,
  type ConsolidadoResponse,
  type Granularidade,
  type ImportacaoResponse,
  type Indicador,
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

export async function buscarIndicadores(): Promise<Indicador[]> {
  return (await buscar('/api/indicadores', IndicadoresResponseSchema)).indicadores;
}

export function buscarConsolidado(args: {
  granularidade: Granularidade;
  agrupar: 'rede' | 'unidade';
  indicador: string;
  de: string;
  ate: string;
  unidadeId?: number | null;
}): Promise<ConsolidadoResponse> {
  const p = new URLSearchParams({
    granularidade: args.granularidade,
    agrupar: args.agrupar,
    indicador: args.indicador,
    de: args.de,
    ate: args.ate,
  });
  if (args.unidadeId != null) p.set('unidadeId', String(args.unidadeId));
  return buscar(`/api/consolidado?${p}`, ConsolidadoResponseSchema);
}

/**
 * Envia um CSV. `gravar=false` é a prévia (não escreve nada). Arquivo rejeitado volta como 422
 * COM o relatório de erros no corpo, então o corpo é lido mesmo quando o status não é 2xx.
 */
export async function enviarCsv(args: {
  arquivo: File;
  gravar: boolean;
  chave?: string;
}): Promise<ImportacaoResponse> {
  const form = new FormData();
  form.set('arquivo', args.arquivo);
  const res = await fetch(args.gravar ? '/api/importacoes' : '/api/importacoes/previa', {
    method: 'POST',
    body: form,
    headers: args.chave ? { 'X-Admin-Key': args.chave } : undefined,
  });
  let corpo: unknown = null;
  try {
    corpo = await res.json();
  } catch {
    /* sem corpo JSON */
  }
  const lido = ImportacaoResponseSchema.safeParse(corpo);
  if (lido.success) return lido.data;
  const detalhe =
    corpo && typeof corpo === 'object' && 'erro' in corpo
      ? String(corpo.erro)
      : `status ${res.status}`;
  throw new Error(detalhe);
}
