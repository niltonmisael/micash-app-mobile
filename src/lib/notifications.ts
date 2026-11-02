import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { colors } from '@/constants/colors';

// Notificações push pelo Expo Push Service (o FCM/APNs ficam atrás dele; o app não fala com o
// Firebase diretamente). O envio do token à API ainda não existe: este módulo só o disponibiliza.

/** Canal Android padrão (obrigatório no Android 8+; criado antes de pedir a permissão). */
export const DEFAULT_CHANNEL_ID = 'default';

/** Por que o aparelho não pode receber push remoto. */
export type PushUnsupportedReason = 'web' | 'simulator' | 'expo-go';

export type PushRegistration =
  | { status: 'granted'; token: string }
  /** Negada pelo usuário: o app não pede de novo (só pelos Ajustes do sistema). */
  | { status: 'denied' }
  | { status: 'unsupported'; reason: PushUnsupportedReason }
  | { status: 'error'; message: string };

/**
 * Notificações recebidas com o app aberto aparecem como banner e na central, com som
 * (no Android, sem som o alerta suspenso não aparece). Chamar uma vez, na raiz do app.
 */
export function configureForegroundNotifications(): void {
  if (Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Push remoto exige aparelho físico e um app com o código nativo do `expo-notifications`
 * (development build ou loja): simuladores e o Expo Go (Android, desde o SDK 53) não recebem.
 */
export function getPushUnsupportedReason(): PushUnsupportedReason | null {
  if (Platform.OS === 'web') return 'web';
  if (!Device.isDevice) return 'simulator';
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return 'expo-go';
  return null;
}

/** EAS Project ID do `app.json` (`extra.eas.projectId`), usado para gerar o Expo Push Token. */
export function getEasProjectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(DEFAULT_CHANNEL_ID, {
    name: 'Notificações do MiCash',
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: colors.primary,
  });
}

/**
 * Permissão de notificações sem insistir: o diálogo do sistema só aparece enquanto o usuário
 * ainda não respondeu. Concedida (ou provisória, no iOS) segue; negada não é pedida de novo.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (isAllowed(current)) return true;
  if (current.status !== Notifications.PermissionStatus.UNDETERMINED) return false;
  return isAllowed(await Notifications.requestPermissionsAsync());
}

function isAllowed(permission: Notifications.NotificationPermissionsStatus): boolean {
  return (
    permission.granted ||
    permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

/**
 * Pede a permissão (uma vez) e obtém o Expo Push Token deste aparelho, que depois será enviado
 * à API. Nunca lança: o resultado diz se há token, se foi negado ou se o aparelho não suporta.
 */
export async function registerForPushNotifications(): Promise<PushRegistration> {
  const unsupported = getPushUnsupportedReason();
  if (unsupported) return { status: 'unsupported', reason: unsupported };

  const projectId = getEasProjectId();
  if (!projectId) {
    return { status: 'error', message: 'EAS Project ID não configurado (extra.eas.projectId).' };
  }

  try {
    await ensureAndroidChannel();
    if (!(await ensureNotificationPermission())) return { status: 'denied' };
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return { status: 'granted', token: data };
  } catch {
    // Ex.: sem conexão, ou credenciais FCM/APNs ausentes na build. O token não é registrado
    // em log (identifica o aparelho).
    return { status: 'error', message: 'Não foi possível ativar as notificações neste aparelho.' };
  }
}

/**
 * Rota interna aberta ao tocar na notificação: o envio deve trazer `data.url` com um caminho
 * do app (ex.: "/goals"). Endereços externos ou formatos inesperados são ignorados.
 */
export function notificationRoute(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null) return undefined;
  const url = (data as { url?: unknown }).url;
  if (typeof url !== 'string' || !url.startsWith('/') || url.startsWith('//')) return undefined;
  return url;
}
