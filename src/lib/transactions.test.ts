import {
  TRANSACTIONS_LIMIT,
  expenseToTransaction,
  getTransactions,
  groupByDate,
  incomeToTransaction,
  mergeTransactions,
  searchTransactions,
} from './transactions';
import { IncomeCategory } from '@/types/dashboard';
import type { Income, LatestExpense } from '@/types/dashboard';

const expense = (id: number, expenseDate: string, title = `Despesa ${id}`): LatestExpense => ({
  id,
  title,
  category: 'Alimentação',
  color: '#F58A3C',
  amount: 10,
  expenseDate,
});

const income = (id: number, receivedAt: string, title = `Receita ${id}`): Income => ({
  id,
  title,
  amount: 100,
  receivedAt,
  category: IncomeCategory.Freelance,
});

describe('incomeToTransaction / expenseToTransaction', () => {
  it('mapeia receita com rótulo e categoria do enum', () => {
    expect(incomeToTransaction(income(7, '2026-10-05'))).toEqual({
      key: 'income-7',
      kind: 'income',
      title: 'Receita 7',
      category: 'Freelance',
      incomeCategory: IncomeCategory.Freelance,
      amount: 100,
      date: '2026-10-05',
    });
  });

  it('mapeia despesa com a categoria vinda da API', () => {
    expect(expenseToTransaction(expense(1, '2026-10-20T00:00:00'))).toEqual({
      key: 'expense-1',
      kind: 'expense',
      title: 'Despesa 1',
      category: 'Alimentação',
      amount: 10,
      date: '2026-10-20',
    });
  });
});

describe('mergeTransactions', () => {
  const incomes = [income(7, '2026-10-21'), income(8, '2026-10-19')].map(incomeToTransaction);
  const expenses = [expense(1, '2026-10-20T00:00:00'), expense(2, '2026-10-18T00:00:00')].map(
    expenseToTransaction,
  );

  it('ordena pela data, mais recentes primeiro', () => {
    expect(mergeTransactions(incomes, expenses).map((item) => item.key)).toEqual([
      'income-7',
      'expense-1',
      'income-8',
      'expense-2',
    ]);
  });

  it('respeita o limite quando informado', () => {
    expect(mergeTransactions(incomes, expenses, 2)).toHaveLength(2);
  });

  it('em datas iguais, mantém receitas antes de despesas', () => {
    const sameDay = mergeTransactions(
      [incomeToTransaction(income(9, '2026-10-20'))],
      [expenseToTransaction(expense(3, '2026-10-20T00:00:00'))],
    );
    expect(sameDay.map((item) => item.key)).toEqual(['income-9', 'expense-3']);
  });
});

describe('groupByDate', () => {
  it('agrupa itens consecutivos do mesmo dia', () => {
    const items = mergeTransactions(
      [income(7, '2026-10-21'), income(8, '2026-10-20')].map(incomeToTransaction),
      [expense(1, '2026-10-21T00:00:00')].map(expenseToTransaction),
    );
    expect(groupByDate(items).map((group) => [group.date, group.items.map((i) => i.key)])).toEqual([
      ['2026-10-21', ['income-7', 'expense-1']],
      ['2026-10-20', ['income-8']],
    ]);
  });
});

describe('searchTransactions', () => {
  const items = [
    incomeToTransaction(income(1, '2026-10-21', 'Salário')),
    expenseToTransaction(expense(2, '2026-10-20T00:00:00', 'Mercado')),
  ];

  it('busca no título e na categoria, sem diferenciar acentos e maiúsculas', () => {
    expect(searchTransactions(items, 'SALARIO').map((i) => i.title)).toEqual(['Salário']);
    expect(searchTransactions(items, 'alimenta').map((i) => i.title)).toEqual(['Mercado']);
  });

  it('devolve tudo com a busca vazia', () => {
    expect(searchTransactions(items, '  ')).toBe(items);
  });
});

describe('getTransactions', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    process.env.EXPO_PUBLIC_API_URL = 'http://api.test';
    fetchMock.mockReset();
    globalThis.fetch = fetchMock;
  });

  it('carrega as últimas receitas e despesas e indica quando há mais na API', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      const json = url.includes('monthly-summary')
        ? { totalIncome: 100, totalExpense: 10, balance: 90, year: 2026, month: 10 }
        : url.includes('lastest-expenses')
          ? [expense(1, '2026-10-20T00:00:00')]
          : { data: [income(7, '2026-10-21')], page: 1, pageSize: 50, totalRecords: 80 };
      return {
        ok: true,
        status: 200,
        json: async () => json,
        text: async () => JSON.stringify(json),
      };
    });

    const data = await getTransactions('token-123');

    expect(data.incomes.map((i) => i.key)).toEqual(['income-7']);
    expect(data.expenses.map((i) => i.key)).toEqual(['expense-1']);
    expect(data.summary.totalIncome).toBe(100);
    expect(data.truncated).toBe(true);

    const urls = fetchMock.mock.calls.map(([url]) => url);
    expect(urls).toContain(
      `http://api.test/api/dashboard/lastest-expenses?count=${TRANSACTIONS_LIMIT}`,
    );
    expect(urls).toContain(`http://api.test/api/income?Page=1&PageSize=${TRANSACTIONS_LIMIT}`);
  });
});
