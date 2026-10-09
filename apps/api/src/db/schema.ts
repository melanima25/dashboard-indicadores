import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const tipoIndicador = pgEnum('tipo_indicador', ['soma', 'taxa', 'media']);
export const statusImportacao = pgEnum('status_importacao', ['ok', 'parcial', 'rejeitada']);

export const unidade = pgTable('unidade', {
  id: serial('id').primaryKey(),
  nome: text('nome').notNull().unique(),
  ativa: boolean('ativa').notNull().default(true),
});

export const indicador = pgTable(
  'indicador',
  {
    id: serial('id').primaryKey(),
    codigo: text('codigo').notNull().unique(),
    nome: text('nome').notNull(),
    unidadeMedida: text('unidade_medida').notNull(),
    tipo: tipoIndicador('tipo').notNull(),
    // indicador de taxa aponta para 2 indicadores de soma (numerador e denominador)
    numeradorId: integer('numerador_id').references((): AnyPgColumn => indicador.id),
    denominadorId: integer('denominador_id').references((): AnyPgColumn => indicador.id),
  },
  (t) => [
    check(
      'indicador_taxa_exige_num_den',
      sql`(${t.tipo} = 'taxa' AND ${t.numeradorId} IS NOT NULL AND ${t.denominadorId} IS NOT NULL)
        OR (${t.tipo} <> 'taxa' AND ${t.numeradorId} IS NULL AND ${t.denominadorId} IS NULL)`,
    ),
  ],
);

export const importacao = pgTable('importacao', {
  id: serial('id').primaryKey(),
  arquivoNome: text('arquivo_nome').notNull(),
  unidadeId: integer('unidade_id')
    .notNull()
    .references(() => unidade.id),
  semanaInicio: date('semana_inicio', { mode: 'string' }).notNull(),
  enviadoEm: timestamp('enviado_em', { withTimezone: true }).notNull().defaultNow(),
  linhasOk: integer('linhas_ok').notNull().default(0),
  linhasErro: integer('linhas_erro').notNull().default(0),
  status: statusImportacao('status').notNull(),
});

export const lancamentoSemanal = pgTable(
  'lancamento_semanal',
  {
    id: serial('id').primaryKey(),
    unidadeId: integer('unidade_id')
      .notNull()
      .references(() => unidade.id),
    indicadorId: integer('indicador_id')
      .notNull()
      .references(() => indicador.id),
    // sempre a segunda-feira da semana
    semanaInicio: date('semana_inicio', { mode: 'string' }).notNull(),
    valor: numeric('valor', { precision: 14, scale: 2 }).notNull(),
    // nulo para dados gerados pelo seed (não vieram de uma importação)
    importacaoId: integer('importacao_id').references(() => importacao.id),
    atualizadoEm: timestamp('atualizado_em', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique('lancamento_semanal_unidade_indicador_semana_uq').on(
      t.unidadeId,
      t.indicadorId,
      t.semanaInicio,
    ),
    check('lancamento_valor_nao_negativo', sql`${t.valor} >= 0`),
    check('lancamento_semana_e_segunda', sql`EXTRACT(ISODOW FROM ${t.semanaInicio}) = 1`),
    index('lancamento_semana_idx').on(t.semanaInicio),
  ],
);

export const erroImportacao = pgTable('erro_importacao', {
  id: serial('id').primaryKey(),
  importacaoId: integer('importacao_id')
    .notNull()
    .references(() => importacao.id, { onDelete: 'cascade' }),
  linha: integer('linha').notNull(),
  campo: text('campo'),
  mensagem: text('mensagem').notNull(),
});
