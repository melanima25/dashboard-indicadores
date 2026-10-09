import { describe, expect, it } from 'vitest';
import {
  contarLinhasComErro,
  LIMITE_LINHAS,
  parseData,
  parseValor,
  validarCsv,
  type ContextoValidacao,
} from './csv';

const ctx: ContextoValidacao = {
  unidades: ['Unidade Norte', 'Unidade Sul', 'Unidade Centro'],
  hoje: '2026-10-09',
  indicadores: [
    { codigo: 'atendimentos_realizados', tipo: 'soma' },
    { codigo: 'atendimentos_agendados', tipo: 'soma' },
    { codigo: 'faltas', tipo: 'soma' },
    {
      codigo: 'taxa_absenteismo',
      tipo: 'taxa',
      numeradorCodigo: 'faltas',
      denominadorCodigo: 'atendimentos_agendados',
    },
    { codigo: 'tempo_medio_espera', tipo: 'media' },
  ],
};

const CAB = 'unidade;semana_inicio;indicador;valor';
const U = 'Unidade Norte;2025-03-03';
const valido = [
  CAB,
  `${U};atendimentos_agendados;100`,
  `${U};faltas;12`,
  `${U};atendimentos_realizados;88`,
  `${U};tempo_medio_espera;21,5`,
].join('\n');

const msgs = (texto: string) => validarCsv(texto, ctx).erros.map((e) => `${e.linha}:${e.campo}`);

describe('parseValor', () => {
  it('aceita inteiro, vírgula e ponto decimal', () => {
    expect(parseValor('12')).toEqual({ valor: 12 });
    expect(parseValor('12,5')).toEqual({ valor: 12.5 });
    expect(parseValor(' 12.25 ')).toEqual({ valor: 12.25 });
    expect(parseValor('0')).toEqual({ valor: 0 });
  });
  it('rejeita vazio, negativo, texto, milhar e excesso de casas', () => {
    expect(parseValor('')).toMatchObject({ erro: expect.stringContaining('obrigatório') });
    expect(parseValor('-3')).toMatchObject({ erro: expect.stringContaining('negativo') });
    expect(parseValor('12abc')).toMatchObject({ erro: expect.stringContaining('inválido') });
    expect(parseValor('1.234,5')).toMatchObject({ erro: expect.stringContaining('milhar') });
    expect(parseValor('1,234')).toMatchObject({ erro: expect.stringContaining('casas') });
    expect(parseValor('2000000000')).toMatchObject({ erro: expect.stringContaining('limite') });
  });
});

describe('parseData', () => {
  it('aceita AAAA-MM-DD e DD/MM/AAAA', () => {
    expect(parseData('2025-03-03')).toBe('2025-03-03');
    expect(parseData('03/03/2025')).toBe('2025-03-03');
  });
  it('rejeita data inexistente ou em outro formato', () => {
    expect(parseData('2025-02-30')).toBeNull();
    expect(parseData('31/04/2025')).toBeNull();
    expect(parseData('03-03-2025')).toBeNull();
    expect(parseData('amanhã')).toBeNull();
  });
});

describe('validarCsv: arquivo bom', () => {
  it('lê unidade, semana e 4 linhas válidas', () => {
    const r = validarCsv(valido, ctx);
    expect(r.erros).toEqual([]);
    expect(r.unidade).toBe('Unidade Norte');
    expect(r.semanaInicio).toBe('2025-03-03');
    expect(r.linhasLidas).toBe(4);
    expect(r.linhasValidas.map((l) => [l.indicador, l.valor])).toEqual([
      ['atendimentos_agendados', 100],
      ['faltas', 12],
      ['atendimentos_realizados', 88],
      ['tempo_medio_espera', 21.5],
    ]);
    expect(r.avisos).toEqual([]);
  });

  it('aceita vírgula como separador, BOM, cabeçalho em maiúsculas e linhas em branco', () => {
    const texto = `${String.fromCharCode(0xfeff)}Unidade, Semana_Inicio ,INDICADOR,Valor\n\nunidade centro,03/03/2025,faltas,"7,5"\n\n`;
    const r = validarCsv(texto, ctx);
    expect(r.erros).toEqual([]);
    expect(r.unidade).toBe('Unidade Centro');
    expect(r.linhasValidas).toEqual([{ linha: 3, indicador: 'faltas', valor: 7.5 }]);
  });

  it('avisa (sem bloquear) o que não veio e quando a taxa não pode ser calculada', () => {
    const r = validarCsv([CAB, `${U};faltas;3`].join('\n'), ctx);
    expect(r.erros).toEqual([]);
    expect(r.avisos).toContain('indicador "atendimentos_agendados" não foi informado nesta semana');
    expect(r.avisos).toContain(
      '"taxa_absenteismo" não poderá ser calculada nesta semana: falta atendimentos_agendados',
    );
  });

  it('colunas extras são ignoradas com aviso', () => {
    const r = validarCsv(`${CAB};obs\n${U};faltas;3;qualquer`, ctx);
    expect(r.erros).toEqual([]);
    expect(r.avisos).toContain('colunas ignoradas: obs');
  });
});

describe('validarCsv: cabeçalho e limites', () => {
  it('cabeçalho sem coluna obrigatória rejeita o arquivo e diz qual falta', () => {
    const r = validarCsv('unidade;semana_inicio;indicador;qtd\nx;y;z;1', ctx);
    expect(r.erros).toEqual([
      expect.objectContaining({
        linha: 1,
        campo: 'cabecalho',
        mensagem: expect.stringContaining('valor'),
      }),
    ]);
    expect(r.linhasValidas).toEqual([]);
  });
  it('coluna repetida', () => {
    expect(msgs('unidade;unidade;semana_inicio;indicador;valor\n')).toEqual(['1:cabecalho']);
  });
  it('arquivo vazio e arquivo só com cabeçalho', () => {
    expect(msgs('')).toEqual(['1:cabecalho']);
    expect(msgs(`${CAB}\n`)).toEqual(['1:null']);
  });
  it(`mais de ${LIMITE_LINHAS} linhas é recusado antes de validar`, () => {
    const linhas = Array.from({ length: LIMITE_LINHAS + 1 }, () => `${U};faltas;1`);
    const r = validarCsv([CAB, ...linhas].join('\n'), ctx);
    expect(r.erros).toHaveLength(1);
    expect(r.erros[0]!.mensagem).toContain('limite');
  });
  it('arquivo acima de 1 MB é recusado', () => {
    const r = validarCsv(CAB + '\n' + 'x'.repeat(1_000_001), ctx);
    expect(r.erros[0]!.mensagem).toContain('bytes');
  });
});

describe('validarCsv: erros linha a linha', () => {
  it('valor negativo aponta a linha certa (contando cabeçalho e linhas em branco)', () => {
    const r = validarCsv(
      [CAB, `${U};faltas;5`, '', `${U};atendimentos_agendados;-4`].join('\n'),
      ctx,
    );
    expect(r.erros).toEqual([
      expect.objectContaining({
        linha: 4,
        campo: 'valor',
        mensagem: expect.stringContaining('negativo'),
      }),
    ]);
    expect(r.linhasValidas.map((l) => l.linha)).toEqual([2]);
  });

  it('data inválida e data que não é segunda-feira (com a sugestão da segunda)', () => {
    expect(msgs(`${CAB}\nUnidade Norte;2025-02-30;faltas;1`)).toEqual(['2:semana_inicio']);
    const r = validarCsv(`${CAB}\nUnidade Norte;2025-03-05;faltas;1`, ctx);
    expect(r.erros[0]!.mensagem).toBe(
      '2025-03-05 é quarta; semana_inicio deve ser uma segunda-feira (a segunda dessa semana é 2025-03-03)',
    );
  });

  it('semana que ainda não terminou e ano absurdo', () => {
    // hoje = quinta 09/10/2026: a semana de seg 05/10 ainda não acabou; a de 28/09 sim
    expect(msgs(`${CAB}\nUnidade Norte;2026-10-05;faltas;1`)).toEqual(['2:semana_inicio']);
    expect(msgs(`${CAB}\nUnidade Norte;2026-09-28;faltas;1`)).toEqual([]);
    expect(msgs(`${CAB}\nUnidade Norte;1999-12-27;faltas;1`)).toEqual(['2:semana_inicio']);
  });

  it('unidade e indicador desconhecidos listam as opções válidas', () => {
    const r = validarCsv(`${CAB}\nUnidade Marte;2025-03-03;pizzas;1`, ctx);
    expect(r.erros.map((e) => e.campo)).toEqual(['unidade', 'indicador']);
    expect(r.erros[0]!.mensagem).toContain('Unidade Norte');
    expect(r.erros[1]!.mensagem).toContain('atendimentos_realizados');
  });

  it('taxa não pode ser enviada: é calculada', () => {
    const r = validarCsv(`${CAB}\n${U};taxa_absenteismo;12`, ctx);
    expect(r.erros[0]!.mensagem).toContain('calculado automaticamente');
    expect(r.erros[0]!.mensagem).toContain('faltas ÷ atendimentos_agendados');
  });

  it('indicador duplicado aponta a primeira ocorrência', () => {
    const r = validarCsv([CAB, `${U};faltas;1`, `${U};faltas;2`].join('\n'), ctx);
    expect(r.erros).toEqual([
      expect.objectContaining({
        linha: 3,
        campo: 'indicador',
        mensagem: expect.stringContaining('linha 2'),
      }),
    ]);
  });

  it('faltas maiores que agendados é impossível', () => {
    const r = validarCsv([CAB, `${U};atendimentos_agendados;10`, `${U};faltas;11`].join('\n'), ctx);
    expect(r.erros).toEqual([
      expect.objectContaining({
        linha: 3,
        campo: 'valor',
        mensagem: expect.stringContaining('maior que'),
      }),
    ]);
    expect(r.linhasValidas.map((l) => l.indicador)).toEqual(['atendimentos_agendados']);
  });

  it('faltas igual a agendados é permitido (100% de absenteísmo)', () => {
    expect(msgs([CAB, `${U};atendimentos_agendados;10`, `${U};faltas;10`].join('\n'))).toEqual([]);
  });

  it('um arquivo = uma unidade e uma semana', () => {
    const r = validarCsv(
      [
        CAB,
        `${U};faltas;1`,
        'Unidade Sul;2025-03-03;atendimentos_agendados;1',
        'Unidade Norte;2025-03-10;tempo_medio_espera;1',
      ].join('\n'),
      ctx,
    );
    expect(r.erros.map((e) => `${e.linha}:${e.campo}`)).toEqual(['3:unidade', '4:semana_inicio']);
  });

  it('várias falhas na mesma linha contam como UMA linha com erro', () => {
    const r = validarCsv(`${CAB}\nUnidade Marte;2025-03-05;pizzas;-1`, ctx);
    expect(r.erros).toHaveLength(4);
    expect(contarLinhasComErro(r.erros)).toBe(1);
  });
});
