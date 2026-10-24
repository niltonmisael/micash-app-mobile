import * as SecureStore from 'expo-secure-store';

import { ApiError, apiPost } from '@/lib/api';
import type { LoginRequest, RegisterRequest, Session } from '@/types/auth';

const SESSION_KEY = 'micash.session';

async function saveSession(session: Session | null): Promise<Session> {
  if (!session) throw new ApiError('Resposta inesperada do servidor. Tente novamente.');
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
  return session;
}

export async function login(credentials: LoginRequest): Promise<Session> {
  return saveSession(await apiPost<Session>('/login', credentials));
}

/** O cadastro já devolve os tokens (mesma resposta do login), então o usuário sai autenticado. */
export async function register(data: RegisterRequest): Promise<Session> {
  return saveSession(await apiPost<Session>('/api/user/register', data));
}

/** Sessão salva no aparelho, ou `null` se não houver (ou se não puder ser lida). */
export async function getSession(): Promise<Session | null> {
  try {
    const stored = await SecureStore.getItemAsync(SESSION_KEY);
    return stored ? (JSON.parse(stored) as Session) : null;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

/** Atualiza o nome salvo na sessão (ex.: depois de editar os dados pessoais). */
export async function updateSessionName(name: string): Promise<void> {
  const session = await getSession();
  if (session) await saveSession({ ...session, name });
}

/**
 * Sai da conta: pede à API para revogar o refresh token (POST /logout) e apaga a sessão local.
 * Se a chamada falhar (sem conexão ou token já expirado), a sessão local é apagada mesmo assim;
 * nesse caso o refresh token só deixa de valer quando expirar no servidor (7 dias).
 */
export async function logout(): Promise<void> {
  const session = await getSession();
  if (session) {
    try {
      await apiPost('/logout', { refreshToken: session.refreshToken }, session.token);
    } catch {
      // Segue com o logout local.
    }
  }
  await clearSession();
}
