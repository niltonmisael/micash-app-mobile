/** Mês de referência das consultas mensais da API (`year` e `month`, com `month` de 1 a 12). */
export type MonthPeriod = {
  year: number;
  month: number;
};

const MONTH_NAMES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

const SHORT_MONTHS = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

/** Mês corrente pela data local do aparelho. */
export function currentPeriod(now: Date = new Date()): MonthPeriod {
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

/** Avança (`delta` > 0) ou volta (`delta` < 0) meses, atravessando a virada de ano. */
export function shiftPeriod(period: MonthPeriod, delta: number): MonthPeriod {
  const index = period.year * 12 + (period.month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function samePeriod(a: MonthPeriod, b: MonthPeriod): boolean {
  return a.year === b.year && a.month === b.month;
}

/** Os `count` meses que terminam em `end`, do mais antigo para o mais recente. */
export function lastPeriods(end: MonthPeriod, count: number): MonthPeriod[] {
  return Array.from({ length: count }, (_, index) => shiftPeriod(end, index - (count - 1)));
}

/** "Este mês", "Mês anterior" ou "agosto de 2026". */
export function periodLabel(period: MonthPeriod, now: Date = new Date()): string {
  const current = currentPeriod(now);
  if (samePeriod(period, current)) return 'Este mês';
  if (samePeriod(period, shiftPeriod(current, -1))) return 'Mês anterior';
  return `${MONTH_NAMES[period.month - 1]} de ${period.year}`;
}

/** "Ago" — rótulo curto para eixos de gráfico. */
export function shortMonthLabel(period: MonthPeriod): string {
  return SHORT_MONTHS[period.month - 1];
}
