/** Formatação para a tela, em português do Brasil. Funções puras (testadas em format.test.ts). */
import type { Granularidade, Variacao } from '@dashboard/shared';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MENOS = '−'; // sinal de menos tipográfico

const numero = (casas: number) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });

export const SEM_VALOR = '—'; // travessão: sem dado não é zero

/** Valor de um indicador: taxa em %, tempo em min, contagens inteiras. null vira travessão. */
export function formatarValor(valor: number | null, unidadeMedida: string): string {
  if (valor === null) return SEM_VALOR;
  if (unidadeMedida === '%') return `${numero(1).format(valor)}%`;
  if (unidadeMedida === 'minutos') return `${numero(1).format(valor)} min`;
  return numero(0).format(valor);
}

/** Texto curto da unidade de medida para legenda (só para contagens). */
export function legendaDaUnidade(unidadeMedida: string): string | null {
  return unidadeMedida === '%' || unidadeMedida === 'minutos' ? null : unidadeMedida;
}

/** 2025-03-17 -> 17/03/2025 */
export function formatarData(data: string): string {
  const [a, m, d] = data.split('-');
  return `${d}/${m}/${a}`;
}

export function rotuloPeriodo(periodo: string, g: Granularidade): string {
  if (g === 'anual') return periodo;
  if (g === 'mensal') {
    const [ano, mes] = periodo.split('-');
    return `${MESES[Number(mes) - 1]}/${ano}`;
  }
  return `Semana de ${formatarData(periodo)}`;
}

const arredondar = (n: number) => Math.round(n * 10) / 10;

/** +4,2% ou +1,3 p.p.; "sem comparação" quando não há valor anterior. */
export function textoVariacao(v: Variacao): string {
  if (v.valor === null) return 'sem comparação';
  const r = arredondar(v.valor);
  const sinal = r > 0 ? '+' : r < 0 ? MENOS : '';
  const corpo = numero(1).format(Math.abs(r));
  return v.tipo === 'pontos' ? `${sinal}${corpo} p.p.` : `${sinal}${corpo}%`;
}

/** Seta decorativa. Não indica "bom" ou "ruim": faltas subindo e atendimentos subindo têm sentidos opostos. */
export function setaVariacao(v: Variacao): string {
  if (v.valor === null) return '–';
  const r = arredondar(v.valor);
  return r > 0 ? '▲' : r < 0 ? '▼' : '■';
}

/** Frase completa para leitor de tela. */
export function descricaoVariacao(v: Variacao, rotuloAnterior: string): string {
  if (v.valor === null) return `Sem dados de ${rotuloAnterior} para comparar`;
  const r = arredondar(v.valor);
  const medida = textoVariacao({ tipo: v.tipo, valor: Math.abs(r) }).replace('+', '');
  if (r === 0) return `Sem variação em relação a ${rotuloAnterior}`;
  return `${r > 0 ? 'Aumento' : 'Queda'} de ${medida} em relação a ${rotuloAnterior}`;
}

/** "22 de 24 envios": cada envio é uma unidade em uma semana. */
export function textoCobertura(informadas: number, esperadas: number): string {
  return `${numero(0).format(informadas)} de ${numero(0).format(esperadas)} ${esperadas === 1 ? 'envio' : 'envios'}`;
}

export const coberturaCompleta = (informadas: number, esperadas: number) =>
  esperadas > 0 && informadas >= esperadas;
