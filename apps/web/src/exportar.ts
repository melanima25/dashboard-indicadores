import { montarCsv, type ItemConsolidado } from '@dashboard/shared';

export type LinhaExportacao = {
  unidade: string;
  item: ItemConsolidado;
};

/** CSV da tabela consolidada, exatamente como está na tela (mesmo filtro, mesmos números). */
export function csvDaTabela(linhas: LinhaExportacao[], nomeIndicador: string): string {
  return montarCsv(
    [
      'unidade',
      'periodo',
      'indicador',
      'valor',
      'numerador',
      'denominador',
      'semanas_informadas',
      'semanas_esperadas',
    ],
    linhas.map(({ unidade, item }) => [
      unidade,
      item.periodo,
      nomeIndicador,
      item.valor,
      item.numerador,
      item.denominador,
      item.semanasInformadas,
      item.semanasEsperadas,
    ]),
  );
}

export function nomeDoArquivo(indicador: string, periodo: string): string {
  return `consolidado-${indicador}-${periodo}.csv`.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/** Dispara o download no navegador. */
export function baixarCsv(conteudo: string, nome: string): void {
  const url = URL.createObjectURL(new Blob([conteudo], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
