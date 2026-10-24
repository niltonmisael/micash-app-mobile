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
  price: number;
};

/** ResponseCheckoutJson — POST /api/checkout (link de pagamento do Pagar.me). */
export type CheckoutResponse = {
  checkoutUrl: string;
};
