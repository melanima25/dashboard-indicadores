/**
 * Taxa consolidada = soma dos numeradores ÷ soma dos denominadores.
 * NÃO é a média dos percentuais de cada período: períodos com volumes diferentes pesam
 * diferente. Ex.: 1/10 (10%) e 50/100 (50%) → taxa real 51/110 ≈ 46,4%, não 30%.
 *
 * Retorna `null` quando o denominador é zero (taxa indefinida), nunca 0 nem NaN.
 */
export function calcularTaxa(numerador: number, denominador: number): number | null {
  if (!Number.isFinite(numerador) || !Number.isFinite(denominador)) {
    throw new RangeError('Numerador e denominador devem ser números finitos');
  }
  if (denominador < 0 || numerador < 0) {
    throw new RangeError('Numerador e denominador não podem ser negativos');
  }
  if (denominador === 0) return null;
  return numerador / denominador;
}

export type ParNumDen = { numerador: number; denominador: number };

/** Recalcula a taxa de um conjunto de períodos somando numeradores e denominadores. */
export function recalcularTaxa(periodos: readonly ParNumDen[]): number | null {
  const num = periodos.reduce((acc, p) => acc + p.numerador, 0);
  const den = periodos.reduce((acc, p) => acc + p.denominador, 0);
  return calcularTaxa(num, den);
}

/** Apenas para comparação didática nos testes: o cálculo ERRADO (média de percentuais). */
export function mediaSimplesDeTaxas(periodos: readonly ParNumDen[]): number | null {
  const taxas = periodos
    .map((p) => calcularTaxa(p.numerador, p.denominador))
    .filter((t): t is number => t !== null);
  if (taxas.length === 0) return null;
  return taxas.reduce((a, b) => a + b, 0) / taxas.length;
}
