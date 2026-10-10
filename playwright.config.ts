import { defineConfig, devices } from '@playwright/test';

const PORTA_API = 3100;
const PORTA_WEB = 5273;
export const CHAVE_ADMIN_E2E = 'chave-e2e-somente-para-testes';

/**
 * Testes ponta a ponta: navegador real -> Vite -> API -> Postgres.
 * Usa o DATABASE_URL do ambiente; o globalSetup recria as tabelas e repõe os dados fictícios.
 * (Os testes gravam uma importação, então não aponte para um banco com dados que você queira manter.)
 */
export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/preparar-banco.ts',
  fullyParallel: false,
  workers: 1, // os testes compartilham o mesmo banco
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORTA_WEB}`,
    trace: 'retain-on-failure',
    locale: 'pt-BR',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run dev -w @dashboard/api',
      url: `http://127.0.0.1:${PORTA_API}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: { PORT: String(PORTA_API), ADMIN_KEY: CHAVE_ADMIN_E2E, NODE_ENV: 'test' },
    },
    {
      command: `npm run dev -w @dashboard/web -- --port ${PORTA_WEB} --strictPort --host 127.0.0.1`,
      url: `http://127.0.0.1:${PORTA_WEB}`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: { API_URL: `http://127.0.0.1:${PORTA_API}` },
    },
  ],
});
