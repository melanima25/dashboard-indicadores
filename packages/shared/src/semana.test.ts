import { describe, expect, it } from 'vitest';
import { mesDeReferenciaDaSemana, segundaDaSemana, somarDias } from './semana';

describe('mesDeReferenciaDaSemana (regra ISO: mês da quinta-feira)', () => {
  it('semana inteira dentro de um mês', () => {
    expect(mesDeReferenciaDaSemana('2025-03-10')).toEqual({ ano: 2025, mes: 3 });
  });

  it('virada de mês: seg 28/04 a dom 04/05/2025 -> quinta é 01/05 -> maio', () => {
    expect(mesDeReferenciaDaSemana('2025-04-28')).toEqual({ ano: 2025, mes: 5 });
    expect(mesDeReferenciaDaSemana('2025-05-04')).toEqual({ ano: 2025, mes: 5 });
  });

  it('virada de mês: seg 24/03 a dom 30/03 e seg 31/03 a dom 06/04/2025 -> quinta é 03/04 -> abril', () => {
    expect(mesDeReferenciaDaSemana('2025-03-31')).toEqual({ ano: 2025, mes: 4 });
    expect(mesDeReferenciaDaSemana('2025-03-30')).toEqual({ ano: 2025, mes: 3 });
  });

  it('semana que termina no último dia do mês, com quinta ainda no mês, fica no mês', () => {
    // seg 27/10 a dom 02/11/2025: quinta é 30/10 -> outubro
    expect(mesDeReferenciaDaSemana('2025-10-27')).toEqual({ ano: 2025, mes: 10 });
    expect(mesDeReferenciaDaSemana('2025-11-02')).toEqual({ ano: 2025, mes: 10 });
  });

  it('virada de ano para frente: seg 30/12/2024 -> quinta é 02/01/2025 -> janeiro de 2025', () => {
    expect(mesDeReferenciaDaSemana('2024-12-30')).toEqual({ ano: 2025, mes: 1 });
    expect(mesDeReferenciaDaSemana('2024-12-31')).toEqual({ ano: 2025, mes: 1 });
  });

  it('virada de ano para trás: seg 29/12/2025 -> quinta é 01/01/2026 -> janeiro de 2026', () => {
    expect(mesDeReferenciaDaSemana('2025-12-29')).toEqual({ ano: 2026, mes: 1 });
  });

  it('semana de 01/01 que começa em ano anterior mas quinta ainda em dezembro', () => {
    // seg 28/12/2026 -> quinta 31/12/2026 -> dezembro de 2026
    expect(mesDeReferenciaDaSemana('2026-12-28')).toEqual({ ano: 2026, mes: 12 });
    expect(mesDeReferenciaDaSemana('2027-01-01')).toEqual({ ano: 2026, mes: 12 });
  });

  it('ano bissexto: seg 26/02 a dom 03/03/2024 -> quinta é 29/02 -> fevereiro', () => {
    expect(mesDeReferenciaDaSemana('2024-02-26')).toEqual({ ano: 2024, mes: 2 });
    expect(mesDeReferenciaDaSemana('2024-03-03')).toEqual({ ano: 2024, mes: 2 });
  });

  it('rejeita formato e datas inexistentes', () => {
    expect(() => mesDeReferenciaDaSemana('10/03/2025')).toThrow(RangeError);
    expect(() => mesDeReferenciaDaSemana('2025-02-30')).toThrow(RangeError);
  });
});

describe('auxiliares de calendário', () => {
  it('segundaDaSemana devolve a segunda-feira da semana ISO', () => {
    expect(segundaDaSemana('2025-05-04')).toBe('2025-04-28'); // domingo
    expect(segundaDaSemana('2025-04-28')).toBe('2025-04-28'); // já é segunda
  });

  it('somarDias atravessa mês e ano', () => {
    expect(somarDias('2024-12-30', 3)).toBe('2025-01-02');
    expect(somarDias('2024-03-01', -1)).toBe('2024-02-29');
  });
});

import { dataIsoValida, ehSegunda, nomeDoDia, segundasEntre } from './semana';

describe('helpers de data (semana 2)', () => {
  it('dataIsoValida / ehSegunda / nomeDoDia', () => {
    expect(dataIsoValida('2025-02-29')).toBe(false);
    expect(dataIsoValida('2024-02-29')).toBe(true);
    expect(ehSegunda('2025-03-03')).toBe(true);
    expect(ehSegunda('2025-03-04')).toBe(false);
    expect(nomeDoDia('2025-03-09')).toBe('domingo');
    expect(nomeDoDia('2025-03-08')).toBe('sábado');
  });
  it('segundasEntre lista de 7 em 7 dias, incluindo as pontas', () => {
    expect(segundasEntre('2025-03-03', '2025-03-24')).toEqual([
      '2025-03-03',
      '2025-03-10',
      '2025-03-17',
      '2025-03-24',
    ]);
    expect(segundasEntre('2025-03-10', '2025-03-03')).toEqual([]);
  });
});
