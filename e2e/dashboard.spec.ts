import { readFileSync } from 'node:fs';
import { AxeBuilder } from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { CHAVE_ADMIN_E2E } from '../playwright.config';

const CSV_VALIDO = readFileSync(new URL('../exemplos/semana-valida.csv', import.meta.url));

async function abrir(page: Page) {
  await page.goto('/');
  await expect(page.getByTestId('grade-kpis')).toBeVisible();
  await expect(page.getByTestId('grafico-linha')).toBeVisible();
  await expect(page.getByTestId('tabela-consolidada')).toBeVisible();
}

test('mostra KPIs, os dois gráficos e a tabela consolidada', async ({ page }) => {
  await abrir(page);
  await expect(page.getByRole('heading', { name: 'Dashboard de indicadores' })).toBeVisible();
  await expect(page.getByTestId('grade-kpis').getByRole('article')).toHaveCount(5);
  await expect(page.getByTestId('grafico-barras')).toBeVisible();
  // Rede inteira + 6 unidades
  await expect(page.getByTestId('tabela-consolidada').locator('tbody tr')).toHaveCount(7);
});

test('o filtro de indicador muda gráficos e tabela', async ({ page }) => {
  await abrir(page);
  await expect(page.getByRole('columnheader', { name: 'Numerador' })).toHaveCount(0);

  await page
    .getByLabel('Indicador (gráficos e tabela)')
    .selectOption({ label: 'Taxa de absenteísmo' });

  await expect(page.locator('#titulo-graficos')).toContainText('Taxa de absenteísmo');
  // taxa mostra numerador e denominador; soma não mostra
  await expect(page.getByRole('columnheader', { name: 'Numerador' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Denominador' })).toBeVisible();
  await expect(page.getByTestId('grafico-barras')).toContainText('%');
});

test('escolher uma unidade destaca a barra e o título da evolução', async ({ page }) => {
  await abrir(page);
  await page.getByLabel('Unidade', { exact: true }).selectOption({ label: 'Unidade Norte' });
  await expect(page.getByTestId('grafico-linha')).toContainText('Evolução · Unidade Norte');
  await expect(
    page.getByTestId('tabela-consolidada').locator('tr[aria-current="true"]'),
  ).toContainText('Unidade Norte');
});

test('o gráfico de linha responde ao teclado e mostra o valor do período', async ({ page }) => {
  await abrir(page);
  const grafico = page.getByRole('group', { name: /Gráfico de linha/ });
  await grafico.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(grafico.getByRole('status')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(grafico.getByRole('status')).toHaveCount(0);
});

test('a tabela alternativa do gráfico tem os mesmos dados', async ({ page }) => {
  await abrir(page);
  const figura = page.getByTestId('grafico-barras');
  await figura.getByText('Ver dados do gráfico em tabela').click();
  await expect(figura.getByRole('table')).toBeVisible();
  await expect(figura.getByRole('row')).toHaveCount(7); // cabeçalho + 6 unidades
});

test('exporta o CSV da tabela filtrada', async ({ page }) => {
  await abrir(page);
  await page.getByLabel('Indicador (gráficos e tabela)').selectOption({ label: 'Faltas' });
  await expect(page.locator('#titulo-graficos')).toContainText('Faltas');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Exportar CSV' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^consolidado-faltas-\d{4}-\d{2}\.csv$/);

  const caminho = await download.path();
  const texto = readFileSync(caminho, 'utf8');
  expect(texto.startsWith('﻿')).toBe(true);
  const linhas = texto.replace('﻿', '').trim().split('\r\n');
  expect(linhas[0]).toBe(
    'unidade;periodo;indicador;valor;numerador;denominador;semanas_informadas;semanas_esperadas',
  );
  expect(linhas).toHaveLength(8); // cabeçalho + rede + 6 unidades
  expect(linhas[1]).toMatch(/^Rede inteira;/);
});

test('fluxo de importação: arquivo com erro é rejeitado, corrigido, gravado e a tela atualiza', async ({
  page,
}) => {
  await abrir(page);

  // 1) mesmo arquivo válido, mas com UM erro: faltas (600) maior que agendados (540)
  const comErro = CSV_VALIDO.toString('utf8').replace('faltas;61', 'faltas;600');
  await page.getByLabel('Arquivo CSV').setInputFiles({
    name: 'semana.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(comErro, 'utf8'),
  });
  const resultado = page.getByTestId('resultado-importacao');
  await expect(resultado.getByRole('alert')).toContainText('Arquivo rejeitado');
  await expect(resultado.getByRole('alert')).toContainText('Nada foi gravado');
  const erro = resultado.getByRole('row').filter({ hasText: 'faltas (600)' });
  await expect(erro).toHaveCount(1);
  await expect(erro.getByRole('cell').first()).toHaveText('3'); // número da linha no arquivo
  await expect(page.getByRole('button', { name: 'Gravar importação' })).toHaveCount(0);

  // 2) corrigido: a prévia aprova
  await page.getByLabel('Arquivo CSV').setInputFiles({
    name: 'semana.csv',
    mimeType: 'text/csv',
    buffer: CSV_VALIDO,
  });
  await expect(resultado).toContainText('Arquivo válido: Unidade Norte, semana de 21/04/2025');

  // 3) grava com a chave de administrador
  await page.getByLabel('Chave de administrador (só para gravar)').fill(CHAVE_ADMIN_E2E);
  await page.getByRole('button', { name: 'Gravar importação' }).click();
  await expect(resultado.getByRole('status')).toContainText('Importação gravada');

  // 4) o dashboard mostra o número que acabou de ser importado (479 atendimentos realizados)
  await page.getByLabel('Visão', { exact: true }).selectOption('semanal');
  await page.getByLabel('Período', { exact: true }).selectOption({ label: 'Semana de 21/04/2025' });
  await page
    .getByLabel('Indicador (gráficos e tabela)')
    .selectOption({ label: 'Atendimentos realizados' });
  const linhaNorte = page
    .getByTestId('tabela-consolidada')
    .getByRole('row')
    .filter({ hasText: 'Unidade Norte' });
  await expect(linhaNorte).toContainText('479');
});

test('gravar com chave errada é recusado e explica o motivo', async ({ page }) => {
  await abrir(page);
  await page.getByLabel('Arquivo CSV').setInputFiles({
    name: 'semana.csv',
    mimeType: 'text/csv',
    buffer: CSV_VALIDO,
  });
  await expect(page.getByTestId('resultado-importacao')).toContainText('Arquivo válido');
  await page.getByLabel('Chave de administrador (só para gravar)').fill('chave-errada');
  await page.getByRole('button', { name: 'Gravar importação' }).click();
  await expect(page.getByTestId('resultado-importacao').getByRole('alert')).toContainText(
    'Chave de administrador ausente ou inválida',
  );
});

test.describe('acessibilidade', () => {
  test('sem violações (axe, WCAG A/AA) na tela inicial', async ({ page }) => {
    await abrir(page);
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(r.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });

  test('sem violações com tabelas dos gráficos abertas e indicador de taxa', async ({ page }) => {
    await abrir(page);
    await page
      .getByLabel('Indicador (gráficos e tabela)')
      .selectOption({ label: 'Taxa de absenteísmo' });
    for (const resumo of await page.getByText('Ver dados do gráfico em tabela').all())
      await resumo.click();
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(r.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});

test('no celular não há rolagem horizontal na página', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await abrir(page);
  const sobra = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(sobra).toBeLessThanOrEqual(0);
});
