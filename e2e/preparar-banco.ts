import { execSync } from 'node:child_process';

/** Antes dos testes: tabelas em dia e dados fictícios de volta ao estado inicial. */
export default function preparar() {
  const opcoes = { stdio: 'inherit', env: process.env } as const;
  execSync('npm run db:migrate -w @dashboard/api', opcoes);
  execSync('npm run seed -w @dashboard/api', opcoes);
}
