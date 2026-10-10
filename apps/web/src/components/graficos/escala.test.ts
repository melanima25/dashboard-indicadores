import { describe, expect, it } from 'vitest';
import { dominioDaLinha, escalaLinear, indiceMaisProximo, marcasDoEixo } from './escala';

describe('marcasDoEixo', () => {
  it('usa números redondos que cobrem os dados', () => {
    expect(marcasDoEixo(0, 87)).toEqual([0, 20, 40, 60, 80, 100]);
    expect(marcasDoEixo(10.2, 14.8)).toEqual([10, 11, 12, 13, 14, 15]);
  });
  it('lida com intervalo vazio', () => {
    expect(marcasDoEixo(5, 5)).toEqual([5, 6]);
  });
});

describe('escalaLinear', () => {
  it('mapeia e inverte (eixo Y de tela)', () => {
    const y = escalaLinear(0, 100, 200, 0);
    expect(y(0)).toBe(200);
    expect(y(100)).toBe(0);
    expect(y(50)).toBe(100);
  });
  it('domínio de largura zero fica no meio', () => {
    expect(escalaLinear(3, 3, 0, 10)(3)).toBe(5);
  });
});

describe('indiceMaisProximo', () => {
  it('acha o período mais perto do cursor', () => {
    expect(indiceMaisProximo([0, 100, 200], 140)).toBe(1);
    expect(indiceMaisProximo([0, 100, 200], 160)).toBe(2);
  });
});

describe('dominioDaLinha', () => {
  it('contém todos os valores', () => {
    const [a, b] = dominioDaLinha([12.1, 13.4, 11.9]);
    expect(a).toBeLessThanOrEqual(11.9);
    expect(b).toBeGreaterThanOrEqual(13.4);
  });
  it('sem dados devolve um domínio válido', () => {
    expect(dominioDaLinha([])).toEqual([0, 1]);
  });
});
