import { describe, expect, it } from 'vitest';
import {
  coberturaCompleta,
  descricaoVariacao,
  formatarData,
  formatarValor,
  legendaDaUnidade,
  rotuloPeriodo,
  setaVariacao,
  textoCobertura,
  textoVariacao,
} from './format';

describe('formatarValor', () => {
  it('contagem inteira com separador de milhar', () => {
    expect(formatarValor(16498, 'atendimentos')).toBe('16.498');
    expect(formatarValor(1234.6, 'atendimentos')).toBe('1.235');
  });
  it('taxa em % e tempo em min, com vírgula decimal', () => {
    expect(formatarValor(13.2654, '%')).toBe('13,3%');
    expect(formatarValor(20.92, 'minutos')).toBe('20,9 min');
  });
  it('sem dado é travessão, nunca zero', () => {
    expect(formatarValor(null, '%')).toBe('—');
    expect(formatarValor(0, 'atendimentos')).toBe('0');
  });
});

describe('legendaDaUnidade', () => {
  it('só contagens têm legenda', () => {
    expect(legendaDaUnidade('atendimentos')).toBe('atendimentos');
    expect(legendaDaUnidade('%')).toBeNull();
    expect(legendaDaUnidade('minutos')).toBeNull();
  });
});

describe('rotulos de período', () => {
  it('data, mês, ano e semana', () => {
    expect(formatarData('2025-03-17')).toBe('17/03/2025');
    expect(rotuloPeriodo('2025-03', 'mensal')).toBe('mar/2025');
    expect(rotuloPeriodo('2025-12', 'mensal')).toBe('dez/2025');
    expect(rotuloPeriodo('2025', 'anual')).toBe('2025');
    expect(rotuloPeriodo('2025-03-17', 'semanal')).toBe('Semana de 17/03/2025');
  });
});

describe('variação', () => {
  it('percentual e pontos, com sinal', () => {
    expect(textoVariacao({ tipo: 'percentual', valor: 4.21 })).toBe('+4,2%');
    expect(textoVariacao({ tipo: 'percentual', valor: -3.14 })).toBe('−3,1%');
    expect(textoVariacao({ tipo: 'pontos', valor: 1.26 })).toBe('+1,3 p.p.');
    expect(textoVariacao({ tipo: 'pontos', valor: -0.5 })).toBe('−0,5 p.p.');
  });
  it('valor que arredonda para zero não leva sinal nem seta de subida', () => {
    expect(textoVariacao({ tipo: 'percentual', valor: 0.04 })).toBe('0,0%');
    expect(setaVariacao({ tipo: 'percentual', valor: 0.04 })).toBe('■');
    expect(textoVariacao({ tipo: 'percentual', valor: -0.04 })).toBe('0,0%');
  });
  it('sem comparação quando não há valor anterior', () => {
    expect(textoVariacao({ tipo: 'percentual', valor: null })).toBe('sem comparação');
    expect(setaVariacao({ tipo: 'percentual', valor: null })).toBe('–');
  });
  it('setas', () => {
    expect(setaVariacao({ tipo: 'percentual', valor: 5 })).toBe('▲');
    expect(setaVariacao({ tipo: 'pontos', valor: -5 })).toBe('▼');
  });
  it('descrição para leitor de tela', () => {
    expect(descricaoVariacao({ tipo: 'percentual', valor: 4.21 }, 'fev/2025')).toBe(
      'Aumento de 4,2% em relação a fev/2025',
    );
    expect(descricaoVariacao({ tipo: 'pontos', valor: -1.26 }, 'fev/2025')).toBe(
      'Queda de 1,3 p.p. em relação a fev/2025',
    );
    expect(descricaoVariacao({ tipo: 'percentual', valor: 0 }, 'fev/2025')).toBe(
      'Sem variação em relação a fev/2025',
    );
    expect(descricaoVariacao({ tipo: 'percentual', valor: null }, 'fev/2025')).toBe(
      'Sem dados de fev/2025 para comparar',
    );
  });
});

describe('cobertura', () => {
  it('texto e completude', () => {
    expect(textoCobertura(22, 24)).toBe('22 de 24 envios');
    expect(textoCobertura(1, 1)).toBe('1 de 1 envio');
    expect(coberturaCompleta(24, 24)).toBe(true);
    expect(coberturaCompleta(22, 24)).toBe(false);
    expect(coberturaCompleta(0, 0)).toBe(false);
  });
});
