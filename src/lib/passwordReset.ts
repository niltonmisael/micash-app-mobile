import { ApiError, apiPost } from '@/lib/api';
import type {
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  PasswordResetCodeVerifiedResponse,
  ResetPasswordRequest,
  VerifyPasswordResetCodeRequest,
} from '@/types/passwordReset';

// Recuperação de senha em três etapas, sem sessão: código por e-mail → autorização de uso
// único → nova senha. O e-mail é enviado pela API (Hangfire + Resend), nunca pelo app.

const PASSWORD_RESET_UNKNOWN_ERROR = 'Ocorreu um erro inesperado. Tente novamente.';

/** Valores da API (PasswordResetRules), usados até a primeira resposta chegar. */
export const PASSWORD_RESET_DEFAULTS: ForgotPasswordResponse = {
  resendAvailableInSeconds: 60,
  codeExpiresInMinutes: 15,
  codeLength: 6,
};

/** Tentativas por código (PasswordResetRules.MAX_ATTEMPTS); depois a API invalida o código. */
export const PASSWORD_RESET_MAX_ATTEMPTS = 5;

/**
 * POST /forgot-password — pede (ou reenvia) o código. A resposta é sempre a mesma, exista ou não
 * a conta; antes do intervalo de reenvio ou acima de 5 pedidos por hora, a API ignora em silêncio.
 */
export async function requestPasswordReset(email: string): Promise<ForgotPasswordResponse> {
  const body: ForgotPasswordRequest = { email: email.trim() };
  const response = await apiPost<ForgotPasswordResponse>('/forgot-password', body);
  return { ...PASSWORD_RESET_DEFAULTS, ...response };
}

/**
 * POST /verify-password-reset-code — troca o código pela autorização de redefinição. Código
 * errado, expirado, já usado ou com as tentativas esgotadas têm a mesma mensagem (400).
 */
export async function verifyPasswordResetCode(
  email: string,
  code: string,
): Promise<PasswordResetCodeVerifiedResponse> {
  const body: VerifyPasswordResetCodeRequest = { email: email.trim(), code };
  const response = await apiPost<PasswordResetCodeVerifiedResponse>(
    '/verify-password-reset-code',
    body,
  );
  if (!response?.resetToken) throw new ApiError(PASSWORD_RESET_UNKNOWN_ERROR);
  return response;
}

/**
 * POST /reset-password — grava a nova senha e consome a autorização. Sessões abertas antes deixam
 * de ser renovadas; o app não entra sozinho, o usuário faz login com a nova senha.
 */
export async function resetPassword(resetToken: string, newPassword: string): Promise<void> {
  const body: ResetPasswordRequest = { resetToken, newPassword };
  await apiPost('/reset-password', body);
}

/**
 * Mensagem para o usuário. As de validação (400) e do limite (429) da API já são escritas para
 * ele, assim como a falha de conexão; outros status viram uma mensagem genérica.
 */
export function passwordResetErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return PASSWORD_RESET_UNKNOWN_ERROR;
  if (error.status === undefined || error.status === 400 || error.status === 429) {
    return error.message;
  }
  return PASSWORD_RESET_UNKNOWN_ERROR;
}
