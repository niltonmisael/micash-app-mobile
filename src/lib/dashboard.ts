import { ApiError } from '@/lib/api';
import { getGoalLimits, mostUsedGoalLimits } from '@/lib/goals';
import {
  fetchLatestTransactions,
  fetchMonthlySummary,
  mergeTransactions,
} from '@/lib/transactions';
import type { MonthlySummary, Transaction } from '@/types/dashboard';
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

/** Busca os dados do Dashboard para o mês corrente (data local do aparelho). */
export async function getDashboard(token: string, now: Date = new Date()): Promise<DashboardData> {
  const [summary, latest, goals] = await Promise.all([
    fetchMonthlySummary(token, now),
    fetchLatestTransactions(token, LATEST_TRANSACTIONS_COUNT),
    loadDashboardGoals(token, now),
  ]);

  return {
    summary,
    transactions: mergeTransactions(latest.incomes, latest.expenses, LATEST_TRANSACTIONS_COUNT),
    goals,
  };
}
