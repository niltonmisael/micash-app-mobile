import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import { ApiError } from '@/lib/api';
import { SessionUnavailableError, clearSession, getSession, withSession } from '@/lib/auth';

type LoadResult<T> =
  | { kind: 'ok'; firstName: string; data: T }
  | { kind: 'no-session' }
  | { kind: 'expired' }
  | { kind: 'error'; firstName: string; message: string };

async function runQuery<T>(fetcher: (token: string) => Promise<T>): Promise<LoadResult<T>> {
  const session = await getSession();
  if (!session) return { kind: 'no-session' };

  const firstName = session.name.trim().split(/\s+/)[0] ?? '';
  try {
    // No 401, `withSession` renova a sessão (POST /refresh) e repete a consulta uma vez.
    return { kind: 'ok', firstName, data: await withSession((token) => fetcher(token)) };
  } catch (err) {
    if (err instanceof SessionUnavailableError) {
      return err.reason === 'expired' ? { kind: 'expired' } : { kind: 'no-session' };
    }
    // Falha de rede tem mensagem própria; outros erros da API ficam com uma mensagem genérica.
    const message =
      err instanceof ApiError && err.status === undefined
        ? err.message
        : 'Não foi possível carregar seus dados. Tente novamente.';
    return { kind: 'error', firstName, message };
  }
}

/**
 * Carrega dados da API com o token da sessão salva. Trata carregamento, atualização,
 * erro e sessão expirada (401 → renova a sessão com o refresh token e repete; se a renovação for
 * recusada, apaga a sessão e volta ao Login).
 * `fetcher` deve ser uma referência estável (ex.: função declarada fora do componente).
 */
export function useAuthenticatedQuery<T>(fetcher: (token: string) => Promise<T>) {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string>();

  const signOut = useCallback(async () => {
    await clearSession();
    router.replace('/login');
  }, [router]);

  const applyResult = useCallback(
    async (result: LoadResult<T>) => {
      setLoading(false);
      setRefreshing(false);
      switch (result.kind) {
        case 'ok':
          setFirstName(result.firstName);
          setData(result.data);
          setError(undefined);
          return;
        case 'error':
          // Mantém os dados já carregados (se houver) e mostra o aviso com "Tentar novamente".
          setFirstName(result.firstName);
          setError(result.message);
          return;
        case 'no-session':
          router.replace('/login');
          return;
        case 'expired':
          await signOut();
          Alert.alert('Sessão expirada', 'Entre novamente para continuar.');
      }
    },
    [router, signOut],
  );

  // Carrega ao entrar na tela e recarrega sempre que ela volta ao foco (ex.: depois de
  // registrar uma receita/despesa), mantendo os dados atuais visíveis durante a busca.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      runQuery(fetcher).then((result) => {
        if (active) applyResult(result);
      });
      return () => {
        active = false;
      };
    }, [fetcher, applyResult]),
  );

  const reload = useCallback(
    async (mode: 'refresh' | 'retry') => {
      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      applyResult(await runQuery(fetcher));
    },
    [fetcher, applyResult],
  );

  return {
    data,
    firstName,
    loading,
    refreshing,
    error,
    /** Puxar para atualizar. */
    refresh: () => reload('refresh'),
    /** "Tentar novamente" após um erro. */
    retry: () => reload(data ? 'refresh' : 'retry'),
    signOut,
  };
}
