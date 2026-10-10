import { describe, expect, it } from 'vitest';
import { csvDaTabela, nomeDoArquivo } from './exportar';

const item = {
  periodo: '2025-03',
  unidadeId: 1,
  indicador: 'taxa_absenteismo',
  valor: 12.5,
  numerador: 5,
  denominador: 40,
  semanasInformadas: 4,
  semanasEsperadas: 5,
};

describe('exportação', () => {
  it('gera cabeçalho e linhas com os mesmos números da tela', () => {
    const csv = csvDaTabela([{ unidade: 'Unidade Norte', item }], 'Taxa de absenteísmo');
    const linhas = csv.replace('﻿', '').trim().split('\r\n');
    expect(linhas[0]).toBe(
      'unidade;periodo;indicador;valor;numerador;denominador;semanas_informadas;semanas_esperadas',
    );
    expect(linhas[1]).toBe('Unidade Norte;2025-03;Taxa de absenteísmo;12.5;5;40;4;5');
  });
  it('valor ausente fica vazio, nunca zero', () => {
    const csv = csvDaTabela(
      [{ unidade: 'Sul', item: { ...item, valor: null, numerador: null, denominador: null } }],
      'X',
    );
    expect(csv).toContain('Sul;2025-03;X;;;;4;5');
  });
  it('nome de unidade com fórmula é neutralizado', () => {
    expect(csvDaTabela([{ unidade: '=HIPERLINK("x")', item }], 'X')).toContain(`"'=HIPERLINK`);
  });
  it('nome de arquivo seguro', () => {
    expect(nomeDoArquivo('taxa/../x', '2025-03')).toBe('consolidado-taxa_.._x-2025-03.csv');
  });
});
