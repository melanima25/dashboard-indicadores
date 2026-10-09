import { describe, expect, it } from 'vitest';
import {
  calcularVariacao,
  limitesDoPeriodo,
  periodoAnterior,
  periodoPadrao,
  periodoValido,
} from './kpis';

describe('periodoValido', () => {
  it('valida cada formato', () => {
    expect(periodoValido('2025-03', 'mensal')).toBe(true);
    expect(periodoValido('2025-13', 'mensal')).toBe(false);
    expect(periodoValido('2025', 'anual')).toBe(true);
    expect(periodoValido('25', 'anual')).toBe(false);
    expect(periodoValido('2025-03-17', 'semanal')).toBe(true);
    expect(periodoValido('2025-02-30', 'semanal')).toBe(false);
    expect(periodoValido('2025-03', 'semanal')).toBe(false);
  });
});

describe('periodoAnterior', () => {
  it('semana, mês e ano, inclusive na virada de ano', () => {
    expect(periodoAnterior('2025-03-17', 'semanal')).toBe('2025-03-10');
    expect(periodoAnterior('2025-01-06', 'semanal')).toBe('2024-12-30');
    expect(periodoAnterior('2025-03', 'mensal')).toBe('2025-02');
    expect(periodoAnterior('2025-01', 'mensal')).toBe('2024-12');
    expect(periodoAnterior('2025', 'anual')).toBe('2024');
  });
});

describe('limitesDoPeriodo (em datas de quinta-feira)', () => {
  it('mensal: do dia 1 ao último dia, inclusive fevereiro bissexto', () => {
    expect(limitesDoPeriodo('2025-03', 'mensal')).toEqual({ de: '2025-03-01', ate: '2025-03-31' });
    expect(limitesDoPeriodo('2025-02', 'mensal')).toEqual({ de: '2025-02-01', ate: '2025-02-28' });
    expect(limitesDoPeriodo('2024-02', 'mensal')).toEqual({ de: '2024-02-01', ate: '2024-02-29' });
    expect(limitesDoPeriodo('2025-12', 'mensal')).toEqual({ de: '2025-12-01', ate: '2025-12-31' });
  });
  it('anual e semanal', () => {
    expect(limitesDoPeriodo('2025', 'anual')).toEqual({ de: '2025-01-01', ate: '2025-12-31' });
    expect(limitesDoPeriodo('2025-03-17', 'semanal')).toEqual({
      de: '2025-03-20',
      ate: '2025-03-20',
    });
  });
});

describe('periodoPadrao', () => {
  it('usa a última semana com dados quando ela já terminou', () => {
    // seed termina na semana de 22/12/2025 (quinta 25/12 -> dezembro)
    expect(periodoPadrao('mensal', '2025-12-22', '2026-10-09')).toBe('2025-12');
    expect(periodoPadrao('anual', '2025-12-22', '2026-10-09')).toBe('2025');
    expect(periodoPadrao('semanal', '2025-12-22', '2026-10-09')).toBe('2025-12-22');
  });
  it('nunca sugere semana em andamento: dados até 05/10 e hoje 09/10 caem na semana de 28/09', () => {
    expect(periodoPadrao('semanal', '2026-10-05', '2026-10-09')).toBe('2026-09-28');
    expect(periodoPadrao('mensal', '2026-10-05', '2026-10-09')).toBe('2026-10'); // quinta 01/10
  });
});

describe('calcularVariacao', () => {
  it('soma e média variam em %', () => {
    expect(calcularVariacao('soma', 110, 100)).toEqual({ tipo: 'percentual', valor: 10 });
    expect(calcularVariacao('media', 15, 20)).toEqual({ tipo: 'percentual', valor: -25 });
  });
  it('taxa varia em pontos percentuais, não em %', () => {
    const v = calcularVariacao('taxa', 15, 12);
    expect(v.tipo).toBe('pontos');
    expect(v.valor).toBeCloseTo(3, 10);
  });
  it('sem valor anterior (ou anterior zero) não há variação: null, nunca infinito', () => {
    expect(calcularVariacao('soma', 10, null).valor).toBeNull();
    expect(calcularVariacao('soma', null, 10).valor).toBeNull();
    expect(calcularVariacao('soma', 10, 0).valor).toBeNull();
    expect(calcularVariacao('taxa', 10, 0).valor).toBe(10); // 0% -> 10% é +10 p.p., válido
  });
});
