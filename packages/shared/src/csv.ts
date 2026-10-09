/**
 * Validação de CSV de lançamentos semanais, em funções PURAS (sem banco, sem rede).
 * Formato: cabeçalho `unidade;semana_inicio;indicador;valor` (vírgula ou ponto e vírgula).
 * Um arquivo = uma unidade + uma semana. Taxas (ex.: absenteísmo) NÃO são enviadas: são calculadas.
 */
import Papa from 'papaparse';
import { dataIsoValida, ehSegunda, nomeDoDia, segundaDaSemana, semanaConcluida } from './semana';
import type { TipoIndicador } from './schemas';

export const COLUNAS_CSV = ['unidade', 'semana_inicio', 'indicador', 'valor'] as const;
export const LIMITE_BYTES = 1_000_000;
export const LIMITE_LINHAS = 500;
export const VALOR_MAXIMO = 1_000_000_000;
export const ANO_MINIMO = 2000;

export type IndicadorRegra = {
  codigo: string;
  tipo: TipoIndicador;
  numeradorCodigo?: string | null;
  denominadorCodigo?: string | null;
};

export type ContextoValidacao = {
  /** nomes das unidades ATIVAS cadastradas */
  unidades: readonly string[];
  indicadores: readonly IndicadorRegra[];
  /** data de hoje (AAAA-MM-DD); injetada para o teste ser determinístico */
  hoje: string;
};

export type ErroLinha = { linha: number; campo: string | null; mensagem: string };
export type LinhaValida = { linha: number; indicador: string; valor: number };

export type ResultadoValidacao = {
  unidade: string | null;
  semanaInicio: string | null;
  linhasLidas: number;
  linhasValidas: LinhaValida[];
  erros: ErroLinha[];
  avisos: string[];
};

/** minúsculas, sem acento, sem espaços nas pontas: para comparar nomes sem frescura. */
function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
}

/** Aceita 12, 12,5 e 12.5 (até 2 casas). Sem separador de milhar: seria ambíguo (1.234 = 1,234?). */
export function parseValor(bruto: string): { valor: number } | { erro: string } {
  const t = bruto.trim();
  if (t === '') return { erro: 'valor é obrigatório' };
  if (t.startsWith('-')) return { erro: `valor não pode ser negativo (${t})` };
  if (!/^\d+([.,]\d+)?$/.test(t)) {
    return {
      erro: `valor inválido "${t}": use só dígitos e vírgula ou ponto decimal, sem separador de milhar`,
    };
  }
  const [, decimais = ''] = t.split(/[.,]/);
  if (decimais.length > 2) return { erro: `valor "${t}" tem mais de 2 casas decimais` };
  const n = Number(t.replace(',', '.'));
  if (n > VALOR_MAXIMO)
    return { erro: `valor acima do limite (${VALOR_MAXIMO.toLocaleString('pt-BR')})` };
  return { valor: n };
}

/** Aceita AAAA-MM-DD e DD/MM/AAAA; devolve AAAA-MM-DD ou null. */
export function parseData(bruto: string): string | null {
  const t = bruto.trim();
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
  const iso = br ? `${br[3]}-${br[2]}-${br[1]}` : t;
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && dataIsoValida(iso) ? iso : null;
}

const vazia = (): ResultadoValidacao => ({
  unidade: null,
  semanaInicio: null,
  linhasLidas: 0,
  linhasValidas: [],
  erros: [],
  avisos: [],
});

export function validarCsv(textoBruto: string, ctx: ContextoValidacao): ResultadoValidacao {
  const r = vazia();
  const texto = textoBruto.replace(/^\uFEFF/, '');

  if (new TextEncoder().encode(texto).length > LIMITE_BYTES) {
    r.erros.push({ linha: 0, campo: null, mensagem: `arquivo maior que ${LIMITE_BYTES} bytes` });
    return r;
  }

  const parsed = Papa.parse<string[]>(texto, {
    delimitersToGuess: [';', ',', '\t'],
    skipEmptyLines: false,
  });
  const linhas = parsed.data;
  const vaziaLinha = (cells: string[]) => cells.every((c) => c.trim() === '');

  const idxCab = linhas.findIndex((cells) => !vaziaLinha(cells));
  if (idxCab === -1) {
    r.erros.push({ linha: 1, campo: 'cabecalho', mensagem: 'arquivo vazio' });
    return r;
  }

  // ---- cabeçalho ----
  const cab = linhas[idxCab]!.map(normalizar);
  const posicao = new Map<string, number>();
  const repetidas: string[] = [];
  cab.forEach((nome, i) => {
    if (nome === '') return;
    if (posicao.has(nome)) repetidas.push(nome);
    else posicao.set(nome, i);
  });
  const faltando = COLUNAS_CSV.filter((c) => !posicao.has(c));
  if (faltando.length > 0 || repetidas.length > 0) {
    if (faltando.length > 0)
      r.erros.push({
        linha: idxCab + 1,
        campo: 'cabecalho',
        mensagem: `colunas obrigatórias ausentes: ${faltando.join(', ')} (esperado: ${COLUNAS_CSV.join(';')})`,
      });
    if (repetidas.length > 0)
      r.erros.push({
        linha: idxCab + 1,
        campo: 'cabecalho',
        mensagem: `colunas repetidas: ${[...new Set(repetidas)].join(', ')}`,
      });
    return r;
  }
  const extras = [...posicao.keys()].filter((c) => !(COLUNAS_CSV as readonly string[]).includes(c));
  if (extras.length > 0) r.avisos.push(`colunas ignoradas: ${extras.join(', ')}`);
  const col = {
    unidade: posicao.get('unidade')!,
    semana: posicao.get('semana_inicio')!,
    indicador: posicao.get('indicador')!,
    valor: posicao.get('valor')!,
  };

  const dados = linhas
    .map((cells, i) => ({ cells, linha: i + 1 }))
    .slice(idxCab + 1)
    .filter(({ cells }) => !vaziaLinha(cells));
  r.linhasLidas = dados.length;
  if (dados.length > LIMITE_LINHAS) {
    r.erros.push({
      linha: 0,
      campo: null,
      mensagem: `arquivo com ${dados.length} linhas; o limite é ${LIMITE_LINHAS}`,
    });
    return r;
  }
  if (dados.length === 0) {
    r.erros.push({ linha: idxCab + 1, campo: null, mensagem: 'arquivo sem linhas de dados' });
    return r;
  }

  const unidadesPorNorm = new Map(ctx.unidades.map((u) => [normalizar(u), u]));
  const indPorNorm = new Map(ctx.indicadores.map((i) => [normalizar(i.codigo), i]));
  const importaveis = ctx.indicadores.filter((i) => i.tipo !== 'taxa').map((i) => i.codigo);

  const primeiraLinhaDoIndicador = new Map<string, number>();
  const valoresPorIndicador = new Map<string, LinhaValida>();
  const linhasComErro = new Set<number>();
  const erro = (linha: number, campo: string, mensagem: string) => {
    r.erros.push({ linha, campo, mensagem });
    linhasComErro.add(linha);
  };

  for (const { cells, linha } of dados) {
    const get = (i: number) => (cells[i] ?? '').trim();

    // unidade
    const unidadeBruta = get(col.unidade);
    const unidade = unidadesPorNorm.get(normalizar(unidadeBruta));
    if (!unidade) {
      erro(
        linha,
        'unidade',
        unidadeBruta === ''
          ? 'unidade é obrigatória'
          : `unidade "${unidadeBruta}" não cadastrada (válidas: ${ctx.unidades.join(', ')})`,
      );
    } else if (r.unidade === null) r.unidade = unidade;
    else if (r.unidade !== unidade)
      erro(
        linha,
        'unidade',
        `o arquivo mistura unidades ("${r.unidade}" e "${unidade}"); envie um arquivo por unidade`,
      );

    // semana
    const semanaBruta = get(col.semana);
    const semana = parseData(semanaBruta);
    if (semana === null) {
      erro(
        linha,
        'semana_inicio',
        semanaBruta === ''
          ? 'semana_inicio é obrigatória'
          : `data inválida "${semanaBruta}": use AAAA-MM-DD ou DD/MM/AAAA`,
      );
    } else if (Number(semana.slice(0, 4)) < ANO_MINIMO) {
      erro(linha, 'semana_inicio', `data fora do intervalo aceito (a partir de ${ANO_MINIMO})`);
    } else if (!ehSegunda(semana)) {
      erro(
        linha,
        'semana_inicio',
        `${semana} é ${nomeDoDia(semana)}; semana_inicio deve ser uma segunda-feira (a segunda dessa semana é ${segundaDaSemana(semana)})`,
      );
    } else if (!semanaConcluida(semana, ctx.hoje)) {
      erro(linha, 'semana_inicio', `a semana de ${semana} ainda não terminou`);
    } else if (r.semanaInicio === null) r.semanaInicio = semana;
    else if (r.semanaInicio !== semana)
      erro(
        linha,
        'semana_inicio',
        `o arquivo mistura semanas (${r.semanaInicio} e ${semana}); envie um arquivo por semana`,
      );

    // indicador
    const indBruto = get(col.indicador);
    const ind = indPorNorm.get(normalizar(indBruto));
    let indOk: IndicadorRegra | null = null;
    if (!ind) {
      erro(
        linha,
        'indicador',
        indBruto === ''
          ? 'indicador é obrigatório'
          : `indicador "${indBruto}" não cadastrado (válidos: ${importaveis.join(', ')})`,
      );
    } else if (ind.tipo === 'taxa') {
      erro(
        linha,
        'indicador',
        `"${ind.codigo}" é calculado automaticamente (${ind.numeradorCodigo} ÷ ${ind.denominadorCodigo}); não envie`,
      );
    } else {
      const primeira = primeiraLinhaDoIndicador.get(ind.codigo);
      if (primeira !== undefined)
        erro(
          linha,
          'indicador',
          `indicador "${ind.codigo}" repetido (já informado na linha ${primeira})`,
        );
      else {
        primeiraLinhaDoIndicador.set(ind.codigo, linha);
        indOk = ind;
      }
    }

    // valor
    const v = parseValor(get(col.valor));
    if ('erro' in v) erro(linha, 'valor', v.erro);

    if (!linhasComErro.has(linha) && indOk && 'valor' in v)
      valoresPorIndicador.set(indOk.codigo, { linha, indicador: indOk.codigo, valor: v.valor });
  }

  // regra de negócio entre linhas: numerador não pode passar do denominador (faltas <= agendados)
  for (const taxa of ctx.indicadores.filter((i) => i.tipo === 'taxa')) {
    const num = taxa.numeradorCodigo ? valoresPorIndicador.get(taxa.numeradorCodigo) : undefined;
    const den = taxa.denominadorCodigo
      ? valoresPorIndicador.get(taxa.denominadorCodigo)
      : undefined;
    if (num && den && num.valor > den.valor) {
      erro(
        num.linha,
        'valor',
        `${num.indicador} (${num.valor}) não pode ser maior que ${den.indicador} (${den.valor}, linha ${den.linha})`,
      );
      valoresPorIndicador.delete(num.indicador);
    }
  }

  r.linhasValidas = [...valoresPorIndicador.values()].sort((a, b) => a.linha - b.linha);
  r.erros.sort((a, b) => a.linha - b.linha);

  // avisos (não bloqueiam): indicadores que não vieram nesta semana
  if (r.erros.length === 0) {
    const enviados = new Set(r.linhasValidas.map((l) => l.indicador));
    for (const codigo of importaveis)
      if (!enviados.has(codigo))
        r.avisos.push(`indicador "${codigo}" não foi informado nesta semana`);
    for (const taxa of ctx.indicadores.filter((i) => i.tipo === 'taxa')) {
      const falta = [taxa.numeradorCodigo, taxa.denominadorCodigo].filter(
        (c): c is string => !!c && !enviados.has(c),
      );
      if (falta.length > 0)
        r.avisos.push(
          `"${taxa.codigo}" não poderá ser calculada nesta semana: falta ${falta.join(' e ')}`,
        );
    }
  }
  return r;
}

/** Linhas distintas com algum erro (para o relatório: "3 linhas com erro"). */
export function contarLinhasComErro(erros: readonly ErroLinha[]): number {
  return new Set(erros.filter((e) => e.linha > 0).map((e) => e.linha)).size;
}
