import * as Application from 'expo-application';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import type { NotificationPermissionsStatus } from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { colors } from '@/constants/colors';
import { ApiError, apiDelete, apiGet, apiPost } from '@/lib/api';
import type {
  DeactivatePushDeviceRequest,
  PushDevice,
  PushDevicePlatform,
  PushDevicesResponse,
  RegisterPushDeviceRequest,
  TestPushNotificationResponse,
} from '@/types/notifications';

// Notificações push pelo Expo Push Service (o FCM/APNs ficam atrás dele; o app não fala com o
// Firebase diretamente). O app registra o Expo Push Token na API (`api/device`), que envia.

/** Canal Android padrão (obrigatório no Android 8+; criado antes de pedir a permissão). Deve ser
 * o mesmo `ExpoPush:ChannelId` configurado na API. */
export const DEFAULT_CHANNEL_ID = 'default';

const PUSH_DEVICE_PATH = '/api/device/push-token';

/** Token registrado na API por este aparelho: o logout precisa dele para desativá-lo. */
const REGISTERED_TOKEN_KEY = 'micash.pushToken';

/** Limites do ValidatorRegisterPushDevice da API. */
const DEVICE_ID_MAX_LENGTH = 200;
const DEVICE_NAME_MAX_LENGTH = 100;

/** Por que o aparelho não pode receber push remoto. */
export type PushUnsupportedReason = 'web' | 'simulator' | 'expo-go';

export type PushRegistration =
  | { status: 'granted'; token: string }
  /** Negada pelo usuário: o app não pede de novo (só pelos Ajustes do sistema). */
  | { status: 'denied' }
  | { status: 'unsupported'; reason: PushUnsupportedReason }
  | { status: 'error'; message: string };

type NotificationsModule = typeof import('expo-notifications');

const isExpoGo = () => Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/**
 * `expo-notifications` carregado sob demanda, nunca no topo dos arquivos: no Expo Go (SDK 57) a
 * própria importação lança ("Cannot find native module 'ExpoTopicSubscriptionModule'") e
 * derrubaria a tela que a importa; na web não há push. Nesses dois casos devolve `null`.
 */
export function getNotificationsModule(): NotificationsModule | null {
  if (Platform.OS === 'web' || isExpoGo()) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-notifications') as NotificationsModule;
}

/**
 * Notificações recebidas com o app aberto aparecem como banner e na central, com som
 * (no Android, sem som o alerta suspenso não aparece). Chamar uma vez, na raiz do app.
 */
export function configureForegroundNotifications(): void {
  const Notifications = getNotificationsModule();
  if (!Notifications) return;
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
 * Push remoto exige um app com o código nativo do `expo-notifications` (development build ou
 * loja): o Expo Go (Android, desde o SDK 53) não recebe. O simulador do iOS não gera token; o
 * emulador Android recebe pelo FCM quando a imagem do sistema tem o Google Play Services (sem
 * ele, a obtenção do token falha e vira `error`).
 */
export function getPushUnsupportedReason(): PushUnsupportedReason | null {
  if (Platform.OS === 'web') return 'web';
  if (!Device.isDevice && Platform.OS === 'ios') return 'simulator';
  if (isExpoGo()) return 'expo-go';
  return null;
}

/** EAS Project ID do `app.json` (`extra.eas.projectId`), usado para gerar o Expo Push Token. */
export function getEasProjectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

async function ensureAndroidChannel(Notifications: NotificationsModule): Promise<void> {
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
  const Notifications = getNotificationsModule();
  if (!Notifications) return false;
  const current = await Notifications.getPermissionsAsync();
  if (isAllowed(Notifications, current)) return true;
  if (current.status !== Notifications.PermissionStatus.UNDETERMINED) return false;
  return isAllowed(Notifications, await Notifications.requestPermissionsAsync());
}

function isAllowed(
  Notifications: NotificationsModule,
  permission: NotificationPermissionsStatus,
): boolean {
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
  const Notifications = getNotificationsModule();
  if (!Notifications) return { status: 'unsupported', reason: 'expo-go' };

  const projectId = getEasProjectId();
  if (!projectId) {
    return { status: 'error', message: 'EAS Project ID não configurado (extra.eas.projectId).' };
  }

  try {
    await ensureAndroidChannel(Notifications);
    if (!(await ensureNotificationPermission())) return { status: 'denied' };
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return { status: 'granted', token: data };
  } catch {
    // Ex.: sem conexão, credenciais FCM/APNs ausentes na build ou emulador Android sem o
    // Google Play Services. O token não é registrado em log (identifica o aparelho).
    return { status: 'error', message: 'Não foi possível ativar as notificações neste aparelho.' };
  }
}

/**
 * Id estável da instalação: no Android, o Android ID (por app e chave de assinatura); no iOS, o
 * identificador do fornecedor. A API usa para desativar tokens antigos do mesmo aparelho.
 */
async function getDeviceId(): Promise<string | null> {
  try {
    const id =
      Platform.OS === 'android'
        ? Application.getAndroidId()
        : await Application.getIosIdForVendorAsync();
    return id ? id.slice(0, DEVICE_ID_MAX_LENGTH) : null;
  } catch {
    return null;
  }
}

/**
 * POST /api/device/push-token — cria ou atualiza o aparelho pelo token (se o token era de outra
 * conta, passa para a atual). Chamado a cada entrada na área autenticada: o token pode mudar.
 */
export async function registerPushDevice(
  sessionToken: string,
  expoPushToken: string,
): Promise<void> {
  const body: RegisterPushDeviceRequest = {
    expoPushToken,
    platform: Platform.OS as PushDevicePlatform,
    deviceId: await getDeviceId(),
    // Modelo ("Pixel 7"), não o nome que o usuário deu ao aparelho.
    deviceName: Device.modelName?.slice(0, DEVICE_NAME_MAX_LENGTH) ?? null,
  };
  await apiPost(PUSH_DEVICE_PATH, body, sessionToken);
  await SecureStore.setItemAsync(REGISTERED_TOKEN_KEY, expoPushToken);
}

/**
 * DELETE /api/device/push-token — chamar antes do /logout (a rota exige a sessão), para a conta
 * deixar de receber notificações neste aparelho. O 404 (token já desativado ou de outra conta)
 * conta como feito; os demais erros, inclusive o 401, são repassados para quem chamou renovar a
 * sessão ou seguir com o logout.
 */
export async function unregisterPushDevice(sessionToken: string): Promise<void> {
  const expoPushToken = await SecureStore.getItemAsync(REGISTERED_TOKEN_KEY);
  if (!expoPushToken) return;
  const body: DeactivatePushDeviceRequest = { expoPushToken };
  try {
    await apiDelete(PUSH_DEVICE_PATH, sessionToken, body);
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 404)) throw error;
  }
  await forgetPushDevice();
}

/** Token que este aparelho registrou na API (para reconhecê-lo na lista de aparelhos). */
export async function getRegisteredPushToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(REGISTERED_TOKEN_KEY);
  } catch {
    return null;
  }
}

/** Quantos caracteres do token a API mostra (PushTokenMask.VISIBLE_CHARS). */
const TOKEN_SUFFIX_CHARS = 6;

/**
 * Mesmo sufixo que a API devolve em `tokenSuffix` (PushTokenMask.Suffix):
 * "ExponentPushToken[abcdefghij123456]" → "…123456".
 */
export function pushTokenSuffix(token: string): string {
  const inner = token.replace(/\]+$/, '');
  const start = inner.indexOf('[');
  const value = start >= 0 ? inner.slice(start + 1) : inner;
  return value.length <= TOKEN_SUFFIX_CHARS ? '…' : `…${value.slice(-TOKEN_SUFFIX_CHARS)}`;
}

/** GET /api/device/push-tokens — aparelhos da conta, ativos primeiro (204 vira lista vazia). */
export async function getPushDevices(sessionToken: string): Promise<PushDevice[]> {
  const response = await apiGet<PushDevicesResponse>('/api/device/push-tokens', sessionToken);
  return response?.devices ?? [];
}

/**
 * POST /api/device/push-token/test — enfileira uma notificação de teste para os aparelhos ativos
 * da conta (abre "/home" ao tocar). Só existe com a API em Development: fora dela responde 404.
 */
export async function sendTestPushNotification(
  sessionToken: string,
): Promise<TestPushNotificationResponse> {
  const response = await apiPost<TestPushNotificationResponse>(
    `${PUSH_DEVICE_PATH}/test`,
    undefined,
    sessionToken,
  );
  if (!response) throw new ApiError('Resposta inesperada do servidor. Tente novamente.');
  return response;
}

/** Situação das notificações neste aparelho, sem pedir nada ao usuário. */
export type NotificationPermissionState =
  'granted' | 'denied' | 'undetermined' | { unsupported: PushUnsupportedReason };

export async function getNotificationPermissionState(): Promise<NotificationPermissionState> {
  const unsupported = getPushUnsupportedReason();
  if (unsupported) return { unsupported };
  const Notifications = getNotificationsModule();
  if (!Notifications) return { unsupported: 'expo-go' };
  const permission = await Notifications.getPermissionsAsync();
  if (isAllowed(Notifications, permission)) return 'granted';
  return permission.status === Notifications.PermissionStatus.UNDETERMINED
    ? 'undetermined'
    : 'denied';
}

/** Esquece o token registrado (no logout, mesmo que a desativação na API tenha falhado). */
export async function forgetPushDevice(): Promise<void> {
  await SecureStore.deleteItemAsync(REGISTERED_TOKEN_KEY).catch(() => undefined);
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
