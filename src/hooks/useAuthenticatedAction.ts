import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Alert } from 'react-native';

import { ApiError } from '@/lib/api';
import { clearSession, getSession } from '@/lib/auth';

/** Sinaliza que a ação foi interrompida porque o usuário precisou voltar ao Login. */
export class SessionEndedError extends Error {
  constructor() {
    super('Sessão encerrada.');
    this.name = 'SessionEndedError';
  }
}

/**
 * Executa uma ação de escrita na API com o token da sessão salva. Sem sessão ou com 401,
 * apaga a sessão, volta ao Login e lança `SessionEndedError`; outros erros são repassados.
 */
export function useAuthenticatedAction() {
  const router = useRouter();

  return useCallback(
    async <T>(action: (token: string) => Promise<T>): Promise<T> => {
      const session = await getSession();
      if (!session) {
        router.replace('/login');
        throw new SessionEndedError();
      }
      try {
        return await action(session.token);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          await clearSession();
          router.replace('/login');
          Alert.alert('Sessão expirada', 'Entre novamente para continuar.');
          throw new SessionEndedError();
        }
        throw error;
      }
    },
    [router],
  );
}
