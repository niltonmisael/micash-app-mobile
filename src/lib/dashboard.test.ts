import { chartDays, forecastGoalsAtRisk, getDashboard } from './dashboard';
import type { GoalForecast } from '@/types/dashboard';

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
      forecast: null,
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
        'http://api.test/api/dashboard/month-forecast',
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

describe('previsão do mês no Dashboard', () => {
  const fetchMock = jest.fn();
  const forecast = {
    year: 2026,
    month: 11,
    today: 10,
    daysInMonth: 30,
    isReliable: true,
    income: 5000,
    expenseToDate: 1000,
    scheduledExpense: 0,
    dailyExpenseRate: 100,
    projectedExpense: 3000,
    projectedBalance: 2000,
    goals: [],
  };
  const respondForecast = (response: object) =>
    fetchMock.mockImplementation(async (url: string) =>
      url.includes('month-forecast')
        ? response
        : { ok: true, status: 204, json: async () => null, text: async () => '' },
    );

  beforeEach(() => {
    process.env.EXPO_PUBLIC_API_URL = 'http://api.test';
    fetchMock.mockReset();
    globalThis.fetch = fetchMock;
  });

  it('traz a previsão como a API devolve', async () => {
    respondForecast({
      ok: true,
      status: 200,
      json: async () => forecast,
      text: async () => JSON.stringify(forecast),
    });

    expect((await getDashboard('t')).forecast).toEqual(forecast);
  });

  it('sem assinatura (403) o card fica bloqueado, sem erro', async () => {
    respondForecast({
      ok: false,
      status: 403,
      json: async () => ({ errorMessages: ['Sua assinatura não está ativa.'] }),
    });

    const data = await getDashboard('t');

    expect(data.forecast).toBe('locked');
    expect(data.transactions).toEqual([]);
  });

  it('outras falhas só deixam o card indisponível', async () => {
    respondForecast({ ok: false, status: 500, json: async () => null });

    expect((await getDashboard('t')).forecast).toBeNull();
  });
});

describe('forecastGoalsAtRisk', () => {
  const goal = (
    categoryId: number,
    flags: Partial<Pick<GoalForecast, 'alreadyExceeded' | 'willExceed' | 'estimatedExceedDay'>>,
  ): GoalForecast => ({
    categoryId,
    categoryName: `Categoria ${categoryId}`,
    targetAmount: 500,
    currentAmount: 300,
    projectedAmount: 900,
    alreadyExceeded: false,
    willExceed: false,
    estimatedExceedDay: null,
    ...flags,
  });

  it('deixa de fora as metas dentro do previsto e põe as estouradas primeiro', () => {
    const goals = [
      goal(1, { willExceed: true, estimatedExceedDay: 20 }),
      goal(2, {}),
      goal(3, { alreadyExceeded: true }),
      goal(4, { willExceed: true, estimatedExceedDay: 17 }),
    ];

    expect(forecastGoalsAtRisk(goals).map((item) => item.categoryId)).toEqual([3, 4, 1]);
  });

  it('mostra no máximo a quantidade pedida', () => {
    const goals = [1, 2, 3, 4].map((id) => goal(id, { alreadyExceeded: true }));

    expect(forecastGoalsAtRisk(goals, 2)).toHaveLength(2);
  });
});
