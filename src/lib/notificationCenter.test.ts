import {
  getNotifications,
  getUnreadNotificationsCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  notificationIdFromData,
} from './notificationCenter';

describe('notificationCenter', () => {
  const fetchMock = jest.fn();

  const respond = (status: number, body?: unknown) => ({
    ok: status < 400,
    status,
    json: async () => body ?? null,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  });

  const notification = {
    id: 42,
    type: 'test',
    title: 'Notificações ativadas',
    body: 'Este é um teste.',
    url: '/home',
    createdAt: '2026-11-02T18:00:00Z',
    readAt: null,
  };

  beforeEach(() => {
    process.env.EXPO_PUBLIC_API_URL = 'http://api.test';
    fetchMock.mockReset();
    globalThis.fetch = fetchMock;
  });

  it('busca a página mais recente e, com cursor, as anteriores', async () => {
    fetchMock.mockResolvedValue(respond(200, { notifications: [notification], hasMore: true }));

    await expect(getNotifications('token-123')).resolves.toEqual({
      notifications: [notification],
      hasMore: true,
    });
    await getNotifications('token-123', 42);

    expect(fetchMock.mock.calls[0][0]).toBe('http://api.test/api/notification?limit=20');
    expect(fetchMock.mock.calls[1][0]).toBe('http://api.test/api/notification?limit=20&before=42');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer token-123');
  });

  it('sem notificações (204), devolve lista vazia', async () => {
    fetchMock.mockResolvedValue(respond(204));

    await expect(getNotifications('t')).resolves.toEqual({ notifications: [], hasMore: false });
  });

  it('lê o número de não lidas', async () => {
    fetchMock.mockResolvedValue(respond(200, { count: 3 }));

    await expect(getUnreadNotificationsCount('t')).resolves.toBe(3);
    expect(fetchMock.mock.calls[0][0]).toBe('http://api.test/api/notification/unread-count');
  });

  it('marca uma e todas como lidas com PUT sem corpo', async () => {
    fetchMock.mockResolvedValue(respond(204));

    await markNotificationAsRead('t', 42);
    await markAllNotificationsAsRead('t');

    const calls = fetchMock.mock.calls.map(([url, init]) => [url, init.method, init.body]);
    expect(calls).toEqual([
      ['http://api.test/api/notification/42/read', 'PUT', undefined],
      ['http://api.test/api/notification/read-all', 'PUT', undefined],
    ]);
  });

  it('repassa o 404 de notificação de outro usuário', async () => {
    fetchMock.mockResolvedValue(respond(404, { errorMessages: ['Notificação não encontrada.'] }));

    await expect(markNotificationAsRead('t', 999)).rejects.toMatchObject({ status: 404 });
  });

  describe('notificationIdFromData', () => {
    it('lê o id que a API envia como texto no data do push', () => {
      expect(notificationIdFromData({ type: 'test', url: '/home', notificationId: '42' })).toBe(42);
      expect(notificationIdFromData({ notificationId: 7 })).toBe(7);
    });

    it('ignora ids ausentes ou inválidos', () => {
      expect(notificationIdFromData({ type: 'test' })).toBeUndefined();
      expect(notificationIdFromData({ notificationId: 'abc' })).toBeUndefined();
      expect(notificationIdFromData({ notificationId: '0' })).toBeUndefined();
      expect(notificationIdFromData({ notificationId: '1.5' })).toBeUndefined();
      expect(notificationIdFromData(null)).toBeUndefined();
    });
  });
});
