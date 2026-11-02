import { chartDays, getDashboard } from './dashboard';

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
      daily: [],
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
        'http://api.test/api/dashboard/daily-summary?year=2026&month=10',
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

describe('resumo diário do Dashboard', () => {
  const fetchMock = jest.fn();
  const day = (n: number, cumulativeIncome = 0, cumulativeExpense = 0) => ({
    day: n,
    income: 0,
    expense: 0,
    cumulativeIncome,
    cumulativeExpense,
  });

  beforeEach(() => {
    process.env.EXPO_PUBLIC_API_URL = 'http://api.test';
    fetchMock.mockReset();
    globalThis.fetch = fetchMock;
  });

  it('traz os dias do mês com os acumulados da API', async () => {
    const days = [day(1, 6000, 250), day(2, 6000, 250)];
    fetchMock.mockImplementation(async (url: string) =>
      url.includes('daily-summary')
        ? {
            ok: true,
            status: 200,
            json: async () => ({ year: 2026, month: 10, days }),
            text: async () => JSON.stringify({ year: 2026, month: 10, days }),
          }
        : { ok: true, status: 204, json: async () => null, text: async () => '' },
    );

    const data = await getDashboard('t', new Date(2026, 9, 21));

    expect(data.daily).toEqual(days);
  });

  it('uma falha no resumo diário só deixa o gráfico de fora', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.includes('daily-summary')
        ? { ok: false, status: 500, json: async () => null, text: async () => '' }
        : { ok: true, status: 204, json: async () => null, text: async () => '' },
    );

    const data = await getDashboard('t', new Date(2026, 9, 21));

    expect(data.daily).toBeNull();
    expect(data.transactions).toEqual([]);
  });

  it('o gráfico desenha só até hoje', () => {
    const days = Array.from({ length: 31 }, (_, index) => day(index + 1));
    expect(chartDays(days, new Date(2026, 9, 21)).map((item) => item.day)).toEqual(
      Array.from({ length: 21 }, (_, index) => index + 1),
    );
  });
});
