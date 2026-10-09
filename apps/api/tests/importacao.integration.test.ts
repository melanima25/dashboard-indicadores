import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import type { ImportacaoResponse, PendenciasResponse } from '@dashboard/shared';
import { createApp } from '../src/app';
import { gerarDadosSinteticos } from '../src/db/seed-data';
import { CAB, csv, formulario, prepararBanco } from './helpers';

const CHAVE = 'chave-de-teste-123456';
const HOJE = '2026-10-09';

let conexao: Awaited<ReturnType<typeof prepararBanco>>;
let app: ReturnType<typeof createApp>;
let appSemChave: ReturnType<typeof createApp>;

// semana que o seed deixou sem envio para a Unidade Norte, e uma semana que ela enviou
const dados = gerarDadosSinteticos();
const semanaAusente = dados.semanasAusentes.find(
  (s) => s.unidade === 'Unidade Norte',
)!.semanaInicio;
const semanaExistente = dados.lancamentos.find((l) => l.unidade === 'Unidade Norte')!.semanaInicio;
const completo = (extra: Record<string, number | string> = {}) => ({
  atendimentos_agendados: 100,
  faltas: 12,
  atendimentos_realizados: 88,
  tempo_medio_espera: '21,5',
  ...extra,
});

beforeAll(async () => {
  conexao = await prepararBanco();
  app = createApp(conexao.db, { adminKey: CHAVE, hoje: () => HOJE });
  appSemChave = createApp(conexao.db, { hoje: () => HOJE });
});
afterAll(async () => {
  await conexao.close();
});

async function n(consulta: string): Promise<number> {
  const r = await conexao.db.execute<{ n: number }>(
    sql.raw(`SELECT count(*)::int AS n ${consulta}`),
  );
  return r.rows[0]!.n;
}
const lancamentosNorte = (semana: string) =>
  n(`FROM lancamento_semanal l JOIN unidade u ON u.id = l.unidade_id
      WHERE u.nome = 'Unidade Norte' AND l.semana_inicio = '${semana}'`);

const pendencias = async () =>
  (await (await app.request('/api/pendencias')).json()) as PendenciasResponse;
const doNorte = (p: PendenciasResponse) => p.unidades.find((u) => u.nome === 'Unidade Norte')!;

const previa = (texto: string) =>
  app.request('/api/importacoes/previa', { method: 'POST', body: formulario(texto) });
const gravar = (texto: string, chave: string | null = CHAVE, a = app) =>
  a.request('/api/importacoes', {
    method: 'POST',
    body: formulario(texto),
    headers: chave ? { 'x-admin-key': chave } : {},
  });

describe('prévia: valida e mostra o efeito sem gravar', () => {
  it('semana nova: inseriria 4 lançamentos, substituiria 0 e o banco não muda', async () => {
    const antes = await n('FROM lancamento_semanal');
    const res = await previa(csv('Unidade Norte', semanaAusente, completo()));
    expect(res.status).toBe(200);
    const body = (await res.json()) as ImportacaoResponse;
    expect(body).toMatchObject({
      modo: 'previa',
      status: 'ok',
      unidade: 'Unidade Norte',
      semanaInicio: semanaAusente,
      inseridos: 4,
      substituidos: 0,
      importacaoId: null,
    });
    expect(await n('FROM lancamento_semanal')).toBe(antes);
    expect(await n('FROM importacao')).toBe(0);
  });

  it('semana já enviada: informa quantos lançamentos seriam substituídos', async () => {
    const res = await previa(csv('Unidade Norte', semanaExistente, completo()));
    expect(((await res.json()) as ImportacaoResponse).substituidos).toBe(4);
  });

  it('arquivo com erro: 422 e relatório linha a linha', async () => {
    const texto = csv(
      'Unidade Norte',
      semanaAusente,
      completo({ faltas: -3, tempo_medio_espera: 'abc' }),
    );
    const res = await previa(texto);
    expect(res.status).toBe(422);
    const body = (await res.json()) as ImportacaoResponse;
    expect(body.status).toBe('rejeitada');
    expect(body.inseridos).toBe(0);
    expect(body.erros.map((e) => `${e.linha}:${e.campo}`)).toEqual(['3:valor', '5:valor']);
    expect(body.linhasErro).toBe(2);
    expect(body.linhasOk).toBe(2);
  });

  it('aceita CSV puro (Content-Type: text/csv) e recusa tipos desconhecidos', async () => {
    const ok = await app.request('/api/importacoes/previa', {
      method: 'POST',
      body: csv('Unidade Norte', semanaAusente, completo()),
      headers: { 'content-type': 'text/csv', 'x-nome-arquivo': 'C:\\pasta\\sem.csv' },
    });
    const body = (await ok.json()) as ImportacaoResponse;
    expect(ok.status).toBe(200);
    expect(body.arquivoNome).toBe('sem.csv');

    const ruim = await app.request('/api/importacoes/previa', {
      method: 'POST',
      body: '{}',
      headers: { 'content-type': 'application/json' },
    });
    expect(ruim.status).toBe(415);
  });

  it('formulário sem o campo "arquivo" é 400; arquivo gigante é 413', async () => {
    const f = new FormData();
    f.append('outro', 'x');
    expect((await app.request('/api/importacoes/previa', { method: 'POST', body: f })).status).toBe(
      400,
    );

    const grande = await previa(`${CAB}\n${'x'.repeat(1_200_000)}`);
    expect(grande.status).toBe(413);
  });

  it('semana em andamento é recusada (hoje é quinta 09/10/2026)', async () => {
    const res = await previa(csv('Unidade Norte', '2026-10-05', completo()));
    expect(res.status).toBe(422);
    expect(((await res.json()) as ImportacaoResponse).erros[0]!.mensagem).toContain(
      'ainda não terminou',
    );
  });
});

describe('gravação protegida por chave', () => {
  it('sem chave configurada na instância: 403 (demo só faz prévia)', async () => {
    const res = await gravar(csv('Unidade Norte', semanaAusente, completo()), CHAVE, appSemChave);
    expect(res.status).toBe(403);
  });
  it('sem header ou com chave errada: 401, e nada é gravado', async () => {
    const texto = csv('Unidade Norte', semanaAusente, completo());
    expect((await gravar(texto, null)).status).toBe(401);
    expect((await gravar(texto, 'chave-errada-123456789')).status).toBe(401);
    expect(await lancamentosNorte(semanaAusente)).toBe(0);
    expect(await n('FROM importacao')).toBe(0);
  });
});

describe('gravar, reenviar (substituir) e histórico', () => {
  it('semana nova entra, fica ligada à importação e some das pendências', async () => {
    const antes = await pendencias();
    expect(doNorte(antes).semanasPendentes).toContain(semanaAusente);

    const res = await gravar(csv('Unidade Norte', semanaAusente, completo()));
    expect(res.status).toBe(200);
    const body = (await res.json()) as ImportacaoResponse;
    expect(body).toMatchObject({ modo: 'gravado', inseridos: 4, substituidos: 0 });
    expect(body.importacaoId).toBeGreaterThan(0);

    expect(await lancamentosNorte(semanaAusente)).toBe(4);
    expect(await n(`FROM lancamento_semanal WHERE importacao_id = ${body.importacaoId}`)).toBe(4);

    const depois = await pendencias();
    expect(doNorte(depois).semanasPendentes).not.toContain(semanaAusente);
    expect(depois.totalPendentes).toBe(antes.totalPendentes - 1);
  });

  it('reenviar a mesma semana SUBSTITUI: sem duplicar, valores novos, histórico com 2 envios', async () => {
    const res = await gravar(csv('Unidade Norte', semanaAusente, completo({ faltas: 20 })));
    const body = (await res.json()) as ImportacaoResponse;
    expect(body).toMatchObject({ status: 'ok', inseridos: 4, substituidos: 4 });

    expect(await lancamentosNorte(semanaAusente)).toBe(4);
    const r = await conexao.db.execute<{ valor: string }>(sql`
      SELECT l.valor FROM lancamento_semanal l
        JOIN indicador i ON i.id = l.indicador_id JOIN unidade u ON u.id = l.unidade_id
       WHERE u.nome = 'Unidade Norte' AND l.semana_inicio = ${semanaAusente} AND i.codigo = 'faltas'`);
    expect(Number(r.rows[0]!.valor)).toBe(20);
    expect(
      await n(`FROM importacao WHERE semana_inicio = '${semanaAusente}' AND status = 'ok'`),
    ).toBe(2);
  });

  it('reenvio com menos indicadores substitui o conjunto: a semana passa a "incompleta"', async () => {
    await gravar(csv('Unidade Norte', semanaAusente, { faltas: 5, atendimentos_agendados: 50 }));
    expect(await lancamentosNorte(semanaAusente)).toBe(2);
    expect(doNorte(await pendencias()).semanasIncompletas).toContainEqual({
      semana: semanaAusente,
      faltando: ['atendimentos_realizados', 'tempo_medio_espera'],
    });
  });

  it('arquivo com erro NÃO altera os lançamentos, mas o erro fica no histórico', async () => {
    const antes = await lancamentosNorte(semanaAusente);
    const res = await gravar(csv('Unidade Norte', semanaAusente, completo({ faltas: 999 })));
    expect(res.status).toBe(422); // faltas (999) > agendados (100)
    const body = (await res.json()) as ImportacaoResponse;
    expect(body.importacaoId).toBeGreaterThan(0);
    expect(await lancamentosNorte(semanaAusente)).toBe(antes);

    const log = await conexao.db.execute<{ linha: number; campo: string; mensagem: string }>(
      sql`SELECT linha, campo, mensagem FROM erro_importacao WHERE importacao_id = ${body.importacaoId}`,
    );
    expect(log.rows).toHaveLength(1);
    expect(log.rows[0]).toMatchObject({ linha: 3, campo: 'valor' });
    expect(await n(`FROM importacao WHERE status = 'rejeitada'`)).toBeGreaterThanOrEqual(1);
  });

  it('dois envios simultâneos da mesma semana não quebram o UNIQUE nem duplicam', async () => {
    const semana = dados.semanasAusentes.find((s) => s.unidade === 'Unidade Sul')!.semanaInicio;
    const [a, b] = await Promise.all([
      gravar(csv('Unidade Sul', semana, completo({ faltas: 1 }))),
      gravar(csv('Unidade Sul', semana, completo({ faltas: 2 }))),
    ]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(
      await n(`FROM lancamento_semanal l JOIN unidade u ON u.id = l.unidade_id
               WHERE u.nome = 'Unidade Sul' AND l.semana_inicio = '${semana}'`),
    ).toBe(4);
  });

  it('cabeçalho errado: 422 sem unidade/semana, nada registrado', async () => {
    const antes = await n('FROM importacao');
    const res = await gravar('unidade;semana;indicador;valor\nUnidade Norte;2024-01-01;faltas;1');
    expect(res.status).toBe(422);
    expect(((await res.json()) as ImportacaoResponse).importacaoId).toBeNull();
    expect(await n('FROM importacao')).toBe(antes);
  });
});
