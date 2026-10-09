import { UnidadesResponseSchema, type Unidade } from '@dashboard/shared';

export async function buscarUnidades(): Promise<Unidade[]> {
  const res = await fetch('/api/unidades');
  if (!res.ok) throw new Error(`A API respondeu ${res.status}`);
  // valida a resposta na borda com o mesmo schema Zod que a API usa
  return UnidadesResponseSchema.parse(await res.json()).unidades;
}
