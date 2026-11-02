import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Alert } from 'react-native';

import { SessionUnavailableError, clearSession, withSession } from '@/lib/auth';

/** Sinaliza que a ação foi interrompida porque o usuário precisou voltar ao Login. */
export class SessionEndedError extends Error {
  constructor() {
    super('Sessão encerrada.');
    this.name = 'SessionEndedError';
  }
}

/**
 * Executa uma ação de escrita na API com o token da sessão salva. No 401, a sessão é renovada
 * (POST /refresh) e a ação repetida uma vez. Sem sessão ou com a renovação recusada, apaga a
 * sessão, volta ao Login e lança `SessionEndedError`; outros erros são repassados.
 */
export function useAuthenticatedAction() {
  const router = useRouter();

  return useCallback(
    async <T>(action: (token: string) => Promise<T>): Promise<T> => {
      try {
        return await withSession((token) => action(token));
      } catch (error) {
        if (!(error instanceof SessionUnavailableError)) throw error;
        await clearSession();
        router.replace('/login');
        if (error.reason === 'expired') {
          Alert.alert('Sessão expirada', 'Entre novamente para continuar.');
        }
        throw new SessionEndedError();
      }
    },
    [router],
  );
}
