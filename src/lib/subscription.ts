import { apiGet, apiPost } from '@/lib/api';
import { SubscriptionStatus } from '@/types/user';
import type { CheckoutResponse, CurrentSubscription, Plan } from '@/types/user';

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

export type SubscriptionData = {
  current: CurrentSubscription;
  plans: Plan[];
};

export async function getSubscriptionData(token: string): Promise<SubscriptionData> {
  const [current, plans] = await Promise.all([getCurrentSubscription(token), getPlans(token)]);
  return { current, plans };
}
