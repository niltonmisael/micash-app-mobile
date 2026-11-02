import { SavingsMovementType } from '@/types/savings';

import {
  createSavingsGoal,
  getSavingsGoal,
  getSavingsGoals,
  registerSavingsMovement,
  updateSavingsGoal,
} from './savings';

describe('savings', () => {
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

  it('lista as metas na ordem da API e trata 204 como lista vazia', async () => {
    const goal = {
      id: 1,
      name: 'Viagem',
      icon: 'plane',
      color: '#F58A3C',
      targetAmount: 5000,
      savedAmount: 3200,
      percentage: 64,
      deadline: '2026-12-31',
      isCompleted: false,
    };
    fetchMock.mockResolvedValueOnce(respond(200, { savingsGoals: [goal] }));
    await expect(getSavingsGoals('token-123')).resolves.toEqual([goal]);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/api/savings-goal');
    expect(init.headers.Authorization).toBe('Bearer token-123');

    fetchMock.mockResolvedValueOnce(respond(204));
    await expect(getSavingsGoals('token-123')).resolves.toEqual([]);
  });

  it('busca o detalhe pelo id', async () => {
    fetchMock.mockResolvedValueOnce(respond(200, { id: 7, movements: [] }));
    await expect(getSavingsGoal('t', 7)).resolves.toEqual({ id: 7, movements: [] });
    expect(fetchMock.mock.calls[0][0]).toBe('http://api.test/api/savings-goal/7');
  });

  it('cria e edita a meta com o corpo do contrato', async () => {
    fetchMock.mockResolvedValue(respond(201, { id: 3 }));
    const data = {
      name: 'Viagem',
      targetAmount: 5000,
      deadline: '2026-12-31',
      icon: 'plane',
      color: '#F58A3C',
    };

    await createSavingsGoal('t', { ...data, initialAmount: 300 });
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ ...data, initialAmount: 300 });

    fetchMock.mockResolvedValue(respond(204));
    await updateSavingsGoal('t', 3, { ...data, deadline: null });
    expect(fetchMock.mock.calls[1][0]).toBe('http://api.test/api/savings-goal/3');
    expect(fetchMock.mock.calls[1][1].method).toBe('PUT');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).deadline).toBeNull();
  });

  it('envia depósito e retirada para as rotas próprias', async () => {
    fetchMock.mockResolvedValue(respond(201, { id: 10 }));
    const movement = { amount: 300, date: '2026-10-21' };

    await registerSavingsMovement('t', 1, SavingsMovementType.Deposit, movement);
    await registerSavingsMovement('t', 1, SavingsMovementType.Withdrawal, movement);

    expect(fetchMock.mock.calls[0][0]).toBe('http://api.test/api/savings-goal/1/deposit');
    expect(fetchMock.mock.calls[1][0]).toBe('http://api.test/api/savings-goal/1/withdraw');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual(movement);
  });

  it('repassa a mensagem da API quando a retirada passa do guardado', async () => {
    fetchMock.mockResolvedValueOnce(
      respond(400, {
        errorMessages: ['O valor da retirada é maior que o valor guardado na meta.'],
      }),
    );
    await expect(
      registerSavingsMovement('t', 1, SavingsMovementType.Withdrawal, {
        amount: 9999,
        date: '2026-10-21',
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: 'O valor da retirada é maior que o valor guardado na meta.',
    });
  });
});
