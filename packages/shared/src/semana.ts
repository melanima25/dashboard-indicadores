/**
 * Regra ISO 8601: uma semana (segunda a domingo) pertence ao mês da sua QUINTA-FEIRA.
 * Equivale a dizer que a semana fica no mês onde caem pelo menos 4 dos seus 7 dias.
 *
 * Datas são strings 'AAAA-MM-DD' (sem fuso). O cálculo usa UTC apenas como calendário,
 * para não sofrer com horário de verão nem com o fuso da máquina.
 */

export type MesReferencia = { ano: number; mes: number };

const DATA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const DIA_MS = 24 * 60 * 60 * 1000;

function parseDataIso(data: string): Date {
  const m = DATA_ISO.exec(data);
  if (!m) throw new RangeError(`Data inválida (esperado AAAA-MM-DD): ${data}`);
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) {
    throw new RangeError(`Data inexistente: ${data}`);
  }
  return d;
}

/** Dia da semana ISO: 1 = segunda ... 7 = domingo. */
function diaDaSemanaIso(d: Date): number {
  return d.getUTCDay() === 0 ? 7 : d.getUTCDay();
}

export function formatarDataIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Soma `dias` (pode ser negativo) a uma data 'AAAA-MM-DD'. */
export function somarDias(data: string, dias: number): string {
  return formatarDataIso(new Date(parseDataIso(data).getTime() + dias * DIA_MS));
}

/** Segunda-feira da semana ISO que contém a data informada. */
export function segundaDaSemana(data: string): string {
  const d = parseDataIso(data);
  return somarDias(data, -(diaDaSemanaIso(d) - 1));
}

/** Mês de referência de uma semana, a partir de qualquer dia dela (regra da quinta-feira). */
export function mesDeReferenciaDaSemana(data: string): MesReferencia {
  const quinta = parseDataIso(somarDias(segundaDaSemana(data), 3));
  return { ano: quinta.getUTCFullYear(), mes: quinta.getUTCMonth() + 1 };
}

/** true se a string é uma data real no formato AAAA-MM-DD. */
export function dataIsoValida(data: string): boolean {
  try {
    parseDataIso(data);
    return true;
  } catch {
    return false;
  }
}

/** true se a data (AAAA-MM-DD) cai numa segunda-feira. */
export function ehSegunda(data: string): boolean {
  return diaDaSemanaIso(parseDataIso(data)) === 1;
}

const NOMES_DIA = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'] as const;

/** Nome do dia da semana em português (para mensagens de erro). */
export function nomeDoDia(data: string): string {
  return NOMES_DIA[diaDaSemanaIso(parseDataIso(data)) - 1]!;
}

/**
 * Uma semana está concluída quando o domingo dela já passou (hoje é segunda ou depois).
 * Semana em andamento nunca é "pendente": ainda dá tempo de enviar.
 */
export function semanaConcluida(semanaInicio: string, hoje: string): boolean {
  return somarDias(semanaInicio, 6) < hoje;
}

/** Segunda-feira da última semana concluída em relação a `hoje`. */
export function ultimaSemanaConcluida(hoje: string): string {
  const segundaAtual = segundaDaSemana(hoje);
  return somarDias(segundaAtual, -7);
}

/** Todas as segundas-feiras de `de` até `ate` (inclusive); ambas devem ser segundas. */
export function segundasEntre(de: string, ate: string): string[] {
  const out: string[] = [];
  for (let s = de; s <= ate; s = somarDias(s, 7)) out.push(s);
  return out;
}

/** Quinta-feira da semana: a data que define o mês e o ano de referência. */
export function quintaDaSemana(semanaInicio: string): string {
  return somarDias(semanaInicio, 3);
}
