import { ApiError, apiGet } from '@/lib/api';

import { SessionUnavailableError, getSession, logout, withSession } from './auth';

const mockStore = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => mockStore.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => {
    mockStore.set(key, value);
  },
  deleteItemAsync: async (key: string) => {
    mockStore.delete(key);
  },
}));

// O logout só usa o módulo de notificações para desativar o token; os módulos nativos dele
// não participam deste fluxo.
jest.mock('expo-notifications', () => ({}));
jest.mock('expo-device', () => ({}));
jest.mock('expo-application', () => ({}));

describe('logout', () => {
  const fetchMock = jest.fn();
  const session = { name: 'Ana', token: 'access-token', refreshToken: 'refresh-token' };

  beforeEach(() => {
    process.env.EXPO_PUBLIC_API_URL = 'http://api.test';
    fetchMock.mockReset();
    globalThis.fetch = fetchMock;
    mockStore.clear();
    mockStore.set('micash.session', JSON.stringify(session));
  });

  it('desativa o push antes do /logout, com a sessão ainda válida, e apaga a sessão', async () => {
    mockStore.set('micash.pushToken', 'ExponentPushToken[abc]');
    fetchMock.mockResolvedValue({ ok: true, status: 204, text: async () => '' });

    await logout();

    const calls = fetchMock.mock.calls.map(([url, init]) => [url, init.method]);
    expect(calls).toEqual([
      ['http://api.test/api/device/push-token', 'DELETE'],
      ['http://api.test/logout', 'POST'],
    ]);
    for (const [, init] of fetchMock.mock.calls) {
      expect(init.headers.Authorization).toBe('Bearer access-token');
    }
    await expect(getSession()).resolves.toBeNull();
    expect(mockStore.has('micash.pushToken')).toBe(false);
  });

  it('sai mesmo sem conexão', async () => {
    mockStore.set('micash.pushToken', 'ExponentPushToken[abc]');
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));

    await expect(logout()).resolves.toBeUndefined();
    await expect(getSession()).resolves.toBeNull();
  });

  it('sem token de push registrado, só chama o /logout', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 204, text: async () => '' });

    await logout();

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['http://api.test/logout']);
  });
});

describe('withSession', () => {
  const fetchMock = jest.fn();
  const session = { name: 'Ana', token: 'old-access', refreshToken: 'old-refresh' };
  const renewed = { name: 'Ana', token: 'new-access', refreshToken: 'new-refresh' };

  const json = (status: number, body?: unknown) => ({
    ok: status < 400,
    status,
    json: async () => body ?? null,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  });

  /** API falsa: aceita só o access token novo e troca o refresh token antigo uma única vez. */
  function fakeApi({ refreshStatus = 200 }: { refreshStatus?: number } = {}) {
    let refreshed = false;
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      const headers = init.headers as Record<string, string>;
      if (url.endsWith('/refresh')) {
        const { refreshToken } = JSON.parse(String(init.body));
        if (refreshStatus !== 200 || refreshed || refreshToken !== 'old-refresh') {
          return json(401, { errorMessages: ['Token inválido.'] });
        }
        refreshed = true;
        return json(200, renewed);
      }
      return headers.Authorization === 'Bearer new-access'
        ? json(200, { ok: true })
        : json(401, { errorMessages: [] });
    });
  }

  const refreshCalls = () =>
    fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/refresh')).length;

  beforeEach(() => {
    process.env.EXPO_PUBLIC_API_URL = 'http://api.test';
    fetchMock.mockReset();
    globalThis.fetch = fetchMock;
    mockStore.clear();
    mockStore.set('micash.session', JSON.stringify(session));
  });

  it('no 401, renova a sessão, salva e repete com o token novo', async () => {
    fakeApi();

    await expect(withSession((token) => apiGet('/api/x', token))).resolves.toEqual({ ok: true });

    const refresh = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/refresh'));
    expect(refresh?.[1].headers.Authorization).toBeUndefined();
    await expect(getSession()).resolves.toEqual(renewed);
  });

  it('requisições simultâneas com 401 compartilham um único refresh', async () => {
    fakeApi();

    const results = await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        withSession((token) => apiGet(`/api/consulta-${index}`, token)),
      ),
    );

    expect(results).toHaveLength(6);
    expect(refreshCalls()).toBe(1);
    await expect(getSession()).resolves.toEqual(renewed);
  });

  it('com o refresh recusado, lança "expired" sem apagar a sessão (quem captura decide)', async () => {
    fakeApi({ refreshStatus: 401 });

    const error = await withSession((token) => apiGet('/api/x', token)).catch((err) => err);

    expect(error).toBeInstanceOf(SessionUnavailableError);
    expect((error as SessionUnavailableError).reason).toBe('expired');
    await expect(getSession()).resolves.toEqual(session);
  });

  it('sem conexão no refresh, repassa o erro de rede e mantém a sessão', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/refresh')) throw new TypeError('Network request failed');
      return json(401);
    });

    const error = await withSession((token) => apiGet('/api/x', token)).catch((err) => err);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBeUndefined();
    await expect(getSession()).resolves.toEqual(session);
  });

  it('sem sessão salva, lança "no-session" sem chamar a API', async () => {
    mockStore.clear();

    const error = await withSession((token) => apiGet('/api/x', token)).catch((err) => err);

    expect(error).toMatchObject({ reason: 'no-session' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('outros erros não disparam o refresh', async () => {
    fetchMock.mockResolvedValue(json(400, { errorMessages: ['Inválido.'] }));

    await expect(withSession((token) => apiGet('/api/x', token))).rejects.toMatchObject({
      status: 400,
    });
    expect(refreshCalls()).toBe(0);
  });

  it('logout com o access token vencido: renova, desativa o push e revoga o refresh token novo', async () => {
    mockStore.set('micash.pushToken', 'ExponentPushToken[abc]');
    fakeApi();

    await logout();

    const calls = fetchMock.mock.calls.map(([url, init]) => [
      String(url).replace('http://api.test', ''),
      init.method,
      init.headers.Authorization,
    ]);
    expect(calls).toEqual([
      ['/api/device/push-token', 'DELETE', 'Bearer old-access'],
      ['/refresh', 'POST', undefined],
      ['/api/device/push-token', 'DELETE', 'Bearer new-access'],
      ['/logout', 'POST', 'Bearer new-access'],
    ]);
    const logoutBody = JSON.parse(String(fetchMock.mock.calls[3][1].body));
    expect(logoutBody).toEqual({ refreshToken: 'new-refresh' });
    await expect(getSession()).resolves.toBeNull();
    expect(mockStore.has('micash.pushToken')).toBe(false);
  });
});
