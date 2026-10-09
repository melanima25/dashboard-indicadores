import { z } from 'zod';

const EnvSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1, 'DATABASE_URL é obrigatória')
    .refine((v) => /^postgres(ql)?:\/\//.test(v), 'DATABASE_URL deve começar com postgres://'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  // Chave que autoriza GRAVAR importações. Sem ela, a API só faz prévia (modo demo seguro).
  ADMIN_KEY: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().min(16, 'ADMIN_KEY deve ter pelo menos 16 caracteres').optional(),
  ),
});

export type Env = z.infer<typeof EnvSchema>;

/** Valida variáveis de ambiente; falha cedo com mensagem legível (sem imprimir valores). */
export function parseEnv(source: Record<string, string | undefined> = process.env): Env {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    const problemas = result.error.issues
      .map((i) => `- ${i.path.join('.') || 'env'}: ${i.message}`)
      .join('\n');
    throw new Error(`Variáveis de ambiente inválidas:\n${problemas}`);
  }
  return result.data;
}
