import { ApiError, apiGet } from '@/lib/api';
import { getGoalLimits, mostUsedGoalLimits } from '@/lib/goals';
import {
  fetchLatestTransactions,
  fetchMonthlySummary,
  mergeTransactions,
} from '@/lib/transactions';
import type { DailySummary, DailySummaryDay, MonthlySummary, Transaction } from '@/types/dashboard';
import type { GoalLimit } from '@/types/goals';
import { currentPeriod } from '@/utils/period';

/** Quantidade de movimentações exibidas no Dashboard. */
export const LATEST_TRANSACTIONS_COUNT = 5;

/** Limites de gasto exibidos no card "Metas" do Dashboard. */
export const DASHBOARD_GOALS_COUNT = 2;

export type DashboardData = {
  summary: MonthlySummary;
  transactions: Transaction[];
  /** Limites mais usados do mês; `null` quando as metas não puderam ser carregadas. */
  goals: GoalLimit[] | null;
  /** Dias do mês para o gráfico "Resumo do mês"; `null` quando não puderam ser carregados. */
  daily: DailySummaryDay[] | null;
};

/**
 * Metas não devem derrubar o Dashboard: uma falha vira `null` (card "indisponível").
 * O 401 continua sendo propagado para a tela tratar a sessão expirada.
 */
async function loadDashboardGoals(token: string, now: Date): Promise<GoalLimit[] | null> {
  try {
    const limits = await getGoalLimits(token, currentPeriod(now));
    return mostUsedGoalLimits(limits, DASHBOARD_GOALS_COUNT);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) throw error;
    return null;
  }
}

/**
 * GET /api/dashboard/daily-summary — receitas e despesas por dia do mês, com os acumulados já
 * calculados pela API (o app não soma). Como as metas, uma falha só deixa o gráfico de fora.
 */
async function loadDailySummary(token: string, now: Date): Promise<DailySummaryDay[] | null> {
  const { year, month } = currentPeriod(now);
  try {
    const response = await apiGet<DailySummary>('/api/dashboard/daily-summary', token, {
      year,
      month,
    });
    return response?.days ?? [];
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) throw error;
    return null;
  }
}

/**
 * Dias que o gráfico desenha: no mês corrente, só até hoje. Os dias seguintes repetiriam o
 * acumulado de hoje e pareceriam lançamentos que ainda não existem.
 */
export function chartDays(days: DailySummaryDay[], now: Date = new Date()): DailySummaryDay[] {
  return days.filter((item) => item.day <= now.getDate());
}

/** Busca os dados do Dashboard para o mês corrente (data local do aparelho). */
export async function getDashboard(token: string, now: Date = new Date()): Promise<DashboardData> {
  const [summary, latest, goals, daily] = await Promise.all([
    fetchMonthlySummary(token, now),
    fetchLatestTransactions(token, LATEST_TRANSACTIONS_COUNT),
    loadDashboardGoals(token, now),
    loadDailySummary(token, now),
  ]);

  return {
    summary,
    transactions: mergeTransactions(latest.incomes, latest.expenses, LATEST_TRANSACTIONS_COUNT),
    goals,
    daily,
  };
}
