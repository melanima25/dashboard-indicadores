import { describe, expect, it } from 'vitest';
import { calcularTaxa, mediaSimplesDeTaxas, recalcularTaxa } from './taxa';

describe('calcularTaxa', () => {
  it('divide numerador por denominador', () => {
    expect(calcularTaxa(10, 100)).toBe(0.1);
  });

  it('denominador zero devolve null (indefinida), não 0 nem NaN', () => {
    expect(calcularTaxa(0, 0)).toBeNull();
  });

  it('rejeita valores negativos e não finitos', () => {
    expect(() => calcularTaxa(-1, 10)).toThrow(RangeError);
    expect(() => calcularTaxa(1, Number.NaN)).toThrow(RangeError);
  });
});

describe('recalcularTaxa a partir de numerador/denominador', () => {
  const semanas = [
    { numerador: 1, denominador: 10 }, // 10%
    { numerador: 50, denominador: 100 }, // 50%
  ];

  it('soma numeradores e denominadores antes de dividir', () => {
    expect(recalcularTaxa(semanas)).toBeCloseTo(51 / 110, 10);
  });

  it('DIFERE da média dos percentuais (o erro clássico)', () => {
    const correta = recalcularTaxa(semanas);
    const errada = mediaSimplesDeTaxas(semanas);
    expect(errada).toBeCloseTo(0.3, 10);
    expect(correta).not.toBeNull();
    expect(Math.abs((correta ?? 0) - (errada ?? 0))).toBeGreaterThan(0.15);
  });

  it('com volumes iguais as duas formas coincidem', () => {
    const iguais = [
      { numerador: 10, denominador: 100 },
      { numerador: 30, denominador: 100 },
    ];
    expect(recalcularTaxa(iguais)).toBeCloseTo(mediaSimplesDeTaxas(iguais) ?? -1, 10);
  });

  it('conjunto vazio ou só denominadores zero é indefinido', () => {
    expect(recalcularTaxa([])).toBeNull();
    expect(recalcularTaxa([{ numerador: 0, denominador: 0 }])).toBeNull();
  });
});
