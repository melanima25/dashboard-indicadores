import { z } from 'zod';

export const UnidadeSchema = z.object({
  id: z.number().int().positive(),
  nome: z.string().min(1),
  ativa: z.boolean(),
});
export type Unidade = z.infer<typeof UnidadeSchema>;

export const UnidadesResponseSchema = z.object({ unidades: z.array(UnidadeSchema) });
export type UnidadesResponse = z.infer<typeof UnidadesResponseSchema>;

export const HealthResponseSchema = z.object({ status: z.literal('ok') });

export const TipoIndicadorSchema = z.enum(['soma', 'taxa', 'media']);
export type TipoIndicador = z.infer<typeof TipoIndicadorSchema>;

// ---------- Importação ----------
export const ErroLinhaSchema = z.object({
  linha: z.number().int().min(0),
  campo: z.string().nullable(),
  mensagem: z.string(),
});

export const ImportacaoResponseSchema = z.object({
  modo: z.enum(['previa', 'gravado']),
  arquivoNome: z.string(),
  status: z.enum(['ok', 'rejeitada']),
  unidade: z.string().nullable(),
  semanaInicio: z.string().nullable(),
  linhasLidas: z.number().int(),
  linhasOk: z.number().int(),
  linhasErro: z.number().int(),
  erros: z.array(ErroLinhaSchema),
  avisos: z.array(z.string()),
  /** prévia: o que ACONTECERIA; gravado: o que aconteceu */
  inseridos: z.number().int(),
  substituidos: z.number().int(),
  importacaoId: z.number().int().nullable(),
});
export type ImportacaoResponse = z.infer<typeof ImportacaoResponseSchema>;

// ---------- Consulta ----------
export const GranularidadeSchema = z.enum(['semanal', 'mensal', 'anual']);
export const AgruparSchema = z.enum(['rede', 'unidade']);
const DataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'use AAAA-MM-DD');

export const ConsolidadoQuerySchema = z.object({
  granularidade: GranularidadeSchema.default('mensal'),
  agrupar: AgruparSchema.default('rede'),
  de: DataIso.optional(),
  ate: DataIso.optional(),
  unidadeId: z.coerce.number().int().positive().optional(),
  indicador: z.string().min(1).optional(),
});

export const PendenciasQuerySchema = z.object({ de: DataIso.optional(), ate: DataIso.optional() });

export const IndicadorSchema = z.object({
  codigo: z.string(),
  nome: z.string(),
  unidadeMedida: z.string(),
  tipo: TipoIndicadorSchema,
});
export const IndicadoresResponseSchema = z.object({ indicadores: z.array(IndicadorSchema) });

export const ItemConsolidadoSchema = z.object({
  periodo: z.string(),
  unidadeId: z.number().int().nullable(),
  indicador: z.string(),
  valor: z.number().nullable(),
  numerador: z.number().nullable(),
  denominador: z.number().nullable(),
  semanasInformadas: z.number().int(),
  semanasEsperadas: z.number().int(),
});
export const ConsolidadoResponseSchema = z.object({
  granularidade: GranularidadeSchema,
  agrupar: AgruparSchema,
  itens: z.array(ItemConsolidadoSchema),
});
export type ConsolidadoResponse = z.infer<typeof ConsolidadoResponseSchema>;

export const PendenciasResponseSchema = z.object({
  de: z.string().nullable(),
  ate: z.string().nullable(),
  semanasEsperadas: z.number().int(),
  totalPendentes: z.number().int(),
  totalIncompletas: z.number().int(),
  unidades: z.array(
    z.object({
      unidadeId: z.number().int(),
      nome: z.string(),
      semanasPendentes: z.array(z.string()),
      semanasIncompletas: z.array(z.object({ semana: z.string(), faltando: z.array(z.string()) })),
    }),
  ),
});
export type PendenciasResponse = z.infer<typeof PendenciasResponseSchema>;

// ---------- KPIs e períodos ----------
export const MedidaSchema = z.object({
  valor: z.number().nullable(),
  numerador: z.number().nullable(),
  denominador: z.number().nullable(),
  semanasInformadas: z.number().int(),
  semanasEsperadas: z.number().int(),
});
export type Medida = z.infer<typeof MedidaSchema>;

export const KpiSchema = z.object({
  indicador: z.string(),
  nome: z.string(),
  unidadeMedida: z.string(),
  tipo: TipoIndicadorSchema,
  atual: MedidaSchema.nullable(),
  anterior: MedidaSchema.nullable(),
  variacao: z.object({ tipo: z.enum(['percentual', 'pontos']), valor: z.number().nullable() }),
});
export type Kpi = z.infer<typeof KpiSchema>;

export const KpisQuerySchema = z.object({
  granularidade: GranularidadeSchema.default('mensal'),
  periodo: z.string().optional(),
  unidadeId: z.coerce.number().int().positive().optional(),
});

export const KpisResponseSchema = z.object({
  granularidade: GranularidadeSchema,
  periodo: z.string().nullable(),
  periodoAnterior: z.string().nullable(),
  unidadeId: z.number().int().nullable(),
  kpis: z.array(KpiSchema),
});
export type KpisResponse = z.infer<typeof KpisResponseSchema>;

export const PeriodosQuerySchema = z.object({
  granularidade: GranularidadeSchema.default('mensal'),
});
export const PeriodosResponseSchema = z.object({
  granularidade: GranularidadeSchema,
  /** períodos com dados, do mais recente para o mais antigo */
  periodos: z.array(z.string()),
  padrao: z.string().nullable(),
});
export type PeriodosResponse = z.infer<typeof PeriodosResponseSchema>;
