import * as SecureStore from 'expo-secure-store';

import { ApiError, apiPost } from '@/lib/api';
import { forgetPushDevice, unregisterPushDevice } from '@/lib/notifications';
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

/**
 * O cadastro já devolve os tokens (mesma resposta do login), mas com `emailVerified: false`: a
 * conta só libera o app depois do código enviado por e-mail (tela `verify-email`).
 */
export async function register(data: RegisterRequest): Promise<Session> {
  return saveSession(await apiPost<Session>('/api/user/register', data));
}

/** Troca a sessão salva (ex.: tokens novos devolvidos pela confirmação do e-mail). */
export async function replaceSession(session: Session): Promise<Session> {
  return saveSession(session);
}

/** Sessões antigas, sem o campo, contam como verificadas (a API marcou essas contas). */
export function isSessionVerified(session: Session): boolean {
  return session.emailVerified !== false;
}

/**
 * A API respondeu 403 `EMAIL_NOT_VERIFIED`: guarda isso na sessão, para a Splash e o Login
 * abrirem a tela do código em vez da área autenticada.
 */
export async function markSessionUnverified(): Promise<void> {
  const session = await getSession();
  if (session && session.emailVerified !== false) {
    await saveSession({ ...session, emailVerified: false });
  }
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
 * A sessão não pode mais ser usada: não existe (`no-session`) ou o refresh token foi recusado
 * pela API (`expired`: passou dos 7 dias, foi revogado ou o usuário não existe mais). Quem
 * captura decide o que fazer (apagar a sessão e voltar ao Login).
 */
export class SessionUnavailableError extends Error {
  constructor(readonly reason: 'no-session' | 'expired') {
    super(reason === 'expired' ? 'Sessão expirada.' : 'Sem sessão.');
    this.name = 'SessionUnavailableError';
  }
}

const isUnauthorized = (error: unknown) => error instanceof ApiError && error.status === 401;

/** Troca em andamento: requisições simultâneas que recebem 401 esperam a mesma. */
let pendingRefresh: Promise<Session | null> | null = null;

/**
 * POST /refresh — troca o refresh token por uma sessão nova e a salva. A API apaga o refresh
 * token usado, por isso só pode haver uma troca por vez: com várias em paralelo, as seguintes
 * usariam um token já apagado e derrubariam a sessão recém-renovada.
 * Devolve `null` quando a API recusa (401/404); sem conexão, o erro é repassado e a sessão fica.
 */
export function refreshSession(): Promise<Session | null> {
  pendingRefresh ??= requestRefresh().finally(() => {
    pendingRefresh = null;
  });
  return pendingRefresh;
}

async function requestRefresh(): Promise<Session | null> {
  const session = await getSession();
  if (!session) return null;
  try {
    // Anônimo: o access token já venceu.
    return await saveSession(
      await apiPost<Session>('/refresh', { refreshToken: session.refreshToken }),
    );
  } catch (error) {
    if (error instanceof ApiError && (error.status === 401 || error.status === 404)) return null;
    throw error;
  }
}

/**
 * Executa uma chamada autenticada com o token da sessão salva. No 401, renova a sessão uma vez
 * (ou usa a que outra requisição acabou de renovar) e repete. Se não houver sessão ou a renovação
 * for recusada, lança `SessionUnavailableError`; outros erros são repassados.
 */
export async function withSession<T>(
  action: (token: string, session: Session) => Promise<T>,
): Promise<T> {
  const session = await getSession();
  if (!session) throw new SessionUnavailableError('no-session');
  try {
    return await action(session.token, session);
  } catch (error) {
    if (!isUnauthorized(error)) throw error;
  }

  // Outra requisição pode ter renovado enquanto esta esperava a resposta: aí basta repetir.
  const current = await getSession();
  const renewed = current && current.token !== session.token ? current : await refreshSession();
  if (!renewed) throw new SessionUnavailableError('expired');
  try {
    return await action(renewed.token, renewed);
  } catch (error) {
    if (isUnauthorized(error)) throw new SessionUnavailableError('expired');
    throw error;
  }
}

/**
 * Sai da conta: desativa o push deste aparelho (DELETE /api/device/push-token) e pede à API para
 * revogar o refresh token (POST /logout). As duas rotas exigem a sessão: com o access token
 * vencido, a sessão é renovada antes, e o /logout recebe o refresh token novo (o antigo já foi
 * apagado na troca). Falhas não impedem a saída: a sessão local é apagada de qualquer forma.
 */
export async function logout(): Promise<void> {
  try {
    await withSession((token) => unregisterPushDevice(token));
  } catch {
    // Segue com o logout; o backend também desativa tokens recusados pelo Expo.
  }
  try {
    await withSession((token, session) =>
      apiPost('/logout', { refreshToken: session.refreshToken }, token),
    );
  } catch {
    // Sem conexão ou refresh recusado: o refresh token expira sozinho no servidor (7 dias).
  }
  await forgetPushDevice();
  await clearSession();
}
