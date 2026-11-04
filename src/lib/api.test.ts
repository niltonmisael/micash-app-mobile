import { ApiError, apiPost, isChatRateLimitError, isPlanLimitError } from './api';

const fetchMock = jest.fn();

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  };
}

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_URL = 'http://api.test/';
  fetchMock.mockReset();
  globalThis.fetch = fetchMock;
});

describe('apiPost', () => {
  it('envia JSON para a URL base e devolve o corpo da resposta', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { name: 'Nilton' }));

    await expect(apiPost('/login', { email: 'a@b.com' })).resolves.toEqual({ name: 'Nilton' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/login');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"email":"a@b.com"}');
    expect(init.headers['Accept-Language']).toBe('pt-BR');
  });

  it('usa a primeira mensagem de errorMessages quando a API recusa', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(401, { errorMessages: ['E-mail ou senha inválidos.'] }),
    );

    await expect(apiPost('/login', {})).rejects.toEqual(
      new ApiError('E-mail ou senha inválidos.', 401),
    );
  });

  it('junta todas as mensagens quando a API devolve mais de uma', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(400, { errorMessages: ['Nome Vázio', 'Email já cadastrado'] }),
    );

    await expect(apiPost('/api/user/register', {})).rejects.toMatchObject({
      message: 'Nome Vázio\nEmail já cadastrado',
      status: 400,
    });
  });

  it('usa uma mensagem genérica quando o erro não tem corpo JSON', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => Promise.reject() });

    await expect(apiPost('/login', {})).rejects.toMatchObject({
      message: 'Ocorreu um erro inesperado. Tente novamente.',
      status: 500,
    });
  });

  it('informa falha de conexão quando o fetch falha', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));

    await expect(apiPost('/login', {})).rejects.toMatchObject({
      message: 'Não foi possível conectar ao servidor. Verifique sua conexão.',
    });
  });

  it('falha sem chamar a rede quando a URL não está configurada', async () => {
    delete process.env.EXPO_PUBLIC_API_URL;

    await expect(apiPost('/login', {})).rejects.toMatchObject({
      message: 'URL da API não configurada (EXPO_PUBLIC_API_URL).',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('erros de limite do plano', () => {
  it('lê errorCode e retryAt do corpo do erro', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(403, {
        errorMessages: ['O plano gratuito permite até 3 metas de gasto por mês.'],
        errorCode: 'PLAN_LIMIT_REACHED',
        retryAt: '2026-12-01T03:00:00Z',
      }),
    );

    const error = await apiPost('/api/financial-goal', {}).catch((err: unknown) => err);

    expect(error).toMatchObject({
      message: 'O plano gratuito permite até 3 metas de gasto por mês.',
      status: 403,
      code: 'PLAN_LIMIT_REACHED',
      retryAt: '2026-12-01T03:00:00Z',
    });
    expect(isPlanLimitError(error)).toBe(true);
  });

  it('trata o 403 sem código (bloqueio antigo de assinatura) como limite do plano', () => {
    expect(isPlanLimitError(new ApiError('Sua assinatura não está ativa.', 403))).toBe(true);
  });

  it('não confunde outros erros com limite do plano', () => {
    expect(isPlanLimitError(new ApiError('x', 403, 'OUTRO_CODIGO'))).toBe(false);
    expect(isPlanLimitError(new ApiError('x', 400))).toBe(false);
    expect(isPlanLimitError(new Error('x'))).toBe(false);
  });

  it('identifica o limite de mensagens do chat no Premium (429 CHAT_RATE_LIMIT)', () => {
    expect(isChatRateLimitError(new ApiError('x', 429, 'CHAT_RATE_LIMIT'))).toBe(true);
    // 429 sem código vem da IA (Gemini), não do limite do plano.
    expect(isChatRateLimitError(new ApiError('x', 429))).toBe(false);
  });
});
