import { useRouter } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { AppState } from 'react-native';

import { PremiumOfferSheet } from '@/components/PremiumOfferSheet';
import { withSession } from '@/lib/auth';
import { getPlanLimits } from '@/lib/subscription';
import type { PlanLimits } from '@/types/user';

const DEFAULT_OFFER_TITLE = 'Recurso Premium';

type Offer = { title: string; message: string };

type PlanContextValue = {
  /** `undefined` até a primeira resposta (ou se ela falhar): nada é bloqueado antes, a API decide. */
  limits: PlanLimits | undefined;
  /** GET /api/subscription/limits de novo (ex.: depois de cada mensagem do chat). */
  reloadLimits: () => Promise<void>;
  /** Abre a oferta do Premium (`message` é o texto da API, quando houver). */
  showOffer: (message: string, title?: string) => void;
};

const PlanContext = createContext<PlanContextValue | null>(null);

/**
 * Limites do plano (Free ou Premium) e a oferta do Premium, compartilhados por todas as telas.
 * Os limites são carregados ao entrar na área autenticada e recarregados quando o app volta ao
 * primeiro plano (ex.: depois de pagar no Pagar.me) e ao sair da tela de assinatura.
 */
export function PlanProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [limits, setLimits] = useState<PlanLimits>();
  const [offer, setOffer] = useState<Offer>();
  const [offerVisible, setOfferVisible] = useState(false);
  // Só recarrega ao voltar ao app depois de a área autenticada ter pedido os limites.
  const started = useRef(false);

  const reloadLimits = useCallback(async () => {
    started.current = true;
    try {
      setLimits(await withSession((token) => getPlanLimits(token)));
    } catch {
      // Sem sessão ou sem conexão: mantém os limites anteriores; a API continua decidindo.
    }
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && started.current) reloadLimits();
    });
    return () => subscription.remove();
  }, [reloadLimits]);

  const showOffer = useCallback((message: string, title: string = DEFAULT_OFFER_TITLE) => {
    setOffer({ title, message });
    setOfferVisible(true);
  }, []);

  function subscribe() {
    setOfferVisible(false);
    router.push('/subscription');
  }

  const value = useMemo(
    () => ({ limits, reloadLimits, showOffer }),
    [limits, reloadLimits, showOffer],
  );

  return (
    <PlanContext.Provider value={value}>
      {children}
      <PremiumOfferSheet
        visible={offerVisible}
        title={offer?.title ?? DEFAULT_OFFER_TITLE}
        message={offer?.message ?? ''}
        onSubscribe={subscribe}
        onClose={() => setOfferVisible(false)}
      />
    </PlanContext.Provider>
  );
}

export function usePlan(): PlanContextValue {
  const context = useContext(PlanContext);
  if (!context) throw new Error('usePlan precisa estar dentro de PlanProvider.');
  return context;
}
