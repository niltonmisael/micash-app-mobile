// Contratos de aparelhos para push da MiCash.API (`api/device`). O usuário vem sempre do token
// de acesso; o envio das notificações é feito pela API através do Expo Push Service.

/** "android" ou "ios" (a API não usa o enum numérico neste contrato). */
export type PushDevicePlatform = 'android' | 'ios';

/** RequestRegisterPushDeviceJson — POST /api/device/push-token (200 com `{ id }`). */
export type RegisterPushDeviceRequest = {
  /** "ExponentPushToken[...]" de `getExpoPushTokenAsync`. */
  expoPushToken: string;
  platform: PushDevicePlatform;
  /** Id estável da instalação (até 200 caracteres): a API desativa tokens antigos dele. */
  deviceId: string | null;
  /** Até 100 caracteres. */
  deviceName: string | null;
};

/** RequestDeactivatePushDeviceJson — DELETE /api/device/push-token (204; 404 se não for da conta). */
export type DeactivatePushDeviceRequest = {
  expoPushToken: string;
};

/** ResponsePushDeviceJson — o token nunca vem inteiro, só os últimos caracteres. */
export type PushDevice = {
  id: number;
  platform: PushDevicePlatform;
  deviceName: string | null;
  /** "…123456": últimos 6 caracteres de dentro dos colchetes do token. */
  tokenSuffix: string;
  isActive: boolean;
  /** DateTime em UTC. */
  createdAt: string;
  /** DateTime em UTC; `null` enquanto nenhuma notificação foi enviada ao aparelho. */
  lastUsedAt: string | null;
};

/** ResponsePushDevicesJson — GET /api/device/push-tokens (ativos primeiro; 204 sem aparelhos). */
export type PushDevicesResponse = {
  devices: PushDevice[];
};

/**
 * ResponseTestPushNotificationJson — POST /api/device/push-token/test (202). Só existe com a API
 * em Development (fora dela, 404); sem aparelho ativo, 400.
 */
export type TestPushNotificationResponse = {
  notificationId: number;
  /** Aparelhos ativos para os quais o teste foi enfileirado. */
  devices: number;
};

/** ResponseNotificationJson — item da central de notificações (sino). */
export type AppNotification = {
  id: number;
  /** Origem (ex.: "test"); permite escolher um ícone. */
  type: string;
  title: string;
  body: string;
  /** Rota interna a abrir ao tocar; `null` = só abre o app. */
  url: string | null;
  /** DateTime em UTC. */
  createdAt: string;
  /** DateTime em UTC; `null` = não lida. */
  readAt: string | null;
};

/**
 * ResponseNotificationsJson — GET /api/notification?before&limit (da mais recente para a mais
 * antiga; 204 sem notificações). Com `hasMore`, pedir de novo com `before` = id da última.
 */
export type NotificationsResponse = {
  notifications: AppNotification[];
  hasMore: boolean;
};

/** ResponseUnreadNotificationsCountJson — GET /api/notification/unread-count */
export type UnreadNotificationsCountResponse = {
  count: number;
};
