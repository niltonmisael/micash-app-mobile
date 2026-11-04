// Contratos de MiCash.API usados pelo Dashboard (camelCase, valores `decimal` chegam como number).

/** ResponseMonthlySummaryJson — `balance` é receitas − despesas do mês, não um saldo acumulado. */
export type MonthlySummary = {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  year: number;
  month: number;
};

/** ResponseDailySummaryItemJson — valores de um dia; os acumulados já vêm calculados pela API. */
export type DailySummaryDay = {
  day: number;
  income: number;
  expense: number;
  /** Do dia 1 até este dia; no último dia, igual ao `totalIncome` do monthly-summary. */
  cumulativeIncome: number;
  /** Do dia 1 até este dia; no último dia, igual ao `totalExpense` do monthly-summary. */
  cumulativeExpense: number;
};

/**
 * ResponseDailySummaryJson — GET /api/dashboard/daily-summary?year&month. Todos os dias do mês
 * (28 a 31), inclusive os sem lançamento (0); mesmos lançamentos e regra de mês do monthly-summary.
 */
export type DailySummary = {
  year: number;
  month: number;
  days: DailySummaryDay[];
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

/** ResponseGoalForecastJson — previsão de uma meta de gasto (limite) do mês. */
export type GoalForecast = {
  categoryId: number;
  categoryName: string;
  targetAmount: number;
  currentAmount: number;
  projectedAmount: number;
  /** A meta já passou de 100%. */
  alreadyExceeded: boolean;
  /** Mantido o ritmo, a meta estoura por volta de `estimatedExceedDay`. */
  willExceed: boolean;
  /** Dia do mês previsto para estourar; `null` quando não vai estourar. */
  estimatedExceedDay: number | null;
};

/**
 * ResponseMonthForecastJson — GET /api/dashboard/month-forecast (Premium; 403 sem assinatura).
 * Sempre o mês corrente no horário de Brasília; todos os valores vêm calculados pela API.
 */
export type MonthForecast = {
  year: number;
  month: number;
  today: number;
  daysInMonth: number;
  /** `false` com poucos dados (menos de 5 dias ou de 3 despesas): os números não são exibidos. */
  isReliable: boolean;
  /** Receitas lançadas no mês (não projetadas). */
  income: number;
  expenseToDate: number;
  /** Despesas já lançadas para depois de hoje. */
  scheduledExpense: number;
  dailyExpenseRate: number;
  projectedExpense: number;
  /** Quanto sobra (positivo) ou falta (negativo) no fim do mês. */
  projectedBalance: number;
  goals: GoalForecast[];
};
