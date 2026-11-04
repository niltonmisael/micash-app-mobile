import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { usePlan } from '@/hooks/usePlan';
import { ApiError, isPlanLimitError } from '@/lib/api';
import { SessionUnavailableError, clearSession, getSession, withSession } from '@/lib/auth';

type LoadResult<T> =
  | { kind: 'ok'; firstName: string; data: T }
  | { kind: 'no-session' }
  | { kind: 'expired' }
  | { kind: 'plan-limit'; firstName: string; message: string }
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
    // Limite do plano (ex.: mês fora do histórico do Free) não é erro: a tela mostra o cadeado.
    if (isPlanLimitError(err)) return { kind: 'plan-limit', firstName, message: err.message };
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
  const [locked, setLocked] = useState<string>();
  const { limits } = usePlan();

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
          setLocked(undefined);
          return;
        case 'plan-limit':
          // Sem dados deste pedido: a tela mostra a oferta no lugar do conteúdo.
          setFirstName(result.firstName);
          setData(undefined);
          setError(undefined);
          setLocked(result.message);
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

  // Assinou (ou perdeu o Premium) com a tela aberta: recarrega para os cadeados mudarem na hora.
  // A primeira resposta dos limites não conta: a tela já carregou com o que a API permite.
  const isPremium = limits?.isPremium;
  const previousPremium = useRef(isPremium);
  useEffect(() => {
    const before = previousPremium.current;
    previousPremium.current = isPremium;
    if (before !== undefined && isPremium !== undefined && before !== isPremium) {
      runQuery(fetcher).then(applyResult);
    }
  }, [isPremium, fetcher, applyResult]);

  return {
    data,
    firstName,
    loading,
    refreshing,
    error,
    /** Mensagem da API quando o plano não permite estes dados (403 de limite); sem `data`. */
    locked,
    /** Puxar para atualizar. */
    refresh: () => reload('refresh'),
    /** "Tentar novamente" após um erro. */
    retry: () => reload(data ? 'refresh' : 'retry'),
    signOut,
  };
}
