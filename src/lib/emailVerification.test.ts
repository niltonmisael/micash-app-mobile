import { ApiError, isEmailNotVerifiedError, isPlanLimitError } from '@/lib/api';
import { getSession, isSessionVerified, markSessionUnverified } from '@/lib/auth';

import {
  changeVerificationEmail,
  confirmEmailChange,
  emailCodeErrorMessage,
  requestEmailChange,
  resendAvailableAt,
  resendEmailVerificationCode,
  verifyEmail,
} from './emailVerification';

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

jest.mock('expo-notifications', () => ({}));
jest.mock('expo-device', () => ({}));
jest.mock('expo-application', () => ({}));

const codeSent = {
  email: 'ana@micash.com.br',
  resendAvailableInSeconds: 60,
  codeExpiresInMinutes: 15,
  codeLength: 6,
};

describe('verificação e troca de e-mail', () => {
  const fetchMock = jest.fn();

  function respond(status: number, json?: unknown) {
    return {
      ok: status < 400,
      status,
      json: async () => json,
      text: async () => (json === undefined ? '' : JSON.stringify(json)),
    };
  }

  beforeEach(() => {
    process.env.EXPO_PUBLIC_API_URL = 'http://api.test';
    fetchMock.mockReset();
    globalThis.fetch = fetchMock;
    mockStore.clear();
    mockStore.set(
      'micash.session',
      JSON.stringify({ name: 'Ana', token: 'old', refreshToken: 'r-old', emailVerified: false }),
    );
  });

  it('verifyEmail envia o código e troca a sessão pelos tokens novos, já verificada', async () => {
    fetchMock.mockResolvedValue(
      respond(200, {
        name: 'Ana',
        token: 'new',
        refreshToken: 'r-new',
        emailVerified: true,
        showPremiumOffer: true,
      }),
    );

    const session = await verifyEmail('old', '123456');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/verify-email');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ code: '123456' });
    expect(init.headers.Authorization).toBe('Bearer old');
    // A oferta do Premium é só para a web: não vai para a sessão do app.
    expect(session).toEqual({
      name: 'Ana',
      token: 'new',
      refreshToken: 'r-new',
      emailVerified: true,
    });
    expect(await getSession()).toEqual(session);
  });

  it('verifyEmail repassa o código inválido (400) com a mensagem da API', async () => {
    fetchMock.mockResolvedValue(
      respond(400, {
        errorMessages: ['Código inválido ou expirado. Confira o código ou solicite um novo.'],
      }),
    );

    await expect(verifyEmail('old', '000000')).rejects.toMatchObject({ status: 400 });
    expect((await getSession())?.token).toBe('old');
  });

  it('resendEmailVerificationCode usa POST sem corpo e devolve as regras do código', async () => {
    fetchMock.mockResolvedValue(respond(202, codeSent));

    await expect(resendEmailVerificationCode('old')).resolves.toEqual(codeSent);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/resend-email-verification-code');
    expect(init.method).toBe('POST');
    expect(init.body).toBeUndefined();
  });

  it('changeVerificationEmail corrige o e-mail com PUT e lê o corpo da resposta', async () => {
    fetchMock.mockResolvedValue(respond(202, { ...codeSent, email: 'ana.certo@micash.com.br' }));

    const response = await changeVerificationEmail('old', '  ana.certo@micash.com.br ');

    expect(response.email).toBe('ana.certo@micash.com.br');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/email-verification/email');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toEqual({ email: 'ana.certo@micash.com.br' });
  });

  it('requestEmailChange envia o novo e-mail e a senha atual', async () => {
    fetchMock.mockResolvedValue(respond(202, { ...codeSent, email: 'nova@micash.com.br' }));

    await requestEmailChange('token', ' nova@micash.com.br ', 'Senha123!');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/api/user/email-change');
    expect(JSON.parse(init.body)).toEqual({
      newEmail: 'nova@micash.com.br',
      password: 'Senha123!',
    });
  });

  it('confirmEmailChange envia o código e devolve o perfil atualizado', async () => {
    const profile = { name: 'Ana', email: 'nova@micash.com.br', emailVerified: true };
    fetchMock.mockResolvedValue(respond(200, profile));

    await expect(confirmEmailChange('token', '654321')).resolves.toEqual(profile);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/api/user/email-change/confirm');
    expect(JSON.parse(init.body)).toEqual({ code: '654321' });
  });

  it('o 429 do reenvio traz retryAt para a contagem', async () => {
    fetchMock.mockResolvedValue(
      respond(429, {
        errorMessages: ['Aguarde 40 segundos para solicitar um novo código.'],
        retryAt: '2026-11-04T12:01:00Z',
      }),
    );

    const error = await resendEmailVerificationCode('old').catch((err: unknown) => err);

    expect(error).toBeInstanceOf(ApiError);
    expect(emailCodeErrorMessage(error)).toBe('Aguarde 40 segundos para solicitar um novo código.');
    expect(resendAvailableAt({ retryAt: (error as ApiError).retryAt })).toBe(
      Date.parse('2026-11-04T12:01:00Z'),
    );
  });
});

describe('regras auxiliares', () => {
  it('resendAvailableAt soma o intervalo da API ou usa o padrão sem retryAt', () => {
    expect(resendAvailableAt(codeSent, 1_000)).toBe(61_000);
    expect(resendAvailableAt({}, 1_000)).toBe(61_000);
  });

  it('emailCodeErrorMessage só repassa mensagens escritas para o usuário', () => {
    expect(emailCodeErrorMessage(new ApiError('Código inválido.', 400))).toBe('Código inválido.');
    expect(emailCodeErrorMessage(new ApiError('Detalhe interno', 500))).toBe(
      'Ocorreu um erro inesperado. Tente novamente.',
    );
    expect(emailCodeErrorMessage(new Error('x'))).toBe(
      'Ocorreu um erro inesperado. Tente novamente.',
    );
  });

  it('EMAIL_NOT_VERIFIED não é confundido com limite do plano', () => {
    const blocked = new ApiError('Confirme seu e-mail.', 403, 'EMAIL_NOT_VERIFIED');
    expect(isEmailNotVerifiedError(blocked)).toBe(true);
    expect(isPlanLimitError(blocked)).toBe(false);
    expect(isEmailNotVerifiedError(new ApiError('Limite', 403, 'PLAN_LIMIT_REACHED'))).toBe(false);
  });

  it('sessões antigas, sem o campo, contam como verificadas', () => {
    expect(isSessionVerified({ name: 'A', token: 't', refreshToken: 'r' })).toBe(true);
    expect(
      isSessionVerified({ name: 'A', token: 't', refreshToken: 'r', emailVerified: false }),
    ).toBe(false);
  });

  it('markSessionUnverified marca a sessão salva', async () => {
    mockStore.set('micash.session', JSON.stringify({ name: 'A', token: 't', refreshToken: 'r' }));

    await markSessionUnverified();

    expect((await getSession())?.emailVerified).toBe(false);
  });
});
