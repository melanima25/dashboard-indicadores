import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node22',
  clean: true,
  // o pacote compartilhado exporta TypeScript puro; embute no bundle
  noExternal: ['@dashboard/shared'],
});
