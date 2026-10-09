CREATE TYPE "public"."status_importacao" AS ENUM('ok', 'parcial', 'rejeitada');--> statement-breakpoint
CREATE TYPE "public"."tipo_indicador" AS ENUM('soma', 'taxa', 'media');--> statement-breakpoint
CREATE TABLE "erro_importacao" (
	"id" serial PRIMARY KEY NOT NULL,
	"importacao_id" integer NOT NULL,
	"linha" integer NOT NULL,
	"campo" text,
	"mensagem" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "importacao" (
	"id" serial PRIMARY KEY NOT NULL,
	"arquivo_nome" text NOT NULL,
	"unidade_id" integer NOT NULL,
	"semana_inicio" date NOT NULL,
	"enviado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"linhas_ok" integer DEFAULT 0 NOT NULL,
	"linhas_erro" integer DEFAULT 0 NOT NULL,
	"status" "status_importacao" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "indicador" (
	"id" serial PRIMARY KEY NOT NULL,
	"codigo" text NOT NULL,
	"nome" text NOT NULL,
	"unidade_medida" text NOT NULL,
	"tipo" "tipo_indicador" NOT NULL,
	"numerador_id" integer,
	"denominador_id" integer,
	CONSTRAINT "indicador_codigo_unique" UNIQUE("codigo"),
	CONSTRAINT "indicador_taxa_exige_num_den" CHECK (("indicador"."tipo" = 'taxa' AND "indicador"."numerador_id" IS NOT NULL AND "indicador"."denominador_id" IS NOT NULL)
        OR ("indicador"."tipo" <> 'taxa' AND "indicador"."numerador_id" IS NULL AND "indicador"."denominador_id" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "lancamento_semanal" (
	"id" serial PRIMARY KEY NOT NULL,
	"unidade_id" integer NOT NULL,
	"indicador_id" integer NOT NULL,
	"semana_inicio" date NOT NULL,
	"valor" numeric(14, 2) NOT NULL,
	"importacao_id" integer,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lancamento_semanal_unidade_indicador_semana_uq" UNIQUE("unidade_id","indicador_id","semana_inicio"),
	CONSTRAINT "lancamento_valor_nao_negativo" CHECK ("lancamento_semanal"."valor" >= 0),
	CONSTRAINT "lancamento_semana_e_segunda" CHECK (EXTRACT(ISODOW FROM "lancamento_semanal"."semana_inicio") = 1)
);
--> statement-breakpoint
CREATE TABLE "unidade" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"ativa" boolean DEFAULT true NOT NULL,
	CONSTRAINT "unidade_nome_unique" UNIQUE("nome")
);
--> statement-breakpoint
ALTER TABLE "erro_importacao" ADD CONSTRAINT "erro_importacao_importacao_id_importacao_id_fk" FOREIGN KEY ("importacao_id") REFERENCES "public"."importacao"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "importacao" ADD CONSTRAINT "importacao_unidade_id_unidade_id_fk" FOREIGN KEY ("unidade_id") REFERENCES "public"."unidade"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indicador" ADD CONSTRAINT "indicador_numerador_id_indicador_id_fk" FOREIGN KEY ("numerador_id") REFERENCES "public"."indicador"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indicador" ADD CONSTRAINT "indicador_denominador_id_indicador_id_fk" FOREIGN KEY ("denominador_id") REFERENCES "public"."indicador"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamento_semanal" ADD CONSTRAINT "lancamento_semanal_unidade_id_unidade_id_fk" FOREIGN KEY ("unidade_id") REFERENCES "public"."unidade"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamento_semanal" ADD CONSTRAINT "lancamento_semanal_indicador_id_indicador_id_fk" FOREIGN KEY ("indicador_id") REFERENCES "public"."indicador"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamento_semanal" ADD CONSTRAINT "lancamento_semanal_importacao_id_importacao_id_fk" FOREIGN KEY ("importacao_id") REFERENCES "public"."importacao"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lancamento_semana_idx" ON "lancamento_semanal" USING btree ("semana_inicio");