// Contratos de usuário e assinatura de MiCash.API (MiCash.Communication).

/** ResponseUserProfileJson — GET /api/user/profile. A API não devolve telefone. */
export type UserProfile = {
  name: string;
  email: string;
  emailVerified: boolean;
};

/**
 * RequestUpdateUserJson — PUT /api/user/update. Só o nome muda aqui: o e-mail precisa ser o atual
 * (outro e-mail = 400 `EMAIL_CHANGE_REQUIRES_CONFIRMATION`; a troca é feita em `change-email`).
 */
export type UpdateProfileRequest = {
  name: string;
  email: string;
};

/** RequestChangePasswordJson — PUT /api/user/change-password (a confirmação não é enviada). */
export type ChangePasswordRequest = {
  password: string;
  newPassword: string;
};

/** Periodicidade do plano (BillingPeriod da API). */
export type BillingPeriod = 'Monthly' | 'Yearly';

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
 * ResponseCurrentSubscriptionJson — GET /api/subscription/current. Só leitura: a assinatura muda
 * pelos webhooks do Pagar.me e pelos jobs da API, nunca pelo app. Sem assinatura, a API devolve
 * `planId: null` e `planName: "Free"` (status 0, que coincide com Pending).
 */
export type CurrentSubscription = {
  planId: number | null;
  planName: string;
  status: SubscriptionStatus;
  statusDescription: string;
  /** Se o usuário tem os benefícios do Premium agora (decidido pela API). */
  isPremium: boolean;
  startsAt: string | null;
  cancelAtPeriodEnd: boolean;
  /** Renova sozinha na `nextBillingDate` (ativa e sem cancelamento agendado). */
  autoRenew: boolean;
  nextBillingDate: string | null;
  /**
   * Quando o Premium termina se nada mudar: fim do período pago (cancelamento agendado) ou fim da
   * tolerância de uma renovação recusada. `null` enquanto renova normalmente (ou no Free).
   */
  accessEndsAt: string | null;
  /** Renovação recusada: o Premium continua até este momento enquanto a cobrança é repetida. */
  paymentGraceUntil: string | null;
  endsAt: string | null;
  /** Dia em que o cancelamento agendado acontece (fim do período pago), em UTC. */
  cancellationScheduledFor: string | null;
  price: number;
  /** `null` no Free. */
  billingPeriod: BillingPeriod | null;
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
 * ResponsePlanLimitsJson — GET /api/subscription/limits. A API decide o Premium (assinatura ativa,
 * ou renovação recusada dentro da tolerância). `null` = sem limite.
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
