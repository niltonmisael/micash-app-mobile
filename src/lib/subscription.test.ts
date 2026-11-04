import {
  annualDiscountPercent,
  cancelSubscription,
  chatMonthExhaustedMessage,
  chatUsageLabel,
  createCheckout,
  getPlanLimits,
  isFreePlan,
  isHistoryLocked,
  plansByCycle,
  premiumAccessUntil,
  reachedLimit,
  reactivateSubscription,
  subscriptionStatusLabel,
} from './subscription';
import { changePassword, updateProfile } from './user';
import { SubscriptionStatus } from '@/types/user';
import type { CurrentSubscription, Plan, PlanLimits } from '@/types/user';

const subscription = (changes: Partial<CurrentSubscription>): CurrentSubscription => ({
  planId: null,
  planName: 'Free',
  status: SubscriptionStatus.Pending,
  statusDescription: 'Free',
  cancelAtPeriodEnd: false,
  nextBillingDate: null,
  endsAt: null,
  price: 0,
  ...changes,
});

describe('isFreePlan / subscriptionStatusLabel', () => {
  it('identifica o plano gratuito pelo planId nulo (status 0 coincide com Pending)', () => {
    const free = subscription({});
    expect(isFreePlan(free)).toBe(true);
    expect(subscriptionStatusLabel(free)).toBe('Gratuito');
  });

  it.each([
    [SubscriptionStatus.Pending, 'Pagamento pendente'],
    [SubscriptionStatus.Active, 'Ativa'],
    [SubscriptionStatus.PastDue, 'Pagamento em atraso'],
    [SubscriptionStatus.Cancelled, 'Cancelada'],
    [SubscriptionStatus.Expired, 'Expirada'],
    [SubscriptionStatus.PaymentFailed, 'Falha no pagamento'],
  ])('status %p de plano pago vira %p', (status, label) => {
    expect(subscriptionStatusLabel(subscription({ planId: 1, planName: 'Premium', status }))).toBe(
      label,
    );
  });
});

describe('plansByCycle / annualDiscountPercent', () => {
  const plan = (id: number, name: string, price: number): Plan => ({ id, name, price });
  const monthly = plan(1, 'Premium Mensal', 14.9);
  const annual = plan(2, 'Premium Anual', 149.9);

  it('identifica mensal e anual pelo nome, em qualquer ordem', () => {
    expect(plansByCycle([annual, monthly])).toEqual({ monthly, annual });
  });

  it('sem pista no nome, o mais barato é o mensal e o mais caro, o anual', () => {
    const a = plan(3, 'Plano Premium', 149.9);
    const b = plan(4, 'Plano Premium', 14.9);
    expect(plansByCycle([a, b])).toEqual({ monthly: b, annual: a });
  });

  it('com um plano só, ele é o mensal (a menos que o nome diga anual)', () => {
    expect(plansByCycle([plan(5, 'Premium', 14.9)])).toEqual({
      monthly: plan(5, 'Premium', 14.9),
      annual: undefined,
    });
    expect(plansByCycle([annual])).toEqual({ monthly: undefined, annual });
    expect(plansByCycle([])).toEqual({ monthly: undefined, annual: undefined });
  });

  it('calcula o desconto do anual sobre 12 mensalidades (149,90 x 178,80 = 16%)', () => {
    expect(annualDiscountPercent(monthly, annual)).toBe(16);
    expect(annualDiscountPercent(monthly, plan(6, 'Anual', 200))).toBe(0);
  });
});

describe('premiumAccessUntil', () => {
  it('usa a data agendada do cancelamento e, sem ela, o fim ou a próxima cobrança', () => {
    const premium = subscription({
      planId: 1,
      status: SubscriptionStatus.Active,
      cancelAtPeriodEnd: true,
      nextBillingDate: '2026-12-03T00:00:00Z',
    });
    expect(premiumAccessUntil(premium)).toBe('2026-12-03T00:00:00Z');
    expect(
      premiumAccessUntil({ ...premium, cancellationScheduledFor: '2026-12-04T00:00:00Z' }),
    ).toBe('2026-12-04T00:00:00Z');
    expect(premiumAccessUntil({ ...premium, nextBillingDate: null })).toBeNull();
  });
});

describe('chamadas da API', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    process.env.EXPO_PUBLIC_API_URL = 'http://api.test';
    fetchMock.mockReset();
    globalThis.fetch = fetchMock;
  });

  function respond(status: number, json?: unknown) {
    return {
      ok: status < 400,
      status,
      json: async () => json,
      text: async () => (json === undefined ? '' : JSON.stringify(json)),
    };
  }

  it('cancelSubscription agenda o cancelamento com DELETE /api/subscription/cancel', async () => {
    fetchMock.mockResolvedValue(respond(200));

    await cancelSubscription('token');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/api/subscription/cancel');
    expect(init.method).toBe('DELETE');
    expect(init.headers.Authorization).toBe('Bearer token');
  });

  it('cancelSubscription repassa a recusa da API (cancelamento já agendado)', async () => {
    fetchMock.mockResolvedValue(
      respond(400, { errorMessages: ['Assinatura já possui cancelamento agendado.'] }),
    );

    await expect(cancelSubscription('token')).rejects.toMatchObject({
      message: 'Assinatura já possui cancelamento agendado.',
      status: 400,
    });
  });

  it('reactivateSubscription usa POST /api/subscription/reactivate sem corpo', async () => {
    fetchMock.mockResolvedValue(respond(204));

    await reactivateSubscription('token');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/api/subscription/reactivate');
    expect(init.method).toBe('POST');
    expect(init.body).toBeUndefined();
  });

  it('createCheckout envia o planId e devolve o link de pagamento', async () => {
    fetchMock.mockResolvedValue(respond(200, { checkoutUrl: 'https://pagar.me/link' }));

    await expect(createCheckout('token', 7)).resolves.toBe('https://pagar.me/link');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/api/checkout');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"planId":7}');
    expect(init.headers.Authorization).toBe('Bearer token');
  });

  it('createCheckout repassa a mensagem da API (ex.: assinatura já ativa)', async () => {
    fetchMock.mockResolvedValue(
      respond(400, { errorMessages: ['Você já possui uma assinatura ativa.'] }),
    );

    await expect(createCheckout('token', 7)).rejects.toMatchObject({
      message: 'Você já possui uma assinatura ativa.',
      status: 400,
    });
  });

  it('updateProfile envia só nome e e-mail', async () => {
    fetchMock.mockResolvedValue(respond(204));

    await updateProfile('token', { name: 'Nilton', email: 'n@micash.com.br' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/api/user/update');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toEqual({ name: 'Nilton', email: 'n@micash.com.br' });
  });

  it('changePassword envia senha atual e nova (sem a confirmação)', async () => {
    fetchMock.mockResolvedValue(respond(204));

    await changePassword('token', { password: 'Atual123!', newPassword: 'Nova123!' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/api/user/change-password');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toEqual({ password: 'Atual123!', newPassword: 'Nova123!' });
  });
});

describe('limites do plano', () => {
  const free: PlanLimits = {
    plan: 'Free',
    isPremium: false,
    maxFinancialGoalsPerMonth: 3,
    maxSavingsGoals: 1,
    historyMonths: 3,
    fullInsights: false,
    goalWarningAlerts: false,
    canCopyFinancialGoals: false,
    monthForecast: false,
    chat: {
      period: 'month',
      limit: 5,
      used: 3,
      remaining: 2,
      resetsAt: '2026-12-01T03:00:00Z',
      perMinute: null,
    },
  };
  const premium: PlanLimits = {
    ...free,
    plan: 'Premium',
    isPremium: true,
    maxFinancialGoalsPerMonth: null,
    maxSavingsGoals: null,
    historyMonths: null,
    chat: { ...free.chat, period: 'day', limit: 30, used: 18, remaining: 12, perMinute: 5 },
  };
  const now = new Date(2026, 10, 10); // novembro de 2026

  it('no Free bloqueia só os meses antes dos 3 anteriores; futuros ficam liberados', () => {
    expect(isHistoryLocked(free, { year: 2026, month: 8 }, now)).toBe(false);
    expect(isHistoryLocked(free, { year: 2026, month: 7 }, now)).toBe(true);
    expect(isHistoryLocked(free, { year: 2025, month: 12 }, now)).toBe(true);
    expect(isHistoryLocked(free, { year: 2027, month: 3 }, now)).toBe(false);
  });

  it('no Premium, ou sem limites carregados, nenhum mês é bloqueado', () => {
    expect(isHistoryLocked(premium, { year: 2020, month: 1 }, now)).toBe(false);
    expect(isHistoryLocked(undefined, { year: 2020, month: 1 }, now)).toBe(false);
  });

  it('reachedLimit compara com o máximo do plano (null = sem limite)', () => {
    expect(reachedLimit(3, 3)).toBe(true);
    expect(reachedLimit(3, 2)).toBe(false);
    expect(reachedLimit(null, 99)).toBe(false);
    expect(reachedLimit(undefined, 99)).toBe(false);
  });

  it('chatMonthExhaustedMessage usa o limite informado pela API', () => {
    expect(chatMonthExhaustedMessage(free.chat)).toBe(
      'Você usou suas 5 mensagens do mês. Assine o Premium para continuar conversando.',
    );
    expect(chatMonthExhaustedMessage({ ...free.chat, limit: 10 })).toContain('suas 10 mensagens');
  });

  it('chatUsageLabel mostra o restante do mês (Free) ou do dia (Premium)', () => {
    expect(chatUsageLabel(free.chat)).toBe('2 de 5 mensagens restantes este mês');
    expect(chatUsageLabel(premium.chat)).toBe('12 de 30 restantes hoje');
  });

  it('getPlanLimits consulta GET /api/subscription/limits com o token', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => free,
      text: async () => JSON.stringify(free),
    });
    process.env.EXPO_PUBLIC_API_URL = 'http://api.test';
    globalThis.fetch = fetchMock;

    await expect(getPlanLimits('t')).resolves.toEqual(free);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/api/subscription/limits');
    expect(init.headers.Authorization).toBe('Bearer t');
  });
});
