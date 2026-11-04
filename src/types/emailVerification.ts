// Contratos da verificação e da troca de e-mail da MiCash.API (AuthController e UserController).
// O código de 6 dígitos chega por e-mail; o app nunca o recebe nem o guarda.

/** RequestVerifyEmailJson — POST /verify-email */
export type VerifyEmailRequest = {
  code: string;
};

/**
 * ResponseEmailVerifiedJson — tokens NOVOS (o token anterior continua dizendo "não verificado").
 * `showPremiumOffer` é só para o cadastro pela web: o app não vende assinaturas e o ignora.
 */
export type EmailVerifiedResponse = {
  name: string;
  token: string;
  refreshToken: string;
  emailVerified: boolean;
  showPremiumOffer: boolean;
};

/**
 * ResponseEmailVerificationCodeSentJson (202) — POST /resend-email-verification-code,
 * PUT /email-verification/email e POST /api/user/email-change. Regras para a contagem do reenvio.
 */
export type EmailCodeSentResponse = {
  email: string;
  resendAvailableInSeconds: number;
  codeExpiresInMinutes: number;
  codeLength: number;
};

/** RequestChangeVerificationEmailJson — PUT /email-verification/email (corrige antes de confirmar). */
export type ChangeVerificationEmailRequest = {
  email: string;
};

/** RequestEmailChangeJson — POST /api/user/email-change (conta já verificada). */
export type EmailChangeRequest = {
  newEmail: string;
  /** Senha atual: uma sessão roubada sozinha não muda o e-mail da conta. */
  password: string;
};

/** RequestConfirmEmailChangeJson — POST /api/user/email-change/confirm */
export type ConfirmEmailChangeRequest = {
  code: string;
};
