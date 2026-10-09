/**
 * Regras dos cartões de KPI: qual período mostrar, qual é o anterior e como medir a variação.
 * Funções puras; o banco só fornece os números.
 */
import type { Granularidade } from './consolidacao';
import { chavePeriodo } from './consolidacao';
import type { TipoIndicador } from './schemas';
import { dataIsoValida, quintaDaSemana, somarDias, ultimaSemanaConcluida } from './semana';

export function periodoValido(periodo: string, g: Granularidade): boolean {
  if (g === 'semanal') return /^\d{4}-\d{2}-\d{2}$/.test(periodo) && dataIsoValida(periodo);
  if (g === 'mensal') return /^\d{4}-(0[1-9]|1[0-2])$/.test(periodo);
  return /^\d{4}$/.test(periodo);
}

/** Período imediatamente anterior: semana -7 dias, mês anterior (virando o ano) ou ano anterior. */
export function periodoAnterior(periodo: string, g: Granularidade): string {
  if (g === 'semanal') return somarDias(periodo, -7);
  if (g === 'anual') return String(Number(periodo) - 1);
  const [ano, mes] = periodo.split('-').map(Number) as [number, number];
  return mes === 1 ? `${ano - 1}-12` : `${ano}-${String(mes - 1).padStart(2, '0')}`;
}

/**
 * Limites do período, em datas de QUINTA-FEIRA (o mesmo critério dos filtros `de`/`ate` da API).
 * Mensal 2025-03 -> 2025-03-01 a 2025-03-31; semanal -> a própria quinta da semana.
 */
export function limitesDoPeriodo(periodo: string, g: Granularidade): { de: string; ate: string } {
  if (g === 'semanal') {
    const quinta = quintaDaSemana(periodo);
    return { de: quinta, ate: quinta };
  }
  if (g === 'anual') return { de: `${periodo}-01-01`, ate: `${periodo}-12-31` };
  const primeiro = `${periodo}-01`;
  // 1º dia do mês seguinte menos 1 dia (somar 32 dias sempre cai no mês seguinte)
  const proximo = somarDias(primeiro, 32).slice(0, 7) + '-01';
  return { de: primeiro, ate: somarDias(proximo, -1) };
}

/**
 * Período padrão do dashboard: o da última semana que tem dados E já terminou.
 * Nunca sugere uma semana em andamento nem um período sem dado nenhum.
 */
export function periodoPadrao(
  g: Granularidade,
  ultimaSemanaComDados: string,
  hoje: string,
): string {
  const concluida = ultimaSemanaConcluida(hoje);
  const referencia = ultimaSemanaComDados < concluida ? ultimaSemanaComDados : concluida;
  return chavePeriodo(referencia, g);
}

export type Variacao = {
  /** percentual: soma e média (ex.: +4,2%); pontos: taxa em pontos percentuais (ex.: +1,3 p.p.) */
  tipo: 'percentual' | 'pontos';
  valor: number | null;
};

/**
 * Taxa varia em PONTOS percentuais (12% -> 15% = +3 p.p.), porque "+25%" sobre um percentual
 * confunde. Soma e média variam em %. Sem valor anterior (ou anterior zero), não há variação:
 * devolve null, nunca infinito nem 0 inventado.
 */
export function calcularVariacao(
  tipo: TipoIndicador,
  atual: number | null,
  anterior: number | null,
): Variacao {
  const modo = tipo === 'taxa' ? 'pontos' : 'percentual';
  if (atual === null || anterior === null) return { tipo: modo, valor: null };
  if (modo === 'pontos') return { tipo: modo, valor: atual - anterior };
  if (anterior === 0) return { tipo: modo, valor: null };
  return { tipo: modo, valor: ((atual - anterior) / anterior) * 100 };
}
