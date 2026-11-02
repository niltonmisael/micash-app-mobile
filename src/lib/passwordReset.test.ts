import { ApiError } from '@/lib/api';

import {
  passwordResetErrorMessage,
  requestPasswordReset,
  resetPassword,
  verifyPasswordResetCode,
} from './passwordReset';

describe('passwordReset', () => {
  const fetchMock = jest.fn();

  const respond = (status: number, body?: unknown) => ({
    ok: status < 400,
    status,
    json: async () => body ?? null,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  });

  const call = (index = 0) => {
    const [url, init] = fetchMock.mock.calls[index];
    return { url, init, body: init.body ? JSON.parse(init.body) : undefined };
  };

  beforeEach(() => {
    process.env.EXPO_PUBLIC_API_URL = 'http://api.test';
    fetchMock.mockReset();
    globalThis.fetch = fetchMock;
  });

  it('pede o código com o e-mail sem espaços, sem token, e devolve as regras do fluxo', async () => {
    fetchMock.mockResolvedValue(
      respond(202, { resendAvailableInSeconds: 60, codeExpiresInMinutes: 15, codeLength: 6 }),
    );

    await expect(requestPasswordReset('  ana@micash.com.br ')).resolves.toEqual({
      resendAvailableInSeconds: 60,
      codeExpiresInMinutes: 15,
      codeLength: 6,
    });

    const { url, init, body } = call();
    expect(url).toBe('http://api.test/forgot-password');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBeUndefined();
    expect(body).toEqual({ email: 'ana@micash.com.br' });
  });

  it('troca o código pela autorização de redefinição', async () => {
    fetchMock.mockResolvedValue(respond(200, { resetToken: 'reset-abc', expiresInMinutes: 10 }));

    await expect(verifyPasswordResetCode('ana@micash.com.br', '004213')).resolves.toEqual({
      resetToken: 'reset-abc',
      expiresInMinutes: 10,
    });
    expect(call().url).toBe('http://api.test/verify-password-reset-code');
    expect(call().body).toEqual({ email: 'ana@micash.com.br', code: '004213' });
  });

  it('repassa a mensagem genérica de código inválido ou expirado', async () => {
    const message = 'Código inválido ou expirado. Confira o código ou solicite um novo.';
    fetchMock.mockResolvedValue(respond(400, { errorMessages: [message] }));

    const error = await verifyPasswordResetCode('ana@micash.com.br', '000000').catch((e) => e);

    expect(error).toMatchObject({ status: 400 });
    expect(passwordResetErrorMessage(error)).toBe(message);
  });

  it('redefine a senha com a autorização (204, sem sessão)', async () => {
    fetchMock.mockResolvedValue(respond(204));

    await resetPassword('reset-abc', 'NovaSenha1!');

    expect(call().url).toBe('http://api.test/reset-password');
    expect(call().body).toEqual({ resetToken: 'reset-abc', newPassword: 'NovaSenha1!' });
    expect(call().init.headers.Authorization).toBeUndefined();
  });

  describe('passwordResetErrorMessage', () => {
    it('mostra as mensagens da API para validação e limite de tentativas', () => {
      expect(passwordResetErrorMessage(new ApiError('Autorização expirou.', 400))).toBe(
        'Autorização expirou.',
      );
      expect(passwordResetErrorMessage(new ApiError('Muitas tentativas.', 429))).toBe(
        'Muitas tentativas.',
      );
      expect(passwordResetErrorMessage(new ApiError('Sem conexão.'))).toBe('Sem conexão.');
    });

    it('não expõe detalhes de erros inesperados', () => {
      expect(passwordResetErrorMessage(new ApiError('NullReferenceException at ...', 500))).toBe(
        'Ocorreu um erro inesperado. Tente novamente.',
      );
      expect(passwordResetErrorMessage(new Error('boom'))).toBe(
        'Ocorreu um erro inesperado. Tente novamente.',
      );
    });
  });
});
