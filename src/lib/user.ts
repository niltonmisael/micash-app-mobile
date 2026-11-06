import { apiDelete, apiGet, apiPut } from '@/lib/api';
import type {
  ChangePasswordRequest,
  NotificationPreferences,
  UpdateProfileRequest,
  UserProfile,
} from '@/types/user';

/** GET /api/user/profile (também liberado antes de confirmar o e-mail). */
export async function getProfile(token: string): Promise<UserProfile> {
  const profile = await apiGet<UserProfile>('/api/user/profile', token);
  if (!profile) throw new Error('Perfil sem conteúdo na resposta da API.');
  return profile;
}

/**
 * PUT /api/user/update — atualiza o nome e, quando enviado, o celular. O `email` enviado tem de ser o atual: a troca de e-mail
 * só acontece com código (`requestEmailChange`/`confirmEmailChange` em `emailVerification.ts`).
 */
export async function updateProfile(token: string, data: UpdateProfileRequest): Promise<void> {
  await apiPut('/api/user/update', data, token);
}

/** PUT /api/user/change-password — a API confere a senha atual e a regra da nova senha. */
export async function changePassword(token: string, data: ChangePasswordRequest): Promise<void> {
  await apiPut('/api/user/change-password', data, token);
}

/** GET /api/user/notification-preferences — resumo mensal (e-mail e push) e novidades por e-mail. */
export async function getNotificationPreferences(token: string): Promise<NotificationPreferences> {
  const preferences = await apiGet<NotificationPreferences>(
    '/api/user/notification-preferences',
    token,
  );
  if (!preferences) throw new Error('Preferências sem conteúdo na resposta da API.');
  return preferences;
}

/** PUT /api/user/notification-preferences — grava as três opções de uma vez e devolve o resultado. */
export async function updateNotificationPreferences(
  token: string,
  data: NotificationPreferences,
): Promise<NotificationPreferences> {
  const saved = await apiPut<NotificationPreferences>(
    '/api/user/notification-preferences',
    data,
    token,
  );
  return saved ?? data;
}

/**
 * DELETE /api/user/delete — exclui a conta e todos os dados. A API confere a senha atual (400 se
 * errada) e cancela antes a assinatura no Pagar.me (503 se o Pagar.me falhar; nada é apagado).
 */
export async function deleteAccount(token: string, password: string): Promise<void> {
  await apiDelete('/api/user/delete', token, { password });
}
