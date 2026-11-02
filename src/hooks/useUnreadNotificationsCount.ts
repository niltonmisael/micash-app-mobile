import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { withSession } from '@/lib/auth';
import { getUnreadNotificationsCount } from '@/lib/notificationCenter';
import { getNotificationsModule } from '@/lib/notifications';

/**
 * Notificações não lidas (número do sino). Recarrega ao voltar à tela e quando chega um push com
 * o app aberto. Falhas só deixam o número de fora: a sessão expirada é tratada pela tela, que já
 * carrega os próprios dados com `useAuthenticatedQuery` (assim não aparecem dois avisos).
 */
export function useUnreadNotificationsCount(): number | undefined {
  const [count, setCount] = useState<number>();

  const load = useCallback(async () => {
    try {
      setCount(await withSession((token) => getUnreadNotificationsCount(token)));
    } catch {
      // Mantém o último número conhecido.
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    const Notifications = getNotificationsModule();
    if (!Notifications) return;
    const subscription = Notifications.addNotificationReceivedListener(() => load());
    return () => subscription.remove();
  }, [load]);

  return count;
}
