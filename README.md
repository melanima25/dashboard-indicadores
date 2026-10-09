# Dashboard de indicadores

Sistema que importa planilhas semanais de indicadores enviadas por várias unidades de atendimento, valida, consolida em visões mensais e anuais e mostra o resultado em um dashboard.

> **Aviso: este projeto usa somente dados fictícios.** As unidades ("Unidade Norte", "Unidade Sul"...), os indicadores e todos os números são gerados por um script com semente fixa. Não há dados, nomes ou arquivos de nenhuma instituição, setor ou pessoa real. É um projeto de demonstração para portfólio.

## Status: Semana 1 (base do projeto)

Feito:

- Monorepo com npm workspaces (`apps/web`, `apps/api`, `packages/shared`), TypeScript strict, ESLint, Prettier.
- PostgreSQL com Drizzle ORM: schema (`unidade`, `indicador`, `importacao`, `lancamento_semanal` com `UNIQUE`, `erro_importacao`) e migration gerada.
- Gerador de dados sintéticos (`npm run seed`): 6 unidades, 5 indicadores, 104 semanas (2024-2025), com sazonalidade e semanas ausentes de propósito.
- `packages/shared`: regra do mês de referência da semana (ISO 8601) e recálculo de taxa, com testes Vitest.
- API Hono: `GET /api/health` e `GET /api/unidades`; variáveis de ambiente validadas com Zod.
- Web (React + Vite + Tailwind + TanStack Query): página que lista as unidades vindas da API.
- CI no GitHub Actions: lint, formatação, typecheck, Vitest, testes de integração com Postgres, build. Sem deploy.

## Próximos passos

1. Importação de CSV com validação linha a linha e relatório de erros.
2. Consolidação semanal, mensal e anual, painel de pendências.
3. Dashboard (KPIs, gráficos, filtros, tabela, exportação CSV).
4. Testes ponta a ponta, deploy e screenshots.

## Como rodar localmente (Windows com Docker Desktop)

Pré-requisitos: [Node.js 22](https://nodejs.org/) (há um `.nvmrc`), Git e Docker Desktop aberto e rodando.

```powershell
git clone https://github.com/melanima25/dashboard-indicadores.git
cd dashboard-indicadores

docker compose up -d                  # sobe o PostgreSQL local
Copy-Item .env.example .env           # no cmd.exe: copy .env.example .env
npm install
npm run db:migrate                    # cria as tabelas
npm run seed                          # gera os dados fictícios
npm run dev                           # API em :3000 e web em :5173
```

Abra <http://localhost:5173>. A API responde em <http://localhost:3000/api/health>.

Outros comandos: `npm run lint`, `npm run typecheck`, `npm test` (unitários), `npm run test:integration` (precisa de um banco de teste; veja abaixo), `npm run build`.

### Testes de integração

Usam um Postgres real e **apagam o schema do banco apontado**. Por segurança, só rodam se o nome do banco contiver `test`:

```powershell
docker compose exec db psql -U dashboard -c "CREATE DATABASE dashboard_test"
$env:DATABASE_URL="postgres://dashboard:dashboard@localhost:5432/dashboard_test"
npm run test:integration
```

## Estrutura

```
apps/api/            API Hono + Drizzle
  src/db/schema.ts     tabelas
  src/db/client.ts     único arquivo que conhece o driver do Postgres
  src/db/seed-data.ts  gerador sintético (puro, com semente fixa)
  drizzle/             migrations geradas
  tests/               testes de integração
apps/web/            React + Vite + Tailwind + TanStack Query
packages/shared/     schemas Zod, tipos e funções puras (semana ISO, taxa)
.github/workflows/   CI
```

## Decisões

- **Drizzle ORM:** deixa o SQL visível, o que ajuda num projeto de agregação, e as migrations ficam em SQL legível.
- **Hono:** API parecida com a do Express, que roda em Node e também em ambientes serverless/edge. O driver do banco fica isolado em `apps/api/src/db/client.ts` para poder trocar depois sem mexer no resto.
- **Regra ISO 8601 da quinta-feira:** uma semana (segunda a domingo) pertence ao mês da sua quinta-feira, ou seja, ao mês que contém a maioria dos seus dias. Assim cada semana entra em exatamente um mês e a conta não se duplica na virada. Exemplo: a semana de 30/12/2024 a 05/01/2025 conta em janeiro de 2025.
- **Taxa se recalcula, não se faz média:** absenteísmo = soma das faltas ÷ soma dos agendados. Média de percentuais dá peso igual a semanas de volumes diferentes e erra (teste em `packages/shared/src/taxa.test.ts`).
- **Tempo médio de espera:** tipo `media` (acrescentado ao modelo original, que previa só `soma` e `taxa`). A forma de consolidar (ponderar por atendimentos) ainda será decidida na Semana 2.
- **Semana sem envio não é zero:** no seed, algumas semanas ficam sem lançamentos de propósito, para representar "pendente" mais adiante.
- **O banco protege os dados:** `UNIQUE (unidade, indicador, semana)`, valor não negativo e semana sempre começando na segunda-feira são `CHECK`s no próprio Postgres.

## Uso de IA no desenvolvimento

Este projeto foi desenvolvido com apoio de IA (Claude, da Anthropic), que gerou parte do código, dos testes e da documentação. As decisões de escopo e a revisão do resultado são do autor.
