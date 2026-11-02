// Contratos de metas financeiras da MiCash.API (`api/financial-goal`). Na API, uma meta é um
// limite de gasto de uma categoria de despesa em um mês; não há metas de economia (poupança).

/** FinancialGoalProgressStatus — Normal (< 80%), Warning (80% a < 100%), Exceeded (≥ 100%). */
export enum GoalStatus {
  Normal = 0,
  Warning = 1,
  Exceeded = 2,
}

/** ResponseFinancialGoalJson — GET /api/financial-goal/{id} e itens de GET ?month&year. */
export type FinancialGoal = {
  id: number;
  categoryId: number;
  categoryName: string;
  targetAmount: number;
  month: number;
  year: number;
};

/** ResponseFinancialGoalsJson — GET /api/financial-goal?month&year (204 sem metas). */
export type FinancialGoalsResponse = {
  financialGoals: FinancialGoal[];
};

/**
 * ResponseFinancialGoalProgressJson — não traz o id da meta, só a categoria (única por mês).
 * `remainingAmount` fica negativo quando o limite é ultrapassado.
 */
export type FinancialGoalProgress = {
  categoryId: number;
  categoryName: string;
  targetAmount: number;
  currentAmount: number;
  remainingAmount: number;
  percentageUsed: number;
  status: GoalStatus;
  statusDescription: string;
};

/** ResponseFinancialGoalsProgressJson — GET /api/financial-goal/progress?month&year */
export type FinancialGoalsProgressResponse = {
  goals: FinancialGoalProgress[];
};

/** RequestRegisterFinancialGoal — POST /api/financial-goal (201 com `{ id }`). */
export type CreateGoalRequest = {
  categoryId: number;
  targetAmount: number;
  month: number;
  year: number;
};

/** RequestCopyFinancialGoalsJson — POST /api/financial-goal/copy (destino sem metas). */
export type CopyGoalsRequest = {
  sourceMonth: number;
  sourceYear: number;
  targetMonth: number;
  targetYear: number;
};

/** Limite de gasto exibido no app: progresso do mês + id da meta + aparência da categoria. */
export type GoalLimit = {
  /** Id da meta (para editar/excluir). */
  id: number;
  categoryId: number;
  name: string;
  icon?: string;
  color?: string;
  targetAmount: number;
  currentAmount: number;
  remainingAmount: number;
  percentageUsed: number;
  status: GoalStatus;
};
