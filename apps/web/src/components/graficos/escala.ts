/** Matemática dos gráficos, sem React: escalas e marcas de eixo. Testada em escala.test.ts. */

/** Marcas "redondas" (1, 2, 5 × 10^n) cobrindo [min, max]. */
export function marcasDoEixo(min: number, max: number, alvo = 5): number[] {
  if (!(max > min)) {
    const base = Number.isFinite(min) ? min : 0;
    return [base, base + 1];
  }
  const bruto = (max - min) / Math.max(1, alvo - 1);
  const potencia = Math.pow(10, Math.floor(Math.log10(bruto)));
  const f = bruto / potencia;
  const passo = (f <= 1.5 ? 1 : f <= 3 ? 2 : f <= 7 ? 5 : 10) * potencia;
  const inicio = Math.floor(min / passo) * passo;
  const fim = Math.ceil(max / passo) * passo;
  const marcas: number[] = [];
  for (let v = inicio; v <= fim + passo / 1e6; v += passo) marcas.push(Number(v.toPrecision(12)));
  return marcas;
}

/** Mapeia [d0, d1] -> [r0, r1]. Domínio de largura zero cai no meio. */
export function escalaLinear(d0: number, d1: number, r0: number, r1: number) {
  return (v: number) => (d1 === d0 ? (r0 + r1) / 2 : r0 + ((v - d0) / (d1 - d0)) * (r1 - r0));
}

/** Índice do ponto mais próximo de x (pixels), para o cursor "grudar" no período. */
export function indiceMaisProximo(xs: number[], x: number): number {
  let melhor = 0;
  for (let i = 1; i < xs.length; i++)
    if (Math.abs((xs[i] as number) - x) < Math.abs((xs[melhor] as number) - x)) melhor = i;
  return melhor;
}

/** Eixo da linha: zoom nos dados (linha não precisa começar em zero), com folga de 10%. */
export function dominioDaLinha(valores: number[]): [number, number] {
  if (valores.length === 0) return [0, 1];
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const folga = (max - min) * 0.1 || Math.abs(max) * 0.1 || 1;
  const marcas = marcasDoEixo(
    Math.max(0, min - folga) === 0 && min >= 0 ? 0 : min - folga,
    max + folga,
  );
  return [marcas[0] as number, marcas[marcas.length - 1] as number];
}
