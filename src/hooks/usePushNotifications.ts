import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { notificationRoute, registerForPushNotifications } from '@/lib/notifications';
import type { PushRegistration } from '@/lib/notifications';

type UsePushNotificationsOptions = {
  /** Notificação recebida com o app aberto (o banner já é exibido pelo handler). */
  onReceived?: (notification: Notifications.Notification) => void;
};

/**
 * Notificações da área autenticada: pede a permissão uma única vez, obtém o Expo Push Token e
 * escuta as notificações. Tocar em uma notificação abre a rota de `data.url`, inclusive quando
 * o app foi aberto por ela (estava fechado ou no Login e chega aqui depois).
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
    // O envio do token à API entra aqui quando o endpoint existir no backend.
    registerForPushNotifications().then((result) => {
      if (active) setRegistration(result);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    function openResponse(response: Notifications.NotificationResponse) {
      const id = response.notification.request.identifier;
      if (handledResponse.current === id) return;
      handledResponse.current = id;
      Notifications.clearLastNotificationResponse();

      const route = notificationRoute(response.notification.request.content.data);
      if (route) router.push(route as Href);
    }

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
