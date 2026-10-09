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
