import { createCheckout, isFreePlan, subscriptionStatusLabel } from './subscription';
import { changePassword, updateProfile } from './user';
import { SubscriptionStatus } from '@/types/user';
import type { CurrentSubscription } from '@/types/user';

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
