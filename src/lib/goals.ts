import { apiDelete, apiGet, apiPost, apiPut } from '@/lib/api';
import { getCategories } from '@/lib/categories';
import type {
  CopyGoalsRequest,
  CreateGoalRequest,
  FinancialGoal,
  FinancialGoalProgress,
  FinancialGoalsProgressResponse,
  FinancialGoalsResponse,
  GoalLimit,
} from '@/types/goals';
import type { Category } from '@/types/transactions';
import type { MonthPeriod } from '@/utils/period';

// Metas = limites de gasto por categoria de despesa e mês (`api/financial-goal`).

const BASE_PATH = '/api/financial-goal';

/** Metas do mês com id (204 vira lista vazia). */
export async function getGoalsByPeriod(
  token: string,
  period: MonthPeriod,
): Promise<FinancialGoal[]> {
  const response = await apiGet<FinancialGoalsResponse>(BASE_PATH, token, {
    month: period.month,
    year: period.year,
  });
  return response?.financialGoals ?? [];
}

/** Progresso de cada meta do mês, calculado pela API com as despesas da categoria. */
export async function getGoalsProgress(
  token: string,
  period: MonthPeriod,
): Promise<FinancialGoalProgress[]> {
  const response = await apiGet<FinancialGoalsProgressResponse>(`${BASE_PATH}/progress`, token, {
    month: period.month,
    year: period.year,
  });
  return response?.goals ?? [];
}

/**
 * Junta o progresso (sem id da meta) com as metas do mês (com id) pela categoria, que é única
 * por mês, e com as categorias ativas para o ícone e a cor. Metas de categorias inativas
 * continuam na lista, com a aparência padrão.
 */
export function buildGoalLimits(
  progress: FinancialGoalProgress[],
  goals: FinancialGoal[],
  categories: Category[],
): GoalLimit[] {
  const goalIds = new Map(goals.map((goal) => [goal.categoryId, goal.id]));
  const appearance = new Map(categories.map((category) => [category.id, category]));

  return progress.flatMap((item) => {
    const id = goalIds.get(item.categoryId);
    if (id === undefined) return [];
    const category = appearance.get(item.categoryId);
    return [
      {
        id,
        categoryId: item.categoryId,
        name: item.categoryName,
        icon: category?.icon,
        color: category?.color,
        targetAmount: item.targetAmount,
        currentAmount: item.currentAmount,
        remainingAmount: item.remainingAmount,
        percentageUsed: item.percentageUsed,
        status: item.status,
      },
    ];
  });
}

/** Limites de gasto do mês, prontos para exibir. */
export async function getGoalLimits(token: string, period: MonthPeriod): Promise<GoalLimit[]> {
  const [progress, goals, categories] = await Promise.all([
    getGoalsProgress(token, period),
    getGoalsByPeriod(token, period),
    getCategories(token),
  ]);
  return buildGoalLimits(progress, goals, categories);
}

/** Os limites mais próximos de estourar (maior percentual usado primeiro). */
export function mostUsedGoalLimits(limits: GoalLimit[], count: number): GoalLimit[] {
  return [...limits].sort((a, b) => b.percentageUsed - a.percentageUsed).slice(0, count);
}

/** GET /api/financial-goal/{id} (404 quando não existe ou não é do usuário). */
export async function getGoal(token: string, id: number): Promise<FinancialGoal> {
  const goal = await apiGet<FinancialGoal>(`${BASE_PATH}/${id}`, token);
  if (!goal) throw new Error('Meta sem conteúdo na resposta da API.');
  return goal;
}

/**
 * POST /api/financial-goal — a categoria precisa ser do usuário e estar ativa, e só pode haver
 * uma meta por categoria no mês (a API responde 400/404 com a mensagem).
 */
export async function createGoal(token: string, data: CreateGoalRequest): Promise<void> {
  await apiPost(BASE_PATH, data, token);
}

/** PUT /api/financial-goal/{id} — a API só permite alterar o valor. */
export async function updateGoal(token: string, id: number, targetAmount: number): Promise<void> {
  await apiPut(`${BASE_PATH}/${id}`, { targetAmount }, token);
}

/** DELETE /api/financial-goal/{id} — exclusão definitiva. */
export async function deleteGoal(token: string, id: number): Promise<void> {
  await apiDelete(`${BASE_PATH}/${id}`, token);
}

/**
 * POST /api/financial-goal/copy — copia as metas de `source` para `target`. A API recusa (400)
 * quando a origem não tem metas ou o destino já tem.
 */
export async function copyGoals(
  token: string,
  source: MonthPeriod,
  target: MonthPeriod,
): Promise<void> {
  const body: CopyGoalsRequest = {
    sourceMonth: source.month,
    sourceYear: source.year,
    targetMonth: target.month,
    targetYear: target.year,
  };
  await apiPost(`${BASE_PATH}/copy`, body, token);
}
