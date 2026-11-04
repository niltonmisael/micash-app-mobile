import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Alert } from 'react-native';

import { usePlan } from '@/hooks/usePlan';
import { isPlanLimitError } from '@/lib/api';
import { SessionUnavailableError, clearSession, withSession } from '@/lib/auth';

/**
 * A ação foi interrompida e o hook já tratou o motivo (voltou ao Login ou abriu a oferta do
 * Premium): a tela só encerra a ação, sem mostrar erro.
 */
export class HandledActionError extends Error {}

/** Sinaliza que a ação foi interrompida porque o usuário precisou voltar ao Login. */
export class SessionEndedError extends HandledActionError {
  constructor() {
    super('Sessão encerrada.');
    this.name = 'SessionEndedError';
  }
}

/** A API recusou por limite do plano (403) e a oferta do Premium foi aberta. */
export class PremiumOfferShownError extends HandledActionError {
  constructor(message: string) {
    super(message);
    this.name = 'PremiumOfferShownError';
  }
}

/**
 * Executa uma ação de escrita na API com o token da sessão salva. No 401, a sessão é renovada
 * (POST /refresh) e a ação repetida uma vez. Sem sessão ou com a renovação recusada, apaga a
 * sessão, volta ao Login e lança `SessionEndedError`. Um limite do plano (403
 * `PLAN_LIMIT_REACHED`, ou 403 sem código) abre a oferta do Premium com a mensagem da API e
 * lança `PremiumOfferShownError`. Outros erros são repassados.
 */
export function useAuthenticatedAction() {
  const router = useRouter();
  const { showOffer } = usePlan();

  return useCallback(
    async <T>(action: (token: string) => Promise<T>): Promise<T> => {
      try {
        return await withSession((token) => action(token));
      } catch (error) {
        if (isPlanLimitError(error)) {
          showOffer(error.message);
          throw new PremiumOfferShownError(error.message);
        }
        if (!(error instanceof SessionUnavailableError)) throw error;
        await clearSession();
        router.replace('/login');
        if (error.reason === 'expired') {
          Alert.alert('Sessão expirada', 'Entre novamente para continuar.');
        }
        throw new SessionEndedError();
      }
    },
    [router, showOffer],
  );
}
