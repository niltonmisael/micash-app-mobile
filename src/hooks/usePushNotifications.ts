import type { Notification, NotificationResponse } from 'expo-notifications';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { withSession } from '@/lib/auth';
import { markNotificationAsRead, notificationIdFromData } from '@/lib/notificationCenter';
import {
  getNotificationsModule,
  notificationRoute,
  registerForPushNotifications,
  registerPushDevice,
} from '@/lib/notifications';
import type { PushRegistration } from '@/lib/notifications';

type UsePushNotificationsOptions = {
  /** Notificação recebida com o app aberto (o banner já é exibido pelo handler). */
  onReceived?: (notification: Notification) => void;
};

/**
 * Notificações da área autenticada: pede a permissão uma única vez, obtém o Expo Push Token,
 * registra o aparelho na API (POST /api/device/push-token) e escuta as notificações. Tocar em
 * uma notificação a marca como lida na central e abre a rota de `data.url`, inclusive quando o
 * app foi aberto por ela (estava fechado ou no Login e chega aqui depois).
 */
export function usePushNotifications({ onReceived }: UsePushNotificationsOptions = {}) {
  const router = useRouter();
  const [registration, setRegistration] = useState<PushRegistration>();
  const onReceivedRef = useRef(onReceived);
  // A mesma resposta pode chegar pelo listener e por getLastNotificationResponse.
  const handledResponse = useRef<string>(undefined);

  useEffect(() => {
    onReceivedRef.current = onReceived;
  }, [onReceived]);

  useEffect(() => {
    let active = true;
    registerForPushNotifications().then(async (result) => {
      if (active) setRegistration(result);
      if (result.status !== 'granted') return;
      try {
        await withSession((token) => registerPushDevice(token, result.token));
      } catch {
        // Sem conexão ou sessão recusada: tenta de novo na próxima entrada na área autenticada
        // (a sessão recusada é tratada pelas telas, que voltam ao Login).
      }
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    // Web e Expo Go: sem o módulo nativo, não há notificações para escutar.
    const Notifications = getNotificationsModule();
    if (!Notifications) return;

    const openResponse = (response: NotificationResponse) => {
      const id = response.notification.request.identifier;
      if (handledResponse.current === id) return;
      handledResponse.current = id;
      Notifications.clearLastNotificationResponse();

      const data = response.notification.request.content.data;
      // Tocar conta como leitura na central (sem esperar a API: a navegação não depende dela).
      const notificationId = notificationIdFromData(data);
      if (notificationId !== undefined) {
        withSession((token) => markNotificationAsRead(token, notificationId)).catch(
          () => undefined,
        );
      }

      const route = notificationRoute(data);
      if (route) router.push(route as Href);
    };

    const pending = Notifications.getLastNotificationResponse();
    if (pending) openResponse(pending);

    const received = Notifications.addNotificationReceivedListener((notification) =>
      onReceivedRef.current?.(notification),
    );
    const responses = Notifications.addNotificationResponseReceivedListener(openResponse);
    return () => {
      received.remove();
      responses.remove();
    };
  }, [router]);

  return registration;
}
