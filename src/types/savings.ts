// Contratos de metas de economia da MiCash.API (`api/savings-goal`). Independentes dos limites de
// gasto (`api/financial-goal`): têm valor alvo, prazo opcional e um histórico de depósitos e
// retiradas. Todos os valores derivados (guardado, falta, percentual, por mês) vêm da API.

/** SavingsMovementType (MiCash.Domain.Enums) */
export enum SavingsMovementType {
  Deposit = 0,
  Withdrawal = 1,
}

/** ResponseShortSavingsGoalJson — itens de GET /api/savings-goal. */
export type SavingsGoalSummary = {
  id: number;
  name: string;
  icon: string;
  color: string;
  targetAmount: number;
  savedAmount: number;
  /** Pode passar de 100; a barra é limitada a 100%. */
  percentage: number;
  /** DateOnly "AAAA-MM-DD" (último dia do mês escolhido); `null` = sem prazo. */
  deadline: string | null;
  isCompleted: boolean;
};

/**
 * ResponseSavingsGoalsJson — GET /api/savings-goal (204 sem metas). Em andamento primeiro (por
 * prazo, as sem prazo por último), depois as concluídas.
 */
export type SavingsGoalsResponse = {
  savingsGoals: SavingsGoalSummary[];
};

/** ResponseSavingsMovementJson */
export type SavingsMovement = {
  id: number;
  type: SavingsMovementType;
  amount: number;
  /** DateOnly "AAAA-MM-DD" */
  date: string;
};

/** ResponseSavingsGoalJson — GET /api/savings-goal/{id}. */
export type SavingsGoal = SavingsGoalSummary & {
  remainingAmount: number;
  /** `null` quando não há prazo ou a meta está concluída. */
  monthlyAmountNeeded: number | null;
  /** Do mais recente para o mais antigo. */
  movements: SavingsMovement[];
};

/** RequestUpdateSavingsGoalJson — PUT /api/savings-goal/{id} (204). */
export type UpdateSavingsGoalRequest = {
  name: string;
  targetAmount: number;
  deadline: string | null;
  icon: string;
  color: string;
};

/** RequestRegisterSavingsGoalJson — POST /api/savings-goal (201 com `{ id }`). */
export type CreateSavingsGoalRequest = UpdateSavingsGoalRequest & {
  /** "Já guardado": vira um depósito com a data de hoje. */
  initialAmount: number | null;
};

/** RequestSavingsMovementJson — POST /api/savings-goal/{id}/deposit|withdraw (201 com `{ id }`). */
export type SavingsMovementRequest = {
  amount: number;
  /** DateOnly "AAAA-MM-DD"; a API recusa datas futuras. */
  date: string;
};
