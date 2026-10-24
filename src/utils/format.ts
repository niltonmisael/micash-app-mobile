const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** "R$ 5.890,00". O Intl separa "R$" do número com espaço não separável; aqui vira espaço comum. */
export function formatCurrency(value: number): string {
  return currencyFormatter.format(value).replace(/\s/g, ' ');
}

export function localDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Converte uma data da API em "AAAA-MM-DD" no fuso do aparelho.
 * - DateOnly ("2026-10-05") e DateTime sem fuso: mantém o dia informado.
 * - DateTime com fuso ("2026-10-15T01:49:04Z"): converte para o dia local
 *   (ex.: 01:49 UTC de 15/10 ainda é 14/10 no horário de Brasília).
 */
export function toDateKey(value: string): string {
  const hasTimeZone = /T.*(Z|[+-]\d{2}:?\d{2})$/.test(value);
  if (!hasTimeZone) return value.slice(0, 10);

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value.slice(0, 10) : localDateKey(date);
}

/** "05 out 2026" */
export function formatDate(dateKey: string): string {
  const [year, month, day] = dateKey.split('-');
  return `${day} ${MONTHS[Number(month) - 1]} ${year}`;
}

/** "Hoje", "Ontem" ou "05 out 2026". */
export function formatRelativeDate(dateKey: string, now: Date = new Date()): string {
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (dateKey === localDateKey(now)) return 'Hoje';
  if (dateKey === localDateKey(yesterday)) return 'Ontem';
  return formatDate(dateKey);
}

/** Máximo de dígitos no campo de valor (até R$ 9.999.999.999,99). */
const MAX_AMOUNT_DIGITS = 12;

/**
 * Campo de valor digitado em centavos: guarda só os dígitos ("1234" → 1234 centavos = R$ 12,34).
 * Trabalhar com inteiros evita erros de arredondamento antes de enviar à API.
 */
export function parseCentsInput(text: string): number {
  const digits = text.replace(/\D/g, '').replace(/^0+/, '').slice(0, MAX_AMOUNT_DIGITS);
  return digits ? Number(digits) : 0;
}

/** Centavos → número em reais para a API (decimal). */
export function centsToAmount(cents: number): number {
  return cents / 100;
}

/** "AAAA-MM-DD" → Date à meia-noite local. */
export function dateFromKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Data escolhida → DateTime UTC da despesa (a API recusa datas futuras e grava em UTC).
 * Hoje usa o horário atual; outros dias usam meio-dia local, longe da virada de dia.
 */
export function toExpenseDateTime(dateKey: string, now: Date = new Date()): string {
  if (dateKey === localDateKey(now)) return now.toISOString();
  const date = dateFromKey(dateKey);
  date.setHours(12);
  return date.toISOString();
}

const percentFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

/** Percentual de 0 a 100 (como a API devolve): 71.09 → "71,1%". */
export function formatPercent(value: number): string {
  return `${percentFormatter.format(value)}%`;
}
