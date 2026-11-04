import { apiDelete, apiGet, apiPost } from '@/lib/api';
import { SubscriptionStatus } from '@/types/user';
import type { BillingPeriod, ChatLimit, CurrentSubscription, PlanLimits } from '@/types/user';
import { currentPeriod } from '@/utils/period';
import type { MonthPeriod } from '@/utils/period';

// O app só CONSOME a assinatura: a contratação acontece no site do MiCash (Pagar.me). Aqui não há
// checkout, preço de venda nem chamada para assinar; a API decide quem é Premium e o app só lê.

const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  [SubscriptionStatus.Pending]: 'Pagamento em confirmação',
  [SubscriptionStatus.Active]: 'Ativa',
  [SubscriptionStatus.PastDue]: 'Pagamento em atraso',
  [SubscriptionStatus.Cancelled]: 'Cancelada',
  [SubscriptionStatus.Expired]: 'Expirada',
  [SubscriptionStatus.PaymentFailed]: 'Renovação pendente',
};

const BILLING_PERIOD_SUFFIX: Record<BillingPeriod, string> = { Monthly: '/mês', Yearly: '/ano' };

/** Sem assinatura, a API responde com `planId` nulo (plano gratuito). */
export function isFreePlan(subscription: CurrentSubscription): boolean {
  return subscription.planId === null;
}

/** "Gratuito" ou o status da assinatura em português. */
export function subscriptionStatusLabel(subscription: CurrentSubscription): string {
  if (isFreePlan(subscription)) return 'Gratuito';
  if (subscription.isPremium && subscription.cancelAtPeriodEnd) return 'Cancelamento agendado';
  return STATUS_LABELS[subscription.status] ?? subscription.statusDescription;
}

/** "/mês" ou "/ano" para o preço do plano assinado. */
export function billingPeriodSuffix(period: BillingPeriod | null): string | undefined {
  return period ? BILLING_PERIOD_SUFFIX[period] : undefined;
}

/** Renovação recusada, com o Premium ainda liberado durante a tolerância (a cobrança é repetida). */
export function isInPaymentGrace(subscription: CurrentSubscription): boolean {
  return (
    subscription.isPremium &&
    subscription.status === SubscriptionStatus.PaymentFailed &&
    !!subscription.paymentGraceUntil
  );
}

/** GET /api/subscription/current — o que a API diz da assinatura (web e app veem o mesmo). */
export async function getCurrentSubscription(token: string): Promise<CurrentSubscription> {
  const subscription = await apiGet<CurrentSubscription>('/api/subscription/current', token);
  if (!subscription) throw new Error('Assinatura sem conteúdo na resposta da API.');
  return subscription;
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

/** Até quando o Premium continua quando ele vai acabar (cancelamento ou tolerância), em UTC. */
export function premiumAccessUntil(subscription: CurrentSubscription): string | null {
  return (
    subscription.accessEndsAt ??
    subscription.cancellationScheduledFor ??
    subscription.endsAt ??
    subscription.nextBillingDate ??
    null
  );
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

/** Aviso do Free sem mensagens no mês, com o limite que a API informa (sem chamada para assinar). */
export function chatMonthExhaustedMessage(chat: ChatLimit): string {
  return `Você usou suas ${chat.limit} mensagens do mês com a MI. Novas mensagens são liberadas no próximo mês.`;
}

/** "2 de 5 mensagens restantes este mês" (Free) ou "12 de 30 restantes hoje" (Premium). */
export function chatUsageLabel(chat: ChatLimit): string {
  return chat.period === 'month'
    ? `${chat.remaining} de ${chat.limit} mensagens restantes este mês`
    : `${chat.remaining} de ${chat.limit} restantes hoje`;
}
