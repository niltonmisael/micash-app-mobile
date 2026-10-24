import { ApiError, apiPost } from './api';

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
