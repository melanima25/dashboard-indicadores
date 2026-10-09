import { createHash, timingSafeEqual } from 'node:crypto';
import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { asc, eq } from 'drizzle-orm';
import {
  ConsolidadoQuerySchema,
  ConsolidadoResponseSchema,
  HealthResponseSchema,
  KpisQuerySchema,
  KpisResponseSchema,
  PeriodosQuerySchema,
  PeriodosResponseSchema,
  calcularVariacao,
  limitesDoPeriodo,
  periodoAnterior,
  periodoPadrao,
  periodoValido,
  type Medida,
  type ItemConsolidado,
  ImportacaoResponseSchema,
  IndicadoresResponseSchema,
  LIMITE_BYTES,
  PendenciasQuerySchema,
  PendenciasResponseSchema,
  UnidadesResponseSchema,
  calcularPendencias,
  finalizarItens,
  segundaDaSemana,
  segundasEntre,
  ultimaSemanaConcluida,
} from '@dashboard/shared';
import { schema, type Db } from './db/client';
import { decodificarCsv, nomeSeguro } from './importacao/decodificar';
import { carregarIndicadores, processarImportacao } from './importacao/servico';
import {
  agregarSql,
  carregarLancamentos,
  limitesDosDados,
  periodosComDados,
} from './consolidacao/consultas';

export type AppOptions = {
  /** Chave que autoriza gravar importações. Sem ela, só existe a prévia. */
  adminKey?: string;
  /** Data de hoje (AAAA-MM-DD, fuso de São Paulo). Injetável para os testes. */
  hoje?: () => string;
};

const hojeEmSaoPaulo = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

const MAX_SEMANAS_PENDENCIAS = 530; // ~10 anos

function chaveConfere(informada: string | undefined, esperada: string): boolean {
  if (!informada) return false;
  // compara hashes de tamanho fixo em tempo constante
  const a = createHash('sha256').update(informada).digest();
  const b = createHash('sha256').update(esperada).digest();
  return timingSafeEqual(a, b);
}

export function createApp(db: Db, options: AppOptions = {}) {
  const app = new Hono();
  const hoje = options.hoje ?? hojeEmSaoPaulo;

  app.get('/api/health', (c) => c.json(HealthResponseSchema.parse({ status: 'ok' })));

  app.get('/api/unidades', async (c) => {
    const rows = await db
      .select({ id: schema.unidade.id, nome: schema.unidade.nome, ativa: schema.unidade.ativa })
      .from(schema.unidade)
      .orderBy(asc(schema.unidade.id));
    return c.json(UnidadesResponseSchema.parse({ unidades: rows }));
  });

  app.get('/api/indicadores', async (c) => {
    const rows = await db.select().from(schema.indicador).orderBy(asc(schema.indicador.id));
    return c.json(
      IndicadoresResponseSchema.parse({
        indicadores: rows.map((r) => ({
          codigo: r.codigo,
          nome: r.nome,
          unidadeMedida: r.unidadeMedida,
          tipo: r.tipo,
        })),
      }),
    );
  });

  // ---------------- importação ----------------
  const limite = bodyLimit({
    maxSize: LIMITE_BYTES + 100_000, // o arquivo (1 MB) mais o envelope multipart
    onError: (c) => c.json({ erro: 'Arquivo maior que 1 MB' }, 413),
  });

  async function lerUpload(c: Context): Promise<{ texto: string; arquivoNome: string } | Response> {
    const tipo = c.req.header('content-type') ?? '';
    if (tipo.startsWith('multipart/form-data')) {
      const corpo = await c.req.parseBody();
      const arquivo = corpo['arquivo'];
      if (!(arquivo instanceof File))
        return c.json({ erro: 'Envie o arquivo CSV no campo "arquivo"' }, 400);
      if (arquivo.size > LIMITE_BYTES) return c.json({ erro: 'Arquivo maior que 1 MB' }, 413);
      return {
        texto: decodificarCsv(await arquivo.arrayBuffer()),
        arquivoNome: nomeSeguro(arquivo.name),
      };
    }
    if (tipo.startsWith('text/csv') || tipo.startsWith('text/plain')) {
      return {
        texto: decodificarCsv(await c.req.arrayBuffer()),
        arquivoNome: nomeSeguro(c.req.header('x-nome-arquivo')),
      };
    }
    return c.json(
      { erro: 'Use multipart/form-data (campo "arquivo") ou Content-Type: text/csv' },
      415,
    );
  }

  async function importar(c: Context, gravar: boolean) {
    const upload = await lerUpload(c);
    if (upload instanceof Response) return upload;
    const resultado = await processarImportacao(db, { ...upload, gravar, hoje: hoje() });
    // 422: o pedido foi entendido, mas o conteúdo do arquivo não passou na validação
    return c.json(ImportacaoResponseSchema.parse(resultado), resultado.status === 'ok' ? 200 : 422);
  }

  // Prévia: valida e mostra o efeito, sem gravar nada. Aberta (é o que a demo pública usa).
  app.post('/api/importacoes/previa', limite, (c) => importar(c, false));

  // Gravação: exige a chave de administrador.
  app.post('/api/importacoes', limite, (c) => {
    if (!options.adminKey)
      return c.json(
        { erro: 'Gravação desabilitada nesta instância (use /api/importacoes/previa)' },
        403,
      );
    if (!chaveConfere(c.req.header('x-admin-key'), options.adminKey))
      return c.json({ erro: 'Chave de administrador ausente ou inválida' }, 401);
    return importar(c, true);
  });

  // ---------------- consultas ----------------
  app.get('/api/consolidado', async (c) => {
    const q = ConsolidadoQuerySchema.safeParse(c.req.query());
    if (!q.success)
      return c.json(
        { erro: 'Parâmetros inválidos', detalhes: q.error.issues.map((i) => i.message) },
        400,
      );
    const f = q.data;
    if (f.de && f.ate && f.de > f.ate)
      return c.json({ erro: '"de" deve ser anterior a "ate"' }, 400);

    const indicadores = await carregarIndicadores(db);
    if (f.indicador && !indicadores.some((i) => i.codigo === f.indicador))
      return c.json({ erro: `Indicador "${f.indicador}" não existe` }, 400);
    const unidades = await db.select().from(schema.unidade).where(eq(schema.unidade.ativa, true));
    if (f.unidadeId !== undefined && !unidades.some((u) => u.id === f.unidadeId))
      return c.json({ erro: `Unidade ${f.unidadeId} não existe ou está inativa` }, 400);

    const agregados = await agregarSql(db, f);
    const itens = finalizarItens(agregados, {
      indicadores,
      granularidade: f.granularidade,
      hoje: hoje(),
      de: f.de,
      ate: f.ate,
      unidadesNaRede: f.unidadeId !== undefined ? 1 : unidades.length,
    });
    return c.json(
      ConsolidadoResponseSchema.parse({
        granularidade: f.granularidade,
        agrupar: f.agrupar,
        itens,
      }),
    );
  });

  app.get('/api/periodos', async (c) => {
    const q = PeriodosQuerySchema.safeParse(c.req.query());
    if (!q.success) return c.json({ erro: 'Granularidade inválida' }, 400);
    const g = q.data.granularidade;
    const [periodos, limites] = await Promise.all([periodosComDados(db, g), limitesDosDados(db)]);
    return c.json(
      PeriodosResponseSchema.parse({
        granularidade: g,
        periodos,
        padrao: limites ? periodoPadrao(g, limites.ultima, hoje()) : null,
      }),
    );
  });

  // Cartões de KPI: valor do período, valor do período anterior e variação.
  app.get('/api/kpis', async (c) => {
    const q = KpisQuerySchema.safeParse(c.req.query());
    if (!q.success)
      return c.json(
        { erro: 'Parâmetros inválidos', detalhes: q.error.issues.map((i) => i.message) },
        400,
      );
    const { granularidade: g, unidadeId } = q.data;

    const limites = await limitesDosDados(db);
    const periodo = q.data.periodo ?? (limites ? periodoPadrao(g, limites.ultima, hoje()) : null);
    if (periodo !== null && !periodoValido(periodo, g))
      return c.json({ erro: `Período "${periodo}" inválido para a granularidade ${g}` }, 400);
    const vazio = {
      granularidade: g,
      periodo,
      periodoAnterior: null,
      unidadeId: unidadeId ?? null,
      kpis: [],
    };
    if (periodo === null) return c.json(KpisResponseSchema.parse(vazio));

    const unidades = await db.select().from(schema.unidade).where(eq(schema.unidade.ativa, true));
    if (unidadeId !== undefined && !unidades.some((u) => u.id === unidadeId))
      return c.json({ erro: `Unidade ${unidadeId} não existe ou está inativa` }, 400);
    const [indicadoresRegra, indicadoresDb] = await Promise.all([
      carregarIndicadores(db),
      db.select().from(schema.indicador).orderBy(asc(schema.indicador.id)),
    ]);

    const anterior = periodoAnterior(periodo, g);
    const medir = async (p: string): Promise<Map<string, Medida>> => {
      const { de, ate } = limitesDoPeriodo(p, g);
      const filtros = { granularidade: g, agrupar: 'rede' as const, de, ate, unidadeId };
      const itens: ItemConsolidado[] = finalizarItens(await agregarSql(db, filtros), {
        indicadores: indicadoresRegra,
        granularidade: g,
        hoje: hoje(),
        de,
        ate,
        unidadesNaRede: unidadeId !== undefined ? 1 : unidades.length,
      });
      return new Map(
        itens.map((i) => [
          i.indicador,
          {
            valor: i.valor,
            numerador: i.numerador,
            denominador: i.denominador,
            semanasInformadas: i.semanasInformadas,
            semanasEsperadas: i.semanasEsperadas,
          },
        ]),
      );
    };
    const [medidasAtuais, medidasAnteriores] = await Promise.all([medir(periodo), medir(anterior)]);

    const kpis = indicadoresDb.map((ind) => {
      const atual = medidasAtuais.get(ind.codigo) ?? null;
      const ant = medidasAnteriores.get(ind.codigo) ?? null;
      return {
        indicador: ind.codigo,
        nome: ind.nome,
        unidadeMedida: ind.unidadeMedida,
        tipo: ind.tipo,
        atual,
        anterior: ant,
        variacao: calcularVariacao(ind.tipo, atual?.valor ?? null, ant?.valor ?? null),
      };
    });
    return c.json(
      KpisResponseSchema.parse({
        granularidade: g,
        periodo,
        periodoAnterior: anterior,
        unidadeId: unidadeId ?? null,
        kpis,
      }),
    );
  });

  app.get('/api/pendencias', async (c) => {
    const q = PendenciasQuerySchema.safeParse(c.req.query());
    if (!q.success)
      return c.json(
        { erro: 'Parâmetros inválidos', detalhes: q.error.issues.map((i) => i.message) },
        400,
      );

    const limites = await limitesDosDados(db);
    const vazio = PendenciasResponseSchema.parse({
      de: null,
      ate: null,
      semanasEsperadas: 0,
      totalPendentes: 0,
      totalIncompletas: 0,
      unidades: [],
    });
    if (!limites) return c.json(vazio);

    // Padrão: do começo dos dados até a última semana concluída que os dados alcançam.
    const concluida = ultimaSemanaConcluida(hoje());
    let de: string;
    let ate: string;
    try {
      de = segundaDaSemana(q.data.de ?? limites.primeira);
      ate = segundaDaSemana(q.data.ate ?? limites.ultima);
    } catch {
      return c.json({ erro: 'Data inexistente' }, 400);
    }
    if (ate > concluida) ate = concluida;
    if (de > ate) return c.json({ ...vazio, de, ate });
    const semanas = segundasEntre(de, ate);
    if (semanas.length > MAX_SEMANAS_PENDENCIAS)
      return c.json(
        { erro: `Intervalo grande demais (máximo ${MAX_SEMANAS_PENDENCIAS} semanas)` },
        400,
      );

    const [unidades, indicadores, lancs] = await Promise.all([
      db
        .select()
        .from(schema.unidade)
        .where(eq(schema.unidade.ativa, true))
        .orderBy(asc(schema.unidade.id)),
      carregarIndicadores(db),
      carregarLancamentos(db, de, ate),
    ]);
    const presentes = new Map<string, Set<string>>();
    for (const l of lancs) {
      const k = `${l.unidadeId}|${l.semanaInicio}`;
      (presentes.get(k) ?? presentes.set(k, new Set()).get(k)!).add(l.indicador);
    }
    const porUnidade = calcularPendencias({
      unidades,
      semanas,
      presentes,
      importaveis: indicadores.filter((i) => i.tipo !== 'taxa').map((i) => i.codigo),
    });
    return c.json(
      PendenciasResponseSchema.parse({
        de,
        ate,
        semanasEsperadas: semanas.length,
        totalPendentes: porUnidade.reduce((s, u) => s + u.semanasPendentes.length, 0),
        totalIncompletas: porUnidade.reduce((s, u) => s + u.semanasIncompletas.length, 0),
        unidades: porUnidade,
      }),
    );
  });

  app.notFound((c) => c.json({ erro: 'Rota não encontrada' }, 404));
  app.onError((err, c) => {
    console.error(err);
    return c.json({ erro: 'Erro interno' }, 500);
  });

  return app;
}
