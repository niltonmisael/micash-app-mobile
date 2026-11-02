import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { notificationRoute, registerForPushNotifications } from './notifications';

const mockDevice = { isDevice: true };
const mockConstants: {
  executionEnvironment: string;
  expoConfig: { extra?: { eas?: { projectId?: string } } } | null;
  easConfig: { projectId?: string } | null;
} = {
  executionEnvironment: 'bare',
  expoConfig: { extra: { eas: { projectId: 'project-123' } } },
  easConfig: null,
};

jest.mock('expo-device', () => ({
  get isDevice() {
    return mockDevice.isDevice;
  },
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  ExecutionEnvironment: { Bare: 'bare', Standalone: 'standalone', StoreClient: 'storeClient' },
  default: {
    get executionEnvironment() {
      return mockConstants.executionEnvironment;
    },
    get expoConfig() {
      return mockConstants.expoConfig;
    },
    get easConfig() {
      return mockConstants.easConfig;
    },
  },
}));

jest.mock('expo-notifications', () => ({
  PermissionStatus: { GRANTED: 'granted', UNDETERMINED: 'undetermined', DENIED: 'denied' },
  IosAuthorizationStatus: { PROVISIONAL: 3 },
  AndroidImportance: { HIGH: 4 },
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
}));

const mocked = Notifications as jest.Mocked<typeof Notifications>;

function permission(status: string, granted = status === 'granted') {
  return { status, granted, canAskAgain: status === 'undetermined', expires: 'never' } as never;
}

describe('registerForPushNotifications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDevice.isDevice = true;
    mockConstants.executionEnvironment = 'bare';
    mockConstants.expoConfig = { extra: { eas: { projectId: 'project-123' } } };
    mockConstants.easConfig = null;
    mocked.getExpoPushTokenAsync.mockResolvedValue({
      type: 'expo',
      data: 'ExponentPushToken[abc]',
    });
  });

  it('com permissão já concedida, obtém o token com o EAS Project ID sem pedir de novo', async () => {
    mocked.getPermissionsAsync.mockResolvedValue(permission('granted'));

    await expect(registerForPushNotifications()).resolves.toEqual({
      status: 'granted',
      token: 'ExponentPushToken[abc]',
    });
    expect(mocked.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(mocked.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: 'project-123' });
  });

  it('pede a permissão só enquanto o usuário ainda não respondeu', async () => {
    mocked.getPermissionsAsync.mockResolvedValue(permission('undetermined'));
    mocked.requestPermissionsAsync.mockResolvedValue(permission('granted'));

    await expect(registerForPushNotifications()).resolves.toMatchObject({ status: 'granted' });
    expect(mocked.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('não insiste quando a permissão já foi negada', async () => {
    mocked.getPermissionsAsync.mockResolvedValue(permission('denied'));

    await expect(registerForPushNotifications()).resolves.toEqual({ status: 'denied' });
    expect(mocked.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(mocked.getExpoPushTokenAsync).not.toHaveBeenCalled();
  });

  it('aceita a autorização provisória do iOS', async () => {
    mocked.getPermissionsAsync.mockResolvedValue({
      ...(permission('denied', false) as object),
      ios: { status: 3 },
    } as never);

    await expect(registerForPushNotifications()).resolves.toMatchObject({ status: 'granted' });
  });

  it('não tenta registrar em simulador nem no Expo Go', async () => {
    mockDevice.isDevice = false;
    await expect(registerForPushNotifications()).resolves.toEqual({
      status: 'unsupported',
      reason: 'simulator',
    });

    mockDevice.isDevice = true;
    mockConstants.executionEnvironment = 'storeClient';
    await expect(registerForPushNotifications()).resolves.toEqual({
      status: 'unsupported',
      reason: 'expo-go',
    });
    expect(mocked.getPermissionsAsync).not.toHaveBeenCalled();
  });

  it('sem EAS Project ID, devolve erro em vez de pedir permissão', async () => {
    mockConstants.expoConfig = { extra: {} };

    await expect(registerForPushNotifications()).resolves.toMatchObject({ status: 'error' });
    expect(mocked.getPermissionsAsync).not.toHaveBeenCalled();
  });

  it('falhas ao obter o token viram erro, sem lançar', async () => {
    mocked.getPermissionsAsync.mockResolvedValue(permission('granted'));
    mocked.getExpoPushTokenAsync.mockRejectedValue(new Error('FCM não configurado'));

    await expect(registerForPushNotifications()).resolves.toEqual({
      status: 'error',
      message: 'Não foi possível ativar as notificações neste aparelho.',
    });
  });

  it('no Android, cria o canal padrão antes de pedir a permissão', async () => {
    const original = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    mocked.getPermissionsAsync.mockResolvedValue(permission('granted'));

    try {
      await registerForPushNotifications();
      expect(mocked.setNotificationChannelAsync).toHaveBeenCalledWith(
        'default',
        expect.objectContaining({ importance: 4 }),
      );
    } finally {
      Object.defineProperty(Platform, 'OS', { value: original, configurable: true });
    }
  });
});

describe('notificationRoute', () => {
  it('aceita só caminhos internos do app em data.url', () => {
    expect(notificationRoute({ url: '/goals' })).toBe('/goals');
    expect(notificationRoute({ url: '/savings-goal?id=3' })).toBe('/savings-goal?id=3');
  });

  it('ignora endereços externos e formatos inesperados', () => {
    expect(notificationRoute({ url: 'https://exemplo.com' })).toBeUndefined();
    expect(notificationRoute({ url: '//exemplo.com' })).toBeUndefined();
    expect(notificationRoute({ url: 42 })).toBeUndefined();
    expect(notificationRoute(null)).toBeUndefined();
    expect(notificationRoute(undefined)).toBeUndefined();
  });
});
