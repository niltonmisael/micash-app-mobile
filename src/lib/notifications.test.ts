import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import {
  configureForegroundNotifications,
  getNotificationPermissionState,
  getNotificationsModule,
  getPushDevices,
  notificationRoute,
  pushTokenSuffix,
  registerForPushNotifications,
  registerPushDevice,
  sendTestPushNotification,
  unregisterPushDevice,
} from './notifications';

const mockDevice = { isDevice: true, modelName: 'Pixel 7' as string | null };
const mockStore = new Map<string, string>();
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
  get modelName() {
    return mockDevice.modelName;
  },
}));

jest.mock('expo-application', () => ({
  getAndroidId: () => 'android-id-1',
  getIosIdForVendorAsync: async () => 'ios-vendor-id-1',
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => mockStore.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    mockStore.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    mockStore.delete(key);
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
  setNotificationHandler: jest.fn(),
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

  // O jest-expo roda como iOS por padrão.
  it('não tenta registrar no simulador do iOS nem no Expo Go', async () => {
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

  it('no emulador Android (com Google Play Services), registra normalmente', async () => {
    const original = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
    mockDevice.isDevice = false;
    mocked.getPermissionsAsync.mockResolvedValue(permission('granted'));

    try {
      await expect(registerForPushNotifications()).resolves.toEqual({
        status: 'granted',
        token: 'ExponentPushToken[abc]',
      });
    } finally {
      Object.defineProperty(Platform, 'OS', { value: original, configurable: true });
    }
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

describe('registro do aparelho na API', () => {
  const fetchMock = jest.fn();
  const token = 'ExponentPushToken[abc]';

  const respond = (status: number, body?: unknown) => ({
    ok: status < 400,
    status,
    json: async () => body ?? null,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  });

  function withPlatform<T>(os: string, run: () => Promise<T>): Promise<T> {
    const original = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
    return run().finally(() =>
      Object.defineProperty(Platform, 'OS', { value: original, configurable: true }),
    );
  }

  beforeEach(() => {
    process.env.EXPO_PUBLIC_API_URL = 'http://api.test';
    fetchMock.mockReset();
    globalThis.fetch = fetchMock;
    mockStore.clear();
    mockDevice.modelName = 'Pixel 7';
  });

  it('envia token, plataforma, id estável e modelo, e guarda o token registrado', async () => {
    fetchMock.mockResolvedValue(respond(200, { id: 1 }));

    await withPlatform('android', () => registerPushDevice('session-token', token));

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/api/device/push-token');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer session-token');
    expect(JSON.parse(init.body)).toEqual({
      expoPushToken: token,
      platform: 'android',
      deviceId: 'android-id-1',
      deviceName: 'Pixel 7',
    });
    expect(mockStore.get('micash.pushToken')).toBe(token);
  });

  it('no iOS usa o identificador do fornecedor', async () => {
    fetchMock.mockResolvedValue(respond(200, { id: 1 }));
    mockDevice.modelName = null;

    await withPlatform('ios', () => registerPushDevice('session-token', token));

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      platform: 'ios',
      deviceId: 'ios-vendor-id-1',
      deviceName: null,
    });
  });

  it('não guarda o token quando a API recusa o registro', async () => {
    fetchMock.mockResolvedValue(respond(400, { errorMessages: ['Token inválido.'] }));

    await expect(registerPushDevice('session-token', token)).rejects.toMatchObject({
      status: 400,
    });
    expect(mockStore.has('micash.pushToken')).toBe(false);
  });

  it('desativa o token guardado com DELETE e corpo, e o esquece', async () => {
    mockStore.set('micash.pushToken', token);
    fetchMock.mockResolvedValue(respond(204));

    await unregisterPushDevice('session-token');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/api/device/push-token');
    expect(init.method).toBe('DELETE');
    expect(init.headers.Authorization).toBe('Bearer session-token');
    expect(JSON.parse(init.body)).toEqual({ expoPushToken: token });
    expect(mockStore.has('micash.pushToken')).toBe(false);
  });

  it('sem token registrado, não chama a API', async () => {
    await unregisterPushDevice('session-token');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('no 401, repassa o erro e mantém o token para tentar de novo após renovar a sessão', async () => {
    mockStore.set('micash.pushToken', token);
    fetchMock.mockResolvedValue(respond(401));

    await expect(unregisterPushDevice('session-token')).rejects.toMatchObject({ status: 401 });
    expect(mockStore.get('micash.pushToken')).toBe(token);
  });

  it('o 404 (token já desativado ou de outra conta) conta como feito', async () => {
    mockStore.set('micash.pushToken', token);
    fetchMock.mockResolvedValue(respond(404, { errorMessages: ['Aparelho não encontrado.'] }));

    await expect(unregisterPushDevice('session-token')).resolves.toBeUndefined();
    expect(mockStore.has('micash.pushToken')).toBe(false);
  });
});

describe('pushTokenSuffix', () => {
  it('reproduz o tokenSuffix da API (PushTokenMask.Suffix)', () => {
    expect(pushTokenSuffix('ExponentPushToken[abcdefghij123456]')).toBe('…123456');
    expect(pushTokenSuffix('ExpoPushToken[abc]')).toBe('…');
    expect(pushTokenSuffix('ExponentPushToken[abcdef]')).toBe('…');
    expect(pushTokenSuffix('ExponentPushToken[abcdefg]')).toBe('…bcdefg');
  });
});

describe('aparelhos e notificação de teste', () => {
  const fetchMock = jest.fn();

  const respond = (status: number, body?: unknown) => ({
    ok: status < 400,
    status,
    json: async () => body ?? null,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  });

  beforeEach(() => {
    process.env.EXPO_PUBLIC_API_URL = 'http://api.test';
    fetchMock.mockReset();
    globalThis.fetch = fetchMock;
  });

  it('lista os aparelhos da conta e trata 204 como lista vazia', async () => {
    const device = {
      id: 1,
      platform: 'android',
      deviceName: 'Pixel 7',
      tokenSuffix: '…123456',
      isActive: true,
      createdAt: '2026-11-02T18:00:00Z',
      lastUsedAt: null,
    };
    fetchMock.mockResolvedValueOnce(respond(200, { devices: [device] }));
    await expect(getPushDevices('session-token')).resolves.toEqual([device]);
    expect(fetchMock.mock.calls[0][0]).toBe('http://api.test/api/device/push-tokens');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer session-token');

    fetchMock.mockResolvedValueOnce(respond(204));
    await expect(getPushDevices('session-token')).resolves.toEqual([]);
  });

  it('envia a notificação de teste sem corpo e devolve quantos aparelhos receberam', async () => {
    fetchMock.mockResolvedValueOnce(respond(202, { notificationId: 9, devices: 2 }));

    await expect(sendTestPushNotification('session-token')).resolves.toEqual({
      notificationId: 9,
      devices: 2,
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/api/device/push-token/test');
    expect(init.method).toBe('POST');
    expect(init.body).toBeUndefined();
  });

  it('repassa o 404 da API fora de Development e o 400 sem aparelhos ativos', async () => {
    fetchMock.mockResolvedValueOnce(respond(404));
    await expect(sendTestPushNotification('t')).rejects.toMatchObject({ status: 404 });

    fetchMock.mockResolvedValueOnce(
      respond(400, { errorMessages: ['Nenhum aparelho com notificações ativadas.'] }),
    );
    await expect(sendTestPushNotification('t')).rejects.toMatchObject({
      status: 400,
      message: 'Nenhum aparelho com notificações ativadas.',
    });
  });
});

describe('getNotificationPermissionState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDevice.isDevice = true;
    mockConstants.executionEnvironment = 'bare';
  });

  it('informa a permissão sem pedir nada ao usuário', async () => {
    for (const status of ['granted', 'undetermined', 'denied']) {
      mocked.getPermissionsAsync.mockResolvedValueOnce(permission(status));
      await expect(getNotificationPermissionState()).resolves.toBe(status);
    }
    expect(mocked.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('no simulador do iOS, informa que não há suporte', async () => {
    mockDevice.isDevice = false;
    await expect(getNotificationPermissionState()).resolves.toEqual({ unsupported: 'simulator' });
  });
});

describe('getNotificationsModule', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConstants.executionEnvironment = 'bare';
  });

  it('no Expo Go não carrega o expo-notifications (a importação lança no SDK 57)', () => {
    mockConstants.executionEnvironment = 'storeClient';

    expect(getNotificationsModule()).toBeNull();
    expect(() => configureForegroundNotifications()).not.toThrow();
    expect(mocked.setNotificationHandler).not.toHaveBeenCalled();
  });

  it('na development build carrega o módulo e configura a exibição com o app aberto', () => {
    expect(getNotificationsModule()?.setNotificationHandler).toBe(mocked.setNotificationHandler);

    configureForegroundNotifications();

    expect(mocked.setNotificationHandler).toHaveBeenCalledTimes(1);
  });
});
