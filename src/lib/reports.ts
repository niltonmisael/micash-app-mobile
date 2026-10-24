import { CATEGORY_COLORS } from '@/constants/colors';
import { apiGet } from '@/lib/api';
import { fetchMonthlySummary } from '@/lib/transactions';
import type { ExpenseCategorySummary } from '@/types/dashboard';
import { lastPeriods } from '@/utils/period';
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

/** Despesas do mês por categoria e totais de despesa dos últimos meses, direto da API. */
export async function getReport(token: string, period: MonthPeriod): Promise<ReportData> {
  const months = lastPeriods(period, EVOLUTION_MONTHS);

  const [categories, ...summaries] = await Promise.all([
    apiGet<ExpenseCategorySummary[]>('/api/dashboard/expenses-by-category', token, {
      year: period.year,
      month: period.month,
    }),
    ...months.map((month) => fetchMonthlySummary(token, new Date(month.year, month.month - 1, 1))),
  ]);

  return {
    period,
    totalExpense: summaries[summaries.length - 1].totalExpense,
    categories: resolveChartColors(categories ?? []),
    evolution: months.map((month, index) => ({
      period: month,
      totalExpense: summaries[index].totalExpense,
    })),
  };
}
