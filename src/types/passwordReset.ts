// Contratos da recuperação de senha da MiCash.API (rotas anônimas do AuthController). O código
// chega por e-mail; a autorização devolvida pela verificação não é uma sessão.

/** RequestForgotPasswordJson — POST /forgot-password (também usado para reenviar o código). */
export type ForgotPasswordRequest = {
  email: string;
};

/**
 * ResponseForgotPasswordJson (202) — a mesma resposta exista ou não a conta. Os valores são as
 * regras do fluxo (para a contagem do reenvio e os textos da tela).
 */
export type ForgotPasswordResponse = {
  resendAvailableInSeconds: number;
  codeExpiresInMinutes: number;
  codeLength: number;
};

/** RequestVerifyPasswordResetCodeJson — POST /verify-password-reset-code */
export type VerifyPasswordResetCodeRequest = {
  email: string;
  /** Só dígitos, com o tamanho de `codeLength` (6). */
  code: string;
};

/** ResponsePasswordResetCodeVerifiedJson (200) — autorização de uso único para /reset-password. */
export type PasswordResetCodeVerifiedResponse = {
  resetToken: string;
  expiresInMinutes: number;
};

/** RequestResetPasswordJson — POST /reset-password (204; o usuário entra depois com a nova senha). */
export type ResetPasswordRequest = {
  resetToken: string;
  newPassword: string;
};
