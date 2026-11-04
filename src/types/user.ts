// Contratos de usuário e assinatura de MiCash.API (MiCash.Communication).

/** ResponseUserProfileJson — GET /api/user/profile. A API não devolve telefone. */
export type UserProfile = {
  name: string;
  email: string;
};

/** RequestUpdateUserJson — PUT /api/user/update (só nome e e-mail). */
export type UpdateProfileRequest = UserProfile;

/** RequestChangePasswordJson — PUT /api/user/change-password (a confirmação não é enviada). */
export type ChangePasswordRequest = {
  password: string;
  newPassword: string;
};

/** ResponsePlansJson — GET /api/plan. A API não informa benefícios, limites nem periodicidade. */
export type Plan = {
  id: number;
  name: string;
  price: number;
};

/** SubscriptionStatus (MiCash.Domain.Enums). */
export enum SubscriptionStatus {
  Pending = 0,
  Active = 1,
  PastDue = 2,
  Cancelled = 3,
  Expired = 4,
  PaymentFailed = 5,
}

/**
 * ResponseCurrentSubscriptionJson — GET /api/subscription/current.
 * Sem assinatura, a API devolve `planId: null` e `planName: "Free"` (com status 0, que
 * coincide com Pending; por isso o plano gratuito é identificado pelo `planId` nulo).
 */
export type CurrentSubscription = {
  planId: number | null;
  planName: string;
  status: SubscriptionStatus;
  statusDescription: string;
  cancelAtPeriodEnd: boolean;
  nextBillingDate: string | null;
  endsAt: string | null;
  /** Dia em que o cancelamento agendado acontece (fim do período pago), em UTC. */
  cancellationScheduledFor?: string | null;
  price: number;
};

/** ResponseCheckoutJson — POST /api/checkout (link de pagamento do Pagar.me). */
export type CheckoutResponse = {
  checkoutUrl: string;
};

/** ResponseChatLimitJson — contador de mensagens do chat com a MI. */
export type ChatLimit = {
  /** "month" no Free, "day" no Premium (zera à meia-noite de Brasília). */
  period: 'month' | 'day';
  limit: number;
  used: number;
  remaining: number;
  /** Quando o contador zera (DateTime em UTC). */
  resetsAt: string;
  /** Limite extra por minuto (Premium); `null` quando não há. */
  perMinute: number | null;
};

/**
 * ResponsePlanLimitsJson — GET /api/subscription/limits. Só assinatura ativa é Premium
 * (pendente, em atraso ou cancelada contam como Free). `null` = sem limite.
 */
export type PlanLimits = {
  plan: 'Free' | 'Premium';
  isPremium: boolean;
  maxFinancialGoalsPerMonth: number | null;
  maxSavingsGoals: number | null;
  /** Meses anteriores ao atual visíveis no Dashboard, metas e insights; `null` = todo o histórico. */
  historyMonths: number | null;
  fullInsights: boolean;
  goalWarningAlerts: boolean;
  canCopyFinancialGoals: boolean;
  monthForecast: boolean;
  chat: ChatLimit;
};
