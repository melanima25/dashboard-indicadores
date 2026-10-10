# Dashboard de indicadores

Sistema que importa planilhas semanais de indicadores enviadas por várias unidades de atendimento, valida, consolida em visões mensais e anuais e mostra o resultado em um dashboard.

> **Aviso: este projeto usa somente dados fictícios.** As unidades ("Unidade Norte", "Unidade Sul"...), os indicadores e todos os números são gerados por um script com semente fixa. Não há dados, nomes ou arquivos de nenhuma instituição, setor ou pessoa real. É um projeto de demonstração para portfólio.

**Demo online:** https://dashboard-indicadores.brenojf19.workers.dev/ (dados fictícios; a demo só faz prévia de importação, não grava)

![Demonstração do dashboard: filtros, gráficos, tooltip e tabela](docs/demo.gif)

| Desktop                                     | Celular                                  |
| ------------------------------------------- | ---------------------------------------- |
| ![Dashboard no desktop](docs/dashboard.png) | ![Dashboard no celular](docs/mobile.png) |

## Status: Semana 5 (deploy na Cloudflare + Neon)

Feito até aqui:

- **Semana 1:** monorepo (npm workspaces), TypeScript strict, PostgreSQL + Drizzle, gerador de dados fictícios (`npm run seed`), API Hono e CI no GitHub Actions.
- **Semana 2:** importação de CSV com validação linha a linha e relatório de erros, reenvio que substitui a semana, prévia sem gravar, consolidação semanal/mensal/anual em SQL e painel de pendências (ver "Regras de consolidação" e "API").
- **Semana 3:** tela com filtros de visão (semanal, mensal, anual), período e unidade; cartões de KPI com variação em relação ao período anterior e indicação de cobertura; painel de pendências. Rotas `/api/kpis` e `/api/periodos`.
- **Semana 5:** a API roda também em Cloudflare Workers (mesmo código, só uma entrada nova) servindo a tela e a API juntas, com Postgres no Neon via Hyperdrive. A demo pública só faz prévia de importação. Ver "Deploy".
- **Semana 4:** filtro de indicador; gráfico de linha (evolução) e de barras (comparação entre unidades), ambos com tooltip, teclado e tabela equivalente; tabela consolidada com exportação CSV; painel de importação (prévia, relatório de erros por linha e gravação); testes ponta a ponta com Playwright e checagem de acessibilidade com axe.

Próximos passos:

1. Publicar o link da demo aqui e no portfólio; depois, o próximo projeto do roadmap (CRM de advocacia fictício).

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

### Testes ponta a ponta (Playwright)

Abrem um navegador de verdade (Chromium) contra a tela, a API e o Postgres. Antes de rodar, o teste recria as tabelas e repõe os dados fictícios, e um dos testes **grava uma importação**; por isso não aponte para um banco com dados que você queira manter.

```powershell
npx playwright install chromium     # só na primeira vez (baixa o navegador)
npm run test:e2e
```

O que é verificado: KPIs, gráficos e tabela aparecem; o filtro de indicador muda tudo; a exportação gera o CSV esperado; o fluxo "arquivo com erro, relatório com a linha, correção, gravação e tela atualizada"; chave errada é recusada; nenhuma violação de acessibilidade (axe, WCAG A/AA); sem rolagem horizontal no celular.

### Testes de integração

Usam um Postgres real e **apagam o schema do banco apontado**. Por segurança, só rodam se o nome do banco contiver `test`:

```powershell
docker compose exec db psql -U dashboard -c "CREATE DATABASE dashboard_test"
$env:DATABASE_URL="postgres://dashboard:dashboard@localhost:5432/dashboard_test"
npm run test:integration
```

## Formato do CSV

Um arquivo por **unidade e semana**. Separador `;` ou `,`, cabeçalho obrigatório, valores com vírgula ou ponto decimal (até 2 casas, sem separador de milhar):

```csv
unidade;semana_inicio;indicador;valor
Unidade Norte;2025-04-21;atendimentos_agendados;540
Unidade Norte;2025-04-21;faltas;61
Unidade Norte;2025-04-21;atendimentos_realizados;479
Unidade Norte;2025-04-21;tempo_medio_espera;22,5
```

Há dois exemplos prontos em [`exemplos/`](exemplos): `semana-valida.csv` e `semana-com-erros.csv`.

Cada linha é validada e o relatório diz a linha e o campo de cada problema: valor negativo ou não numérico, data inválida, data que não é segunda-feira (a mensagem sugere a segunda correta), semana que ainda não terminou, unidade ou indicador desconhecido, indicador repetido, taxa enviada (ela é calculada, não enviada), faltas maiores que agendados, arquivo com mais de uma unidade ou semana, mais de 500 linhas ou mais de 1 MB. Arquivos do Excel em português (Windows-1252) também são lidos.

**Arquivo com qualquer erro é rejeitado inteiro.** Aceitar só parte das linhas deixaria, por exemplo, faltas gravadas sem os agendados, e a taxa ficaria errada. A tentativa e os erros ficam no histórico (`importacao` e `erro_importacao`).

**Reenviar a mesma unidade e semana substitui** o que existia, numa única transação (um bloqueio do Postgres evita que dois envios simultâneos colidam).

## Regras de consolidação

1. **A semana pertence ao mês (e ao ano) da sua quinta-feira** (ISO 8601). Cada semana entra em exatamente um mês, e os 12 meses somam o ano.
2. **Indicador de soma** (atendimentos, faltas): soma dos valores informados.
3. **Indicador de taxa** (absenteísmo): soma dos numeradores ÷ soma dos denominadores, **só nas semanas em que os dois existem**. Nunca média de percentuais: com 1 falta em 10 agendados (10%) e 50 em 100 (50%), a taxa real é 51/110 = 46,4%, e a média simples daria 30%.
4. **Indicador de média** (tempo de espera): média simples dos valores informados. _Limitação conhecida: não pondera pelo volume de atendimentos; decidir se vale ponderar é um dos pontos a revisar._
5. **Semana não enviada não vira zero.** Fica fora da conta, e a resposta traz `semanasInformadas` e `semanasEsperadas` para mostrar a cobertura (ex.: 3 de 4). Só contam como esperadas semanas já concluídas e unidades ativas.

O SQL (`apps/api/src/consolidacao/consultas.ts`) e uma versão em memória (`packages/shared/src/consolidacao.ts`) implementam as mesmas regras, e os testes de integração exigem resultado idêntico em 9 combinações de filtros sobre os dados do seed. Também há um caso calculado à mão (março/2025) e uma comparação do mês/ano do SQL com o do TypeScript em 15 anos de segundas-feiras.

### Variação nos cartões de KPI

- **Soma e média** variam em **%** em relação ao período anterior (semana anterior, mês anterior, ano anterior).
- **Taxa** varia em **pontos percentuais** (12% para 15% é +3 p.p.): "+25%" sobre um percentual confunde.
- Sem valor no período anterior, ou anterior igual a zero em soma/média, não há variação (aparece "sem comparação"): nada de infinito nem zero inventado.
- As setas são neutras de propósito: faltas subindo e atendimentos subindo têm sentidos opostos, e o dashboard não decide o que é bom ou ruim.
- Cada cartão mostra a **cobertura** ("22 de 24 envios": unidades × semanas). Menos que o esperado vira aviso de período incompleto.

## API

| Rota                           | O que faz                                                                                                                                                              |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/health`              | Verifica se a API está de pé.                                                                                                                                          |
| `GET /api/unidades`            | Lista as unidades.                                                                                                                                                     |
| `GET /api/indicadores`         | Lista os indicadores (código, nome, unidade de medida, tipo).                                                                                                          |
| `POST /api/importacoes/previa` | Valida o CSV e mostra o que aconteceria, **sem gravar**. Aberta.                                                                                                       |
| `POST /api/importacoes`        | Grava. Exige o header `X-Admin-Key` igual à variável `ADMIN_KEY`; sem ela configurada, devolve 403.                                                                    |
| `GET /api/consolidado`         | Consolidação. Parâmetros: `granularidade` (semanal, mensal, anual), `agrupar` (rede, unidade), `de`, `ate` (sobre a quinta-feira da semana), `unidadeId`, `indicador`. |
| `GET /api/periodos`            | Períodos que têm dados (do mais recente ao mais antigo) e o período padrão: o da última semana com dados que já terminou. Parâmetro `granularidade`.                   |
| `GET /api/kpis`                | Cartões de KPI: valor do período, do período anterior e variação. Parâmetros `granularidade`, `periodo` (ex.: `2025-03`) e `unidadeId`.                                |
| `GET /api/pendencias`          | Semanas concluídas sem envio e semanas incompletas por unidade. Parâmetros opcionais `de` e `ate`.                                                                     |

Importação válida responde 200; arquivo que não passa na validação responde 422 com o relatório.

### Testando a importação (Windows, PowerShell, com a API rodando)

```powershell
# prévia de um arquivo válido (não grava nada)
curl.exe -F "arquivo=@exemplos/semana-valida.csv" http://localhost:3000/api/importacoes/previa

# prévia de um arquivo com erros (resposta 422 com a lista de linhas)
curl.exe -F "arquivo=@exemplos/semana-com-erros.csv" http://localhost:3000/api/importacoes/previa

# gravar (a chave de desenvolvimento está no .env.example)
curl.exe -H "X-Admin-Key: chave-local-de-desenvolvimento" -F "arquivo=@exemplos/semana-valida.csv" http://localhost:3000/api/importacoes

# conferir
curl.exe "http://localhost:3000/api/consolidado?granularidade=mensal&de=2025-04-01&ate=2025-04-30"
curl.exe http://localhost:3000/api/pendencias
```

Use `curl.exe` (e não `curl`): no PowerShell, `curl` é um apelido de outro comando.

## Estrutura

```
apps/api/            API Hono + Drizzle (src/index.ts: Node; src/worker.ts: Cloudflare; wrangler.jsonc)
  src/db/schema.ts     tabelas
  src/db/client.ts     único arquivo que conhece o driver do Postgres
  src/db/seed-data.ts  gerador sintético (puro, com semente fixa)
  drizzle/             migrations geradas
  src/importacao/      leitura do arquivo e gravação da importação
  src/consolidacao/    consultas SQL de consolidação
  tests/               testes de integração (Postgres real)
apps/web/            React + Vite + Tailwind + TanStack Query (src/components, src/components/graficos, src/format.ts)
docs/                imagens do README
e2e/                 testes ponta a ponta (Playwright + axe)
packages/shared/     schemas Zod, validação de CSV e regras de consolidação (funções puras)
exemplos/            CSVs de exemplo para testar a importação
.github/workflows/   CI
```

## Deploy (Cloudflare Workers + Neon)

Um único Worker entrega a tela (arquivos estáticos de `apps/web/dist`) e a API (`/api/*`). O banco é um Postgres no Neon, acessado pelo Hyperdrive (pool de conexões da Cloudflare). O app Hono é o mesmo do servidor local: `apps/api/src/worker.ts` só monta a conexão e entrega as requisições.

1. Crie um projeto no [Neon](https://neon.tech) e copie a connection string (host sem `-pooler`).
2. Crie as tabelas e os dados fictícios nesse banco:

```powershell
$env:DATABASE_URL="COLE_A_CONNECTION_STRING_AQUI"
npm run db:migrate
npm run seed
Remove-Item Env:DATABASE_URL
```

3. Na Cloudflare: `npx wrangler login`, depois crie o Hyperdrive e copie o `id` que ele mostra para `apps/api/wrangler.jsonc`:

```powershell
npx wrangler hyperdrive create dashboard-neon --connection-string="COLE_A_CONNECTION_STRING_AQUI"
```

4. Publique: `npm run deploy`. O endereço sai no final (`https://dashboard-indicadores.<sua-conta>.workers.dev`).

Sem `ADMIN_KEY` configurada, a demo só aceita prévia de importação: gravar responde 403. Para testar o Worker localmente: `npm run cf:dev -w @dashboard/api` (usa o banco local pelo Hyperdrive local; defina `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` se o seu banco não for o do `docker compose`).

## Gráficos

Dois tipos, escolhidos pelo trabalho que cada um faz:

- **Linha:** evolução de um indicador no tempo (12 semanas, 12 meses ou 5 anos até o período escolhido). Período sem envio **quebra a linha**; não vira zero.
- **Barras horizontais:** comparação entre unidades no período. Com uma unidade escolhida no filtro, ela fica colorida e as demais em cinza (ênfase).

Regras aplicadas: uma série por gráfico (sem legenda, o título diz o que é), traço de 2 px, barras finas com base no zero, grade em fio de 1 px, valor só na ponta, cursor que acompanha o período, tooltip, setas do teclado no gráfico de linha e uma tabela equivalente em cada gráfico ("Ver dados do gráfico em tabela"). A cor (azul, slot 1 da paleta categórica no passo escuro) foi validada contra a superfície do tema escuro. Os gráficos são SVG escrito à mão (a matemática de escala é pura e testada em `components/graficos/escala.ts`), sem biblioteca de gráficos.

## Exportação CSV

O botão "Exportar CSV" baixa a tabela como está na tela (mesmo período e indicador): separador `;`, BOM e fim de linha CRLF, para abrir direto no Excel brasileiro. Textos que começam com `=`, `+`, `-` ou `@` recebem um apóstrofo na frente para a planilha não executá-los como fórmula.

## Decisões

- **Drizzle ORM:** deixa o SQL visível, o que ajuda num projeto de agregação, e as migrations ficam em SQL legível.
- **Hono:** API parecida com a do Express, que roda em Node e também em ambientes serverless/edge. O driver do banco fica isolado em `apps/api/src/db/client.ts` para poder trocar depois sem mexer no resto.
- **Regra ISO 8601 da quinta-feira:** uma semana (segunda a domingo) pertence ao mês da sua quinta-feira, ou seja, ao mês que contém a maioria dos seus dias. Assim cada semana entra em exatamente um mês e a conta não se duplica na virada. Exemplo: a semana de 30/12/2024 a 05/01/2025 conta em janeiro de 2025.
- **Taxa se recalcula, não se faz média:** absenteísmo = soma das faltas ÷ soma dos agendados. Média de percentuais dá peso igual a semanas de volumes diferentes e erra (teste em `packages/shared/src/taxa.test.ts`).
- **Tempo médio de espera:** tipo `media` (acrescentado ao modelo original, que previa só `soma` e `taxa`). Consolidado por média simples; ver a limitação em "Regras de consolidação".
- **Semana sem envio não é zero:** no seed, algumas semanas ficam sem lançamentos de propósito, e o painel de pendências lista exatamente essas.
- **Gravar exige chave:** a demo pública só faz prévia; o `ADMIN_KEY` é comparado em tempo constante e nunca vai para o repositório.
- **Um Worker só para tela e API:** mesma origem (sem CORS), um deploy e um endereço. `run_worker_first` manda só `/api/*` para o código; o resto é arquivo estático.
- **Hyperdrive + `pg` em vez de driver serverless:** o código de acesso ao banco continua o mesmo do local e do CI (inclusive transações e `pg_advisory_xact_lock` da importação), validado rodando o Worker de verdade.
- **Gráficos em SVG próprio:** são só dois tipos, e assim o desenho, a acessibilidade e o tooltip ficam sob controle e testáveis, sem uma dependência a mais.
- **O banco protege os dados:** `UNIQUE (unidade, indicador, semana)`, valor não negativo e semana sempre começando na segunda-feira são `CHECK`s no próprio Postgres.

## Uso de IA no desenvolvimento

Este projeto foi desenvolvido com apoio de IA (Claude, da Anthropic), que gerou parte do código, dos testes e da documentação. As decisões de escopo e a revisão do resultado são do autor.
