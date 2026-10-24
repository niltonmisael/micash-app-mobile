import { apiGet, apiPut } from '@/lib/api';
import type { ChangePasswordRequest, UpdateProfileRequest, UserProfile } from '@/types/user';

/** GET /api/user/profile */
export async function getProfile(token: string): Promise<UserProfile> {
  const profile = await apiGet<UserProfile>('/api/user/profile', token);
  if (!profile) throw new Error('Perfil sem conteúdo na resposta da API.');
  return profile;
}

/** PUT /api/user/update — a API valida nome, formato do e-mail e e-mail já cadastrado. */
export async function updateProfile(token: string, data: UpdateProfileRequest): Promise<void> {
  await apiPut('/api/user/update', data, token);
}

/** PUT /api/user/change-password — a API confere a senha atual e a regra da nova senha. */
export async function changePassword(token: string, data: ChangePasswordRequest): Promise<void> {
  await apiPut('/api/user/change-password', data, token);
}
