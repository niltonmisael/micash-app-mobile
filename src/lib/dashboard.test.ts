import { getDashboard } from './dashboard';

describe('getDashboard', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    process.env.EXPO_PUBLIC_API_URL = 'http://api.test';
    fetchMock.mockReset();
    globalThis.fetch = fetchMock;
  });

  it('consulta os três endpoints do mês corrente com o token e trata 204 como vazio', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('monthly-summary')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            totalIncome: 8000,
            totalExpense: 2110,
            balance: 5890,
            year: 2026,
            month: 10,
          }),
          text: async () =>
            JSON.stringify({
              totalIncome: 8000,
              totalExpense: 2110,
              balance: 5890,
              year: 2026,
              month: 10,
            }),
        };
      }
      return { ok: true, status: 204, json: async () => null, text: async () => '' };
    });

    const data = await getDashboard('token-123', new Date(2026, 9, 21));

    expect(data).toEqual({
      summary: { totalIncome: 8000, totalExpense: 2110, balance: 5890, year: 2026, month: 10 },
      transactions: [],
      goals: [],
    });

    // As consultas correm em paralelo: a ordem das chamadas não é garantida.
    const urls = fetchMock.mock.calls.map(([url]) => url);
    expect([...urls].sort()).toEqual(
      [
        'http://api.test/api/dashboard/monthly-summary?year=2026&month=10',
        'http://api.test/api/dashboard/lastest-expenses?count=5',
        'http://api.test/api/income?Page=1&PageSize=5',
        'http://api.test/api/financial-goal/progress?month=10&year=2026',
        'http://api.test/api/financial-goal?month=10&year=2026',
        'http://api.test/api/category/all',
      ].sort(),
    );
    for (const [, init] of fetchMock.mock.calls) {
      expect(init.headers.Authorization).toBe('Bearer token-123');
      expect(init.method).toBe('GET');
    }
  });

  it('mostra o Dashboard mesmo quando as metas falham (card "indisponível")', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('financial-goal')) {
        return { ok: false, status: 500, json: async () => null, text: async () => '' };
      }
      return { ok: true, status: 204, json: async () => null, text: async () => '' };
    });

    const data = await getDashboard('token-123', new Date(2026, 9, 21));

    expect(data.goals).toBeNull();
    expect(data.transactions).toEqual([]);
  });

  it('propaga o 401 para a tela tratar a sessão expirada', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => null });

    await expect(getDashboard('expirado')).rejects.toMatchObject({ status: 401 });
  });
});
