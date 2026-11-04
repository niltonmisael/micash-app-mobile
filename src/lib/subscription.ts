import { apiDelete, apiGet, apiPost } from '@/lib/api';
import { SubscriptionStatus } from '@/types/user';
import type {
  ChatLimit,
  CheckoutResponse,
  CurrentSubscription,
  Plan,
  PlanLimits,
} from '@/types/user';
import { currentPeriod } from '@/utils/period';
import type { MonthPeriod } from '@/utils/period';

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  [SubscriptionStatus.Pending]: 'Pagamento pendente',
  [SubscriptionStatus.Active]: 'Ativa',
  [SubscriptionStatus.PastDue]: 'Pagamento em atraso',
  [SubscriptionStatus.Cancelled]: 'Cancelada',
  [SubscriptionStatus.Expired]: 'Expirada',
  [SubscriptionStatus.PaymentFailed]: 'Falha no pagamento',
};

/** Sem assinatura, a API responde com `planId` nulo (plano gratuito). */
export function isFreePlan(subscription: CurrentSubscription): boolean {
  return subscription.planId === null;
}

/** "Gratuito" ou o status da assinatura em português. */
export function subscriptionStatusLabel(subscription: CurrentSubscription): string {
  if (isFreePlan(subscription)) return 'Gratuito';
  return STATUS_LABELS[subscription.status] ?? subscription.statusDescription;
}

/** GET /api/subscription/current */
export async function getCurrentSubscription(token: string): Promise<CurrentSubscription> {
  const subscription = await apiGet<CurrentSubscription>('/api/subscription/current', token);
  if (!subscription) throw new Error('Assinatura sem conteúdo na resposta da API.');
  return subscription;
}

/** GET /api/plan — planos cadastrados no backend (nome e preço). */
export async function getPlans(token: string): Promise<Plan[]> {
  return (await apiGet<Plan[]>('/api/plan', token)) ?? [];
}

/**
 * POST /api/checkout — cria o link de pagamento no Pagar.me. A assinatura só fica ativa
 * depois que o pagamento é confirmado pelo webhook no backend, nunca por este retorno.
 */
export async function createCheckout(token: string, planId: number): Promise<string> {
  const response = await apiPost<CheckoutResponse>('/api/checkout', { planId }, token);
  if (!response?.checkoutUrl) throw new Error('A API não devolveu o link de pagamento.');
  return response.checkoutUrl;
}

/**
 * DELETE /api/subscription/cancel — agenda o cancelamento para o fim do período pago; o Premium
 * continua até lá. A API recusa (400) se já houver cancelamento agendado.
 */
export async function cancelSubscription(token: string): Promise<void> {
  await apiDelete('/api/subscription/cancel', token);
}

/** POST /api/subscription/reactivate — desfaz o cancelamento agendado (204). */
export async function reactivateSubscription(token: string): Promise<void> {
  await apiPost('/api/subscription/reactivate', undefined, token);
}

/** Até quando o Premium continua depois de um cancelamento agendado (DateTime em UTC). */
export function premiumAccessUntil(subscription: CurrentSubscription): string | null {
  return (
    subscription.cancellationScheduledFor ??
    subscription.endsAt ??
    subscription.nextBillingDate ??
    null
  );
}

export type BillingCycle = 'monthly' | 'annual';

export type PlansByCycle = Partial<Record<BillingCycle, Plan>>;

const ANNUAL_NAME = /anual|annual|year/i;
const MONTHLY_NAME = /mensal|monthly|month/i;

/**
 * Plano mensal e anual entre os planos da API. O período de cobrança fica no plano do Pagar.me e
 * não vem no contrato (`id`, `name`, `price`): vale o nome ("Premium Anual"/"Premium Mensal") e,
 * sem pista no nome, o mais barato é o mensal e o mais caro, o anual.
 */
export function plansByCycle(plans: Plan[]): PlansByCycle {
  const byPrice = [...plans].sort((a, b) => a.price - b.price);
  const annual =
    byPrice.find((plan) => ANNUAL_NAME.test(plan.name)) ??
    (byPrice.length > 1 ? byPrice[byPrice.length - 1] : undefined);
  const others = byPrice.filter((plan) => plan !== annual);
  const monthly = others.find((plan) => MONTHLY_NAME.test(plan.name)) ?? others[0];
  return { monthly, annual };
}

/** Desconto do anual sobre 12 mensalidades, em % inteiro (0 quando não há desconto). */
export function annualDiscountPercent(monthly: Plan, annual: Plan): number {
  const yearOfMonthly = monthly.price * 12;
  if (yearOfMonthly <= 0 || annual.price >= yearOfMonthly) return 0;
  return Math.floor((1 - annual.price / yearOfMonthly) * 100);
}

export type SubscriptionData = {
  current: CurrentSubscription;
  plans: Plan[];
};

export async function getSubscriptionData(token: string): Promise<SubscriptionData> {
  const [current, plans] = await Promise.all([getCurrentSubscription(token), getPlans(token)]);
  return { current, plans };
}

/** GET /api/subscription/limits — o que o plano atual permite (a API continua decidindo). */
export async function getPlanLimits(token: string): Promise<PlanLimits> {
  const limits = await apiGet<PlanLimits>('/api/subscription/limits', token);
  if (!limits) throw new Error('Limites do plano sem conteúdo na resposta da API.');
  return limits;
}

/**
 * Mês fora do histórico do plano: no Free, anterior aos `historyMonths` meses antes do atual
 * (meses futuros são liberados). Sem limites carregados, nada é bloqueado: a API decide.
 */
export function isHistoryLocked(
  limits: PlanLimits | undefined,
  period: MonthPeriod,
  now: Date = new Date(),
): boolean {
  if (!limits || limits.historyMonths === null) return false;
  const current = currentPeriod(now);
  const index = (value: MonthPeriod) => value.year * 12 + value.month;
  return index(period) < index(current) - limits.historyMonths;
}

/** Já chegou ao máximo do plano (`null`/`undefined` = sem limite ou ainda não carregado). */
export function reachedLimit(max: number | null | undefined, count: number): boolean {
  return max !== null && max !== undefined && count >= max;
}

/** Aviso do Free sem mensagens no mês, com o limite que a API informa. */
export function chatMonthExhaustedMessage(chat: ChatLimit): string {
  return `Você usou suas ${chat.limit} mensagens do mês. Assine o Premium para continuar conversando.`;
}

/** "2 de 5 mensagens restantes este mês" (Free) ou "12 de 30 restantes hoje" (Premium). */
export function chatUsageLabel(chat: ChatLimit): string {
  return chat.period === 'month'
    ? `${chat.remaining} de ${chat.limit} mensagens restantes este mês`
    : `${chat.remaining} de ${chat.limit} restantes hoje`;
}
