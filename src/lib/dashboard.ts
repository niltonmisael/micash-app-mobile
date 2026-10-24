import {
  fetchLatestTransactions,
  fetchMonthlySummary,
  mergeTransactions,
} from '@/lib/transactions';
import type { MonthlySummary, Transaction } from '@/types/dashboard';

/** Quantidade de movimentações exibidas no Dashboard. */
export const LATEST_TRANSACTIONS_COUNT = 5;

export type DashboardData = {
  summary: MonthlySummary;
  transactions: Transaction[];
};

/** Busca os dados do Dashboard para o mês corrente (data local do aparelho). */
export async function getDashboard(token: string, now: Date = new Date()): Promise<DashboardData> {
  const [summary, latest] = await Promise.all([
    fetchMonthlySummary(token, now),
    fetchLatestTransactions(token, LATEST_TRANSACTIONS_COUNT),
  ]);

  return {
    summary,
    transactions: mergeTransactions(latest.incomes, latest.expenses, LATEST_TRANSACTIONS_COUNT),
  };
}
