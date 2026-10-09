/**
 * Gerador de dados SINTÉTICOS. Tudo aqui é inventado: nomes genéricos, números aleatórios com
 * semente fixa. Não representa nenhuma instituição, setor ou pessoa real.
 */
import { somarDias } from '@dashboard/shared';

export const SEMENTE = 20261012;
/** Primeira segunda-feira do período (2 anos = 104 semanas). */
export const PRIMEIRA_SEMANA = '2024-01-01';
export const TOTAL_SEMANAS = 104;
export const SEMANAS_AUSENTES_POR_UNIDADE = 3;

export const UNIDADES = [
  'Unidade Norte',
  'Unidade Sul',
  'Unidade Centro',
  'Unidade Leste',
  'Unidade Oeste',
  'Unidade Litoral',
] as const;

export type IndicadorSeed = {
  codigo: string;
  nome: string;
  unidadeMedida: string;
  tipo: 'soma' | 'taxa' | 'media';
  numeradorCodigo?: string;
  denominadorCodigo?: string;
};

export const INDICADORES: readonly IndicadorSeed[] = [
  {
    codigo: 'atendimentos_realizados',
    nome: 'Atendimentos realizados',
    unidadeMedida: 'atendimentos',
    tipo: 'soma',
  },
  {
    codigo: 'atendimentos_agendados',
    nome: 'Atendimentos agendados',
    unidadeMedida: 'atendimentos',
    tipo: 'soma',
  },
  { codigo: 'faltas', nome: 'Faltas', unidadeMedida: 'atendimentos', tipo: 'soma' },
  {
    codigo: 'taxa_absenteismo',
    nome: 'Taxa de absenteísmo',
    unidadeMedida: '%',
    tipo: 'taxa',
    numeradorCodigo: 'faltas',
    denominadorCodigo: 'atendimentos_agendados',
  },
  {
    codigo: 'tempo_medio_espera',
    nome: 'Tempo médio de espera',
    unidadeMedida: 'minutos',
    tipo: 'media',
  },
];

/** PRNG mulberry32: pequeno, rápido e determinístico. */
export function criarPrng(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type LancamentoSeed = {
  unidade: string;
  indicador: string;
  semanaInicio: string;
  valor: number;
};

export type DadosSinteticos = {
  lancamentos: LancamentoSeed[];
  /** pares unidade/semana que ficaram propositalmente sem envio */
  semanasAusentes: { unidade: string; semanaInicio: string }[];
};

const round = (n: number, casas = 0) => Math.round(n * 10 ** casas) / 10 ** casas;

/** Sazonalidade: pico no inverno (jun-ago), queda nas festas de fim de ano. */
function fatorSazonal(semanaIndice: number, mes: number): number {
  const anual =
    1 + 0.12 * Math.sin(((semanaIndice % 52) / 52) * 2 * Math.PI - Math.PI / 2 + Math.PI / 3);
  const festas = mes === 12 || mes === 1 ? 0.82 : 1;
  const inverno = mes >= 6 && mes <= 8 ? 1.08 : 1;
  return anual * festas * inverno;
}

export function gerarDadosSinteticos(semente: number = SEMENTE): DadosSinteticos {
  const rand = criarPrng(semente);
  const lancamentos: LancamentoSeed[] = [];
  const semanasAusentes: DadosSinteticos['semanasAusentes'] = [];

  for (const unidade of UNIDADES) {
    const porte = 380 + Math.floor(rand() * 520); // agendamentos semanais base
    const taxaBase = 0.08 + rand() * 0.1; // 8% a 18%
    const esperaBase = 14 + rand() * 22; // minutos

    const ausentes = new Set<number>();
    while (ausentes.size < SEMANAS_AUSENTES_POR_UNIDADE)
      ausentes.add(Math.floor(rand() * TOTAL_SEMANAS));

    for (let i = 0; i < TOTAL_SEMANAS; i++) {
      const semanaInicio = somarDias(PRIMEIRA_SEMANA, i * 7);
      // Sempre consome o PRNG na mesma ordem, mesmo se a semana for descartada (estabilidade).
      const ruido1 = rand();
      const ruido2 = rand();
      const ruido3 = rand();
      if (ausentes.has(i)) {
        semanasAusentes.push({ unidade, semanaInicio });
        continue;
      }
      const mes = Number(semanaInicio.slice(5, 7));
      const sazonal = fatorSazonal(i, mes);
      const agendados = Math.max(1, round(porte * sazonal * (0.93 + ruido1 * 0.14)));
      const taxa = Math.min(
        0.35,
        Math.max(0.02, taxaBase * (0.8 + ruido2 * 0.4) * (mes >= 6 && mes <= 8 ? 1.1 : 1)),
      );
      const faltas = Math.min(agendados, round(agendados * taxa));
      const realizados = agendados - faltas;
      const espera = round(esperaBase * (0.85 + ruido3 * 0.3) * (sazonal > 1.05 ? 1.15 : 1), 1);

      const add = (indicador: string, valor: number) =>
        lancamentos.push({ unidade, indicador, semanaInicio, valor });
      add('atendimentos_agendados', agendados);
      add('faltas', faltas);
      add('atendimentos_realizados', realizados);
      add('tempo_medio_espera', espera);
    }
  }
  return { lancamentos, semanasAusentes };
}
