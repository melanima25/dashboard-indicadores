import { describe, expect, it } from 'vitest';
import { parseEnv } from './env';

describe('parseEnv', () => {
  it('aceita configuração válida e aplica padrões', () => {
    const env = parseEnv({ DATABASE_URL: 'postgres://u:p@localhost:5432/db' });
    expect(env.PORT).toBe(3000);
    expect(env.NODE_ENV).toBe('development');
  });

  it('falha sem DATABASE_URL', () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });

  it('falha com URL que não é postgres e não vaza o valor', () => {
    expect(() => parseEnv({ DATABASE_URL: 'mysql://segredo' })).toThrow(/postgres:\/\//);
    expect(() => parseEnv({ DATABASE_URL: 'mysql://segredo' })).not.toThrow(/segredo/);
  });
});
