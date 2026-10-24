import { apiGet, apiPost } from '@/lib/api';
import { IncomeCategory } from '@/types/dashboard';
import type {
  Income,
  LatestExpense,
  MonthlySummary,
  PagedResponse,
  Transaction,
} from '@/types/dashboard';
import type { CreateExpenseRequest, CreateIncomeRequest } from '@/types/transactions';
import { toDateKey } from '@/utils/format';

/**
 * Quantas receitas e quantas despesas mais recentes a tela de Transações carrega.
 * A API não tem paginação para despesas com data/categoria (só `lastest-expenses?count`).
 */
export const TRANSACTIONS_LIMIT = 50;

export const INCOME_CATEGORY_LABELS: Record<IncomeCategory, string> = {
  [IncomeCategory.Salary]: 'Salário',
  [IncomeCategory.Freelance]: 'Freelance',
  [IncomeCategory.Investment]: 'Investimento',
  [IncomeCategory.Commission]: 'Comissão',
  [IncomeCategory.Gift]: 'Presente',
  [IncomeCategory.Other]: 'Outros',
};

export function incomeToTransaction(income: Income): Transaction {
  return {
    key: `income-${income.id}`,
    kind: 'income',
    title: income.title,
    category: INCOME_CATEGORY_LABELS[income.category] ?? 'Receita',
    incomeCategory: income.category,
    amount: income.amount,
    date: toDateKey(income.receivedAt),
  };
}

export function expenseToTransaction(expense: LatestExpense): Transaction {
  return {
    key: `expense-${expense.id}`,
    kind: 'expense',
    title: expense.title,
    category: expense.category,
    amount: expense.amount,
    date: toDateKey(expense.expenseDate),
  };
}

/**
 * Junta receitas e despesas (endpoints separados na API), mais recentes primeiro.
 * `sort` é estável: em datas iguais, preserva a ordem de cada endpoint, receitas antes de despesas.
 */
export function mergeTransactions(
  incomes: Transaction[],
  expenses: Transaction[],
  limit?: number,
): Transaction[] {
  const merged = [...incomes, ...expenses].sort((a, b) => b.date.localeCompare(a.date));
  return limit === undefined ? merged : merged.slice(0, limit);
}

/** Resumo do mês corrente (data local do aparelho). */
export async function fetchMonthlySummary(
  token: string,
  now: Date = new Date(),
): Promise<MonthlySummary> {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const summary = await apiGet<MonthlySummary>('/api/dashboard/monthly-summary', token, {
    year,
    month,
  });
  return summary ?? { totalIncome: 0, totalExpense: 0, balance: 0, year, month };
}

/** As `count` receitas e as `count` despesas mais recentes. 204 da API vira lista vazia. */
export async function fetchLatestTransactions(token: string, count: number) {
  const [expenses, incomes] = await Promise.all([
    apiGet<LatestExpense[]>('/api/dashboard/lastest-expenses', token, { count }),
    apiGet<PagedResponse<Income>>('/api/income', token, { Page: 1, PageSize: count }),
  ]);
  return {
    expenses: (expenses ?? []).map(expenseToTransaction),
    incomes: (incomes?.data ?? []).map(incomeToTransaction),
    totalIncomes: incomes?.totalRecords ?? 0,
  };
}

export type TransactionsData = {
  incomes: Transaction[];
  expenses: Transaction[];
  summary: MonthlySummary;
  /** Há mais registros na API do que os carregados (limite de TRANSACTIONS_LIMIT por tipo). */
  truncated: boolean;
};

export async function getTransactions(token: string): Promise<TransactionsData> {
  const [summary, latest] = await Promise.all([
    fetchMonthlySummary(token),
    fetchLatestTransactions(token, TRANSACTIONS_LIMIT),
  ]);
  return {
    incomes: latest.incomes,
    expenses: latest.expenses,
    summary,
    // Para despesas a API não informa o total; lista cheia indica que pode haver mais.
    truncated:
      latest.totalIncomes > latest.incomes.length || latest.expenses.length >= TRANSACTIONS_LIMIT,
  };
}

/** Agrupa por dia, na ordem recebida (a lista já vem do mais recente para o mais antigo). */
export function groupByDate(transactions: Transaction[]): { date: string; items: Transaction[] }[] {
  const groups: { date: string; items: Transaction[] }[] = [];
  for (const transaction of transactions) {
    const last = groups[groups.length - 1];
    if (last?.date === transaction.date) last.items.push(transaction);
    else groups.push({ date: transaction.date, items: [transaction] });
  }
  return groups;
}

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Busca local por título ou categoria, sem diferenciar maiúsculas e acentos. */
export function searchTransactions(transactions: Transaction[], query: string): Transaction[] {
  const term = normalize(query.trim());
  if (!term) return transactions;
  return transactions.filter(
    (item) => normalize(item.title).includes(term) || normalize(item.category).includes(term),
  );
}

/** POST /api/income */
export async function createIncome(token: string, data: CreateIncomeRequest): Promise<void> {
  await apiPost('/api/income', data, token);
}

/** POST /api/expense */
export async function createExpense(token: string, data: CreateExpenseRequest): Promise<void> {
  await apiPost('/api/expense', data, token);
}
