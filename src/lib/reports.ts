import { CATEGORY_COLORS } from '@/constants/colors';
import { apiGet, isPlanLimitError } from '@/lib/api';
import { isHistoryLocked } from '@/lib/subscription';
import { fetchMonthlySummary } from '@/lib/transactions';
import type { ExpenseCategorySummary } from '@/types/dashboard';
import type { PlanLimits } from '@/types/user';
import { lastPeriods, samePeriod } from '@/utils/period';
import type { MonthPeriod } from '@/utils/period';

/** Meses exibidos em "Evolução mensal", terminando no mês selecionado. */
export const EVOLUTION_MONTHS = 6;

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export type ReportCategory = {
  id: number;
  name: string;
  amount: number;
  /** Percentual calculado pela API. */
  percentage: number;
  /** Cor do segmento no gráfico. */
  color: string;
};

export type ReportData = {
  period: MonthPeriod;
  /** Total de despesas do mês (monthly-summary da API). */
  totalExpense: number;
  categories: ReportCategory[];
  /** Total de despesas de cada mês (monthly-summary), do mais antigo ao selecionado. */
  evolution: { period: MonthPeriod; totalExpense: number }[];
  /** Algum mês da evolução ficou de fora por estar antes do histórico do plano gratuito. */
  historyLocked: boolean;
};

/**
 * Usa a cor da categoria quando ela está em hexadecimal; cores fora desse padrão
 * (ex.: "amarelo", de categorias antigas) recebem uma cor da paleta ainda não usada.
 */
export function resolveChartColors(items: ExpenseCategorySummary[]): ReportCategory[] {
  const used = new Set(
    items.map((item) => item.categoryColor.toUpperCase()).filter((c) => HEX_COLOR.test(c)),
  );
  const available = CATEGORY_COLORS.filter((color) => !used.has(color.toUpperCase()));
  let next = 0;

  return items.map((item) => {
    let color = item.categoryColor;
    if (!HEX_COLOR.test(color)) {
      color = available.length
        ? available[next % available.length]
        : CATEGORY_COLORS[next % CATEGORY_COLORS.length];
      next += 1;
    }
    return {
      id: item.categoryId,
      name: item.categoryName,
      amount: item.amount,
      percentage: item.percentage,
      color,
    };
  });
}

/**
 * Total de um mês da evolução; `null` quando o mês está antes do histórico do plano gratuito
 * (403 `PLAN_LIMIT_REACHED`), para os meses permitidos continuarem aparecendo.
 */
async function loadEvolutionMonth(
  token: string,
  month: MonthPeriod,
  selected: MonthPeriod,
  limits: PlanLimits | undefined,
  now: Date,
) {
  // Mês da evolução que o plano já sabe que está bloqueado: nem pede à API. O mês escolhido
  // sempre é pedido, para o 403 dele chegar à tela (cadeado).
  if (!samePeriod(month, selected) && isHistoryLocked(limits, month, now)) return null;
  try {
    return await fetchMonthlySummary(token, new Date(month.year, month.month - 1, 1));
  } catch (error) {
    if (isPlanLimitError(error)) return null;
    throw error;
  }
}

/**
 * Despesas do mês por categoria e totais de despesa dos últimos meses, direto da API. O mês
 * escolhido fora do histórico do plano propaga o 403 (a tela mostra o cadeado). Com `limits`, os
 * meses da evolução antes do histórico do plano são pulados sem chamar a API.
 */
export async function getReport(
  token: string,
  period: MonthPeriod,
  limits?: PlanLimits,
  now: Date = new Date(),
): Promise<ReportData> {
  const months = lastPeriods(period, EVOLUTION_MONTHS);

  const [categories, ...summaries] = await Promise.all([
    apiGet<ExpenseCategorySummary[]>('/api/dashboard/expenses-by-category', token, {
      year: period.year,
      month: period.month,
    }),
    ...months.map((month) => loadEvolutionMonth(token, month, period, limits, now)),
  ]);

  const evolution = months.flatMap((month, index) => {
    const summary = summaries[index];
    return summary ? [{ period: month, totalExpense: summary.totalExpense }] : [];
  });

  return {
    period,
    totalExpense: summaries[summaries.length - 1]?.totalExpense ?? 0,
    categories: resolveChartColors(categories ?? []),
    evolution,
    historyLocked: evolution.length < months.length,
  };
}
