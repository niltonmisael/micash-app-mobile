import { apiDelete, apiGet, apiPost, apiPut } from '@/lib/api';
import type {
  CreateSavingsGoalRequest,
  SavingsGoal,
  SavingsGoalSummary,
  SavingsGoalsResponse,
  SavingsMovementRequest,
  UpdateSavingsGoalRequest,
} from '@/types/savings';
import { SavingsMovementType } from '@/types/savings';

// Metas de economia (`api/savings-goal`). Só a meta do próprio usuário é acessível: as de outros
// respondem 404, como as inexistentes.

const BASE_PATH = '/api/savings-goal';

/** Metas na ordem da API (204 vira lista vazia). */
export async function getSavingsGoals(token: string): Promise<SavingsGoalSummary[]> {
  const response = await apiGet<SavingsGoalsResponse>(BASE_PATH, token);
  return response?.savingsGoals ?? [];
}

/** GET /api/savings-goal/{id} — valores calculados e histórico de movimentos. */
export async function getSavingsGoal(token: string, id: number): Promise<SavingsGoal> {
  const goal = await apiGet<SavingsGoal>(`${BASE_PATH}/${id}`, token);
  if (!goal) throw new Error('Meta sem conteúdo na resposta da API.');
  return goal;
}

/** POST /api/savings-goal — `initialAmount` > 0 vira o primeiro depósito do histórico. */
export async function createSavingsGoal(
  token: string,
  data: CreateSavingsGoalRequest,
): Promise<void> {
  await apiPost(BASE_PATH, data, token);
}

/** PUT /api/savings-goal/{id} — a API só valida o prazo se ele mudar. */
export async function updateSavingsGoal(
  token: string,
  id: number,
  data: UpdateSavingsGoalRequest,
): Promise<void> {
  await apiPut(`${BASE_PATH}/${id}`, data, token);
}

/** DELETE /api/savings-goal/{id} — exclui a meta e todo o histórico. */
export async function deleteSavingsGoal(token: string, id: number): Promise<void> {
  await apiDelete(`${BASE_PATH}/${id}`, token);
}

/**
 * POST /api/savings-goal/{id}/deposit ou /withdraw. Depósitos são aceitos mesmo com a meta
 * concluída; a retirada não pode passar do valor guardado (a API responde 400 com a mensagem).
 */
export async function registerSavingsMovement(
  token: string,
  id: number,
  type: SavingsMovementType,
  data: SavingsMovementRequest,
): Promise<void> {
  const action = type === SavingsMovementType.Deposit ? 'deposit' : 'withdraw';
  await apiPost(`${BASE_PATH}/${id}/${action}`, data, token);
}
