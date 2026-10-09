/**
 * Regras de consolidação (semanal -> mensal -> anual), em funções puras.
 *
 * 1. Semana pertence ao mês (e ao ano) da sua QUINTA-FEIRA (ISO 8601).
 * 2. Indicador de SOMA: soma dos valores informados.
 * 3. Indicador de TAXA (ex.: absenteísmo): recalculada = soma dos numeradores ÷ soma dos
 *    denominadores, só nas semanas em que os DOIS existem. Nunca média de percentuais.
 * 4. Indicador de MÉDIA (ex.: tempo de espera): média simples dos valores informados.
 * 5. Semana não enviada NÃO vira zero: fica fora da conta e aparece como pendência/cobertura.
 *
 * O banco faz essa conta em SQL (apps/api/src/consolidacao). A versão em memória daqui é a
 * "referência": os testes de integração exigem que as duas deem o mesmo resultado.
 */
import { calcularTaxa } from './taxa';
import { quintaDaSemana, segundaDaSemana, semanaConcluida, somarDias } from './semana';
import type { IndicadorRegra } from './csv';

export type Granularidade = 'semanal' | 'mensal' | 'anual';
export type Agrupar = 'rede' | 'unidade';

export type LancamentoRef = {
  unidadeId: number;
  indicador: string;
  semanaInicio: string;
  valor: number;
};

/** Resultado "cru" da agregação (vem do SQL ou da versão em memória), antes de calcular a taxa. */
export type Agregado = {
  periodo: string;
  unidadeId: number | null;
  indicador: string;
  /** soma (indicador de soma) ou média (indicador de média); nulo para taxa */
  valorBruto: number | null;
  numerador: number | null;
  denominador: number | null;
  /** nº de pares unidade-semana que entraram na conta */
  semanasInformadas: number;
};

export type ItemConsolidado = {
  periodo: string;
  unidadeId: number | null;
  indicador: string;
  /** taxa em % (0 a 100); null quando indefinida (denominador zero) */
  valor: number | null;
  numerador: number | null;
  denominador: number | null;
  semanasInformadas: number;
  semanasEsperadas: number;
};

export type FiltrosConsolidacao = {
  granularidade: Granularidade;
  agrupar: Agrupar;
  /** limites sobre a QUINTA-FEIRA da semana (AAAA-MM-DD), inclusive */
  de?: string;
  ate?: string;
  unidadeId?: number;
  indicador?: string;
};

export function chavePeriodo(semanaInicio: string, g: Granularidade): string {
  if (g === 'semanal') return semanaInicio;
  const quinta = quintaDaSemana(semanaInicio);
  return g === 'mensal' ? quinta.slice(0, 7) : quinta.slice(0, 4);
}

/** Segundas-feiras das semanas que pertencem ao período (pela regra da quinta-feira). */
export function semanasDoPeriodo(periodo: string, g: Granularidade): string[] {
  if (g === 'semanal') return [periodo];
  const primeiroDia = g === 'mensal' ? `${periodo}-01` : `${periodo}-01-01`;
  const ultimoDia = g === 'mensal' ? somarDias(`${periodo}-01`, 32) : `${periodo}-12-31`;
  const out: string[] = [];
  for (let s = somarDias(segundaDaSemana(primeiroDia), -7); s <= ultimoDia; s = somarDias(s, 7))
    if (chavePeriodo(s, g) === periodo) out.push(s);
  return out;
}

const dentro = (semanaInicio: string, de?: string, ate?: string) => {
  const q = quintaDaSemana(semanaInicio);
  return (de === undefined || q >= de) && (ate === undefined || q <= ate);
};

/** Versão em memória da agregação: serve de referência para validar o SQL. */
export function agregarEmMemoria(
  lancamentos: readonly LancamentoRef[],
  indicadores: readonly IndicadorRegra[],
  f: FiltrosConsolidacao,
): Agregado[] {
  const base = lancamentos.filter(
    (l) =>
      (f.unidadeId === undefined || l.unidadeId === f.unidadeId) &&
      dentro(l.semanaInicio, f.de, f.ate),
  );
  const chaveGrupo = (l: LancamentoRef) =>
    `${chavePeriodo(l.semanaInicio, f.granularidade)}|${f.agrupar === 'unidade' ? l.unidadeId : ''}`;
  const out: Agregado[] = [];

  for (const ind of indicadores) {
    if (f.indicador !== undefined && ind.codigo !== f.indicador) continue;
    const grupos = new Map<
      string,
      {
        periodo: string;
        unidadeId: number | null;
        soma: number;
        num: number;
        den: number;
        n: number;
      }
    >();
    const acumular = (l: LancamentoRef, valor: number, num: number, den: number) => {
      const k = chaveGrupo(l);
      const g = grupos.get(k) ?? {
        periodo: chavePeriodo(l.semanaInicio, f.granularidade),
        unidadeId: f.agrupar === 'unidade' ? l.unidadeId : null,
        soma: 0,
        num: 0,
        den: 0,
        n: 0,
      };
      g.soma += valor;
      g.num += num;
      g.den += den;
      g.n += 1;
      grupos.set(k, g);
    };

    if (ind.tipo === 'taxa') {
      const nums = new Map<string, LancamentoRef>();
      const dens = new Map<string, number>();
      for (const l of base) {
        const k = `${l.unidadeId}|${l.semanaInicio}`;
        if (l.indicador === ind.numeradorCodigo) nums.set(k, l);
        if (l.indicador === ind.denominadorCodigo) dens.set(k, l.valor);
      }
      for (const [k, l] of nums) {
        const den = dens.get(k);
        if (den !== undefined) acumular(l, 0, l.valor, den);
      }
    } else {
      for (const l of base) if (l.indicador === ind.codigo) acumular(l, l.valor, 0, 0);
    }

    for (const g of grupos.values())
      out.push({
        periodo: g.periodo,
        unidadeId: g.unidadeId,
        indicador: ind.codigo,
        valorBruto: ind.tipo === 'taxa' ? null : ind.tipo === 'media' ? g.soma / g.n : g.soma,
        numerador: ind.tipo === 'taxa' ? g.num : null,
        denominador: ind.tipo === 'taxa' ? g.den : null,
        semanasInformadas: g.n,
      });
  }
  return out;
}

export type ContextoFinalizacao = {
  indicadores: readonly IndicadorRegra[];
  granularidade: Granularidade;
  hoje: string;
  de?: string;
  ate?: string;
  /** nº de unidades ativas consideradas quando o agrupamento é "rede" */
  unidadesNaRede: number;
};

/** Calcula a taxa, a cobertura (informadas × esperadas) e ordena. Igual para SQL e memória. */
export function finalizarItens(
  agregados: readonly Agregado[],
  ctx: ContextoFinalizacao,
): ItemConsolidado[] {
  const ordem = new Map(ctx.indicadores.map((i, idx) => [i.codigo, idx]));
  const tipo = new Map(ctx.indicadores.map((i) => [i.codigo, i.tipo]));

  const itens = agregados.map((a): ItemConsolidado => {
    let valor: number | null;
    if (tipo.get(a.indicador) === 'taxa') {
      const t = calcularTaxa(a.numerador ?? 0, a.denominador ?? 0);
      valor = t === null ? null : t * 100;
    } else valor = a.valorBruto;

    const semanas = semanasDoPeriodo(a.periodo, ctx.granularidade).filter(
      (s) => semanaConcluida(s, ctx.hoje) && dentro(s, ctx.de, ctx.ate),
    ).length;
    return {
      periodo: a.periodo,
      unidadeId: a.unidadeId,
      indicador: a.indicador,
      valor,
      numerador: a.numerador,
      denominador: a.denominador,
      semanasInformadas: a.semanasInformadas,
      semanasEsperadas: semanas * (a.unidadeId === null ? ctx.unidadesNaRede : 1),
    };
  });

  return itens.sort(
    (x, y) =>
      x.periodo.localeCompare(y.periodo) ||
      (x.unidadeId ?? 0) - (y.unidadeId ?? 0) ||
      (ordem.get(x.indicador) ?? 0) - (ordem.get(y.indicador) ?? 0),
  );
}

export type PendenciaIncompleta = { semana: string; faltando: string[] };
export type PendenciasUnidade = {
  unidadeId: number;
  nome: string;
  /** semanas concluídas em que a unidade não enviou nada */
  semanasPendentes: string[];
  /** semanas enviadas, mas sem algum indicador */
  semanasIncompletas: PendenciaIncompleta[];
};

/**
 * `presentes` mapeia "unidadeId|semana" -> indicadores recebidos. Ausência da chave = pendente
 * (nunca zero). `semanas` já deve conter só semanas concluídas.
 */
export function calcularPendencias(args: {
  unidades: readonly { id: number; nome: string }[];
  semanas: readonly string[];
  presentes: ReadonlyMap<string, ReadonlySet<string>>;
  importaveis: readonly string[];
}): PendenciasUnidade[] {
  return args.unidades.map((u) => {
    const semanasPendentes: string[] = [];
    const semanasIncompletas: PendenciaIncompleta[] = [];
    for (const semana of args.semanas) {
      const recebidos = args.presentes.get(`${u.id}|${semana}`);
      if (!recebidos || recebidos.size === 0) semanasPendentes.push(semana);
      else {
        const faltando = args.importaveis.filter((c) => !recebidos.has(c));
        if (faltando.length > 0) semanasIncompletas.push({ semana, faltando });
      }
    }
    return { unidadeId: u.id, nome: u.nome, semanasPendentes, semanasIncompletas };
  });
}
