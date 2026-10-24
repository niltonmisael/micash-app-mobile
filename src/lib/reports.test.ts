import { EVOLUTION_MONTHS, getReport, resolveChartColors } from './reports';
import { CATEGORY_COLORS } from '@/constants/colors';
import type { ExpenseCategorySummary } from '@/types/dashboard';

const item = (id: number, color: string, amount = 10): ExpenseCategorySummary => ({
  categoryId: id,
  categoryName: `Categoria ${id}`,
  amount,
  categoryColor: color,
  percentage: 50,
});

describe('resolveChartColors', () => {
  it('mantém cores hexadecimais e preserva nome, valor e percentual da API', () => {
    expect(resolveChartColors([item(1, '#5B8DEF', 99.9)])).toEqual([
      { id: 1, name: 'Categoria 1', amount: 99.9, percentage: 50, color: '#5B8DEF' },
    ]);
  });

  it('dá cores distintas da paleta às cores fora do padrão, sem repetir as já usadas', () => {
    const [a, b, c] = resolveChartColors([
      item(1, 'amarelo'),
      item(2, CATEGORY_COLORS[0]),
      item(3, 'azul'),
    ]);
    expect(b.color).toBe(CATEGORY_COLORS[0]);
    expect(a.color).not.toBe(CATEGORY_COLORS[0]);
    expect(c.color).not.toBe(CATEGORY_COLORS[0]);
    expect(a.color).not.toBe(c.color);
  });
});

describe('getReport', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    process.env.EXPO_PUBLIC_API_URL = 'http://api.test';
    fetchMock.mockReset();
    globalThis.fetch = fetchMock;
  });

  function respond(json: unknown) {
    return {
      ok: true,
      status: 200,
      json: async () => json,
      text: async () => JSON.stringify(json),
    };
  }

  it('usa as despesas por categoria do mês e o total de despesa de cada um dos 6 meses', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.includes('expenses-by-category')) {
        return respond([{ ...item(4, '#E06C8B', 1500), percentage: 71.09 }]);
      }
      const month = Number(new URL(url).searchParams.get('month'));
      return respond({ totalIncome: 0, totalExpense: month * 100, balance: 0, year: 0, month });
    });

    const data = await getReport('token-123', { year: 2026, month: 2 });

    expect(data.totalExpense).toBe(200);
    expect(data.categories).toEqual([
      { id: 4, name: 'Categoria 4', amount: 1500, percentage: 71.09, color: '#E06C8B' },
    ]);
    expect(data.evolution.map((e) => [e.period.year, e.period.month, e.totalExpense])).toEqual([
      [2025, 9, 900],
      [2025, 10, 1000],
      [2025, 11, 1100],
      [2025, 12, 1200],
      [2026, 1, 100],
      [2026, 2, 200],
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1 + EVOLUTION_MONTHS);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://api.test/api/dashboard/expenses-by-category?year=2026&month=2',
    );
    for (const [, init] of fetchMock.mock.calls) {
      expect(init.headers.Authorization).toBe('Bearer token-123');
    }
  });

  it('trata mês sem despesas (lista vazia)', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.includes('expenses-by-category')
        ? respond([])
        : respond({ totalIncome: 0, totalExpense: 0, balance: 0, year: 2026, month: 10 }),
    );

    const data = await getReport('token', { year: 2026, month: 10 });
    expect(data.categories).toEqual([]);
    expect(data.totalExpense).toBe(0);
  });
});
