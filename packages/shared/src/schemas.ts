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
