// Contratos de MiCash.API usados pelo Dashboard (camelCase, valores `decimal` chegam como number).

/** ResponseMonthlySummaryJson — `balance` é receitas − despesas do mês, não um saldo acumulado. */
export type MonthlySummary = {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  year: number;
  month: number;
};

/** ResponseLatestExpenseJson (`expenseDate` é um DateTime). */
export type LatestExpense = {
  id: number;
  title: string;
  category: string;
  color: string;
  amount: number;
  expenseDate: string;
};

/** IncomeCategory (enum serializado como número). */
export enum IncomeCategory {
  Salary = 1,
  Freelance = 2,
  Investment = 3,
  Commission = 4,
  Gift = 5,
  Other = 99,
}

/** ResponseIncomeJson (`receivedAt` é um DateOnly, "AAAA-MM-DD"). */
export type Income = {
  id: number;
  title: string;
  description?: string | null;
  amount: number;
  receivedAt: string;
  category: IncomeCategory;
};

/** ResponsePagedJson<T> — formato real de GET /api/income. */
export type PagedResponse<T> = {
  data: T[];
  page: number;
  pageSize: number;
  totalRecords: number;
};

/** Movimentação exibida no app, montada a partir de uma despesa ou de uma receita da API. */
export type Transaction = {
  key: string;
  kind: 'income' | 'expense';
  title: string;
  category: string;
  /** Só para receitas: define o ícone. Despesas não trazem o ícone da categoria na API. */
  incomeCategory?: IncomeCategory;
  /** Valor positivo, como vem da API; o sinal é aplicado só na exibição. */
  amount: number;
  /** "AAAA-MM-DD" no fuso do aparelho */
  date: string;
};

/**
 * ResponseExpenseCategorySummaryJson — GET /api/dashboard/expenses-by-category.
 * `percentage` já vem calculado pela API (0–100, duas casas; 0 quando o total do mês é 0).
 */
export type ExpenseCategorySummary = {
  categoryId: number;
  categoryName: string;
  amount: number;
  categoryColor: string;
  percentage: number;
};
