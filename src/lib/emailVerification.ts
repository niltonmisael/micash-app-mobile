import { ApiError, apiPost, apiPut } from '@/lib/api';
import { replaceSession } from '@/lib/auth';
import type { Session } from '@/types/auth';
import type {
  ChangeVerificationEmailRequest,
  ConfirmEmailChangeRequest,
  EmailChangeRequest,
  EmailCodeSentResponse,
  EmailVerifiedResponse,
  VerifyEmailRequest,
} from '@/types/emailVerification';
import type { UserProfile } from '@/types/user';

// Verificação do e-mail do cadastro e troca de e-mail de uma conta verificada. As rotas exigem a
// sessão (chame com `withSession`). O código é enviado pela API (Hangfire + Resend), nunca pelo app.

const UNKNOWN_ERROR = 'Ocorreu um erro inesperado. Tente novamente.';

/** Regras da API (EmailVerificationRules), usadas até a primeira resposta chegar. */
export const EMAIL_CODE_DEFAULTS = {
  resendAvailableInSeconds: 60,
  codeExpiresInMinutes: 15,
  codeLength: 6,
} as const;

/** Tentativas por código; depois a API invalida o código (mesma mensagem de código errado). */
export const EMAIL_CODE_MAX_ATTEMPTS = 5;

/**
 * POST /verify-email — confirma o e-mail do cadastro. A API devolve tokens novos (o anterior
 * continua "não verificado"), que viram a sessão salva. `showPremiumOffer` é só para a web.
 */
export async function verifyEmail(token: string, code: string): Promise<Session> {
  const body: VerifyEmailRequest = { code };
  const response = await apiPost<EmailVerifiedResponse>('/verify-email', body, token);
  if (!response?.token) throw new ApiError(UNKNOWN_ERROR);
  return replaceSession({
    name: response.name,
    token: response.token,
    refreshToken: response.refreshToken,
    emailVerified: true,
  });
}

/** POST /resend-email-verification-code — novo código (429 com `retryAt` antes do intervalo). */
export async function resendEmailVerificationCode(token: string): Promise<EmailCodeSentResponse> {
  const response = await apiPost<EmailCodeSentResponse>(
    '/resend-email-verification-code',
    undefined,
    token,
  );
  if (!response) throw new ApiError(UNKNOWN_ERROR);
  return response;
}

/**
 * PUT /email-verification/email — corrige o e-mail digitado errado ANTES de confirmar; o novo
 * código vai para o endereço novo. E-mail já cadastrado: 400.
 */
export async function changeVerificationEmail(
  token: string,
  email: string,
): Promise<EmailCodeSentResponse> {
  const body: ChangeVerificationEmailRequest = { email: email.trim() };
  const response = await apiPut<EmailCodeSentResponse>('/email-verification/email', body, token);
  if (!response) throw new ApiError(UNKNOWN_ERROR);
  return response;
}

/**
 * POST /api/user/email-change — etapa 1 da troca de e-mail de uma conta verificada: confere a
 * senha atual e envia o código para o novo endereço. A conta continua com o e-mail atual até a
 * etapa 2. Chamar de novo (depois de 60 s) reenvia o código.
 */
export async function requestEmailChange(
  token: string,
  newEmail: string,
  password: string,
): Promise<EmailCodeSentResponse> {
  const body: EmailChangeRequest = { newEmail: newEmail.trim(), password };
  const response = await apiPost<EmailCodeSentResponse>('/api/user/email-change', body, token);
  if (!response) throw new ApiError(UNKNOWN_ERROR);
  return response;
}

/**
 * POST /api/user/email-change/confirm — etapa 2: o código recebido no novo endereço aplica a troca
 * e a API devolve o perfil atualizado. O e-mail anterior recebe um aviso de segurança.
 */
export async function confirmEmailChange(token: string, code: string): Promise<UserProfile> {
  const body: ConfirmEmailChangeRequest = { code };
  const response = await apiPost<UserProfile>('/api/user/email-change/confirm', body, token);
  if (!response) throw new ApiError(UNKNOWN_ERROR);
  return response;
}

/**
 * Mensagem para o usuário. As de validação (400) e do limite (429) da API já são escritas para
 * ele, assim como a falha de conexão; outros status viram uma mensagem genérica.
 */
export function emailCodeErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return UNKNOWN_ERROR;
  if (error.status === undefined || error.status === 400 || error.status === 429) {
    return error.message;
  }
  return UNKNOWN_ERROR;
}

/** Quando o reenvio volta a ser permitido (ms): `retryAt` do 429, ou o intervalo informado. */
export function resendAvailableAt(
  source: { retryAt?: string } | { resendAvailableInSeconds: number },
  now: number = Date.now(),
): number {
  if ('resendAvailableInSeconds' in source) return now + source.resendAvailableInSeconds * 1000;
  const at = source.retryAt ? Date.parse(source.retryAt) : NaN;
  return Number.isNaN(at) ? now + EMAIL_CODE_DEFAULTS.resendAvailableInSeconds * 1000 : at;
}
