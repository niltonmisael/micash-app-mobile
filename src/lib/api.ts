const REQUEST_TIMEOUT_MS = 15000;

const UNKNOWN_ERROR = 'Ocorreu um erro inesperado. Tente novamente.';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    /** `errorCode` da API (ex.: `PLAN_LIMIT_REACHED`, `CHAT_RATE_LIMIT`); ausente na maioria. */
    readonly code?: string,
    /** Quando a ação volta a ser permitida (DateTime em UTC); ausente quando não se aplica. */
    readonly retryAt?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** ResponseErrorJson da API. */
type ErrorBody = {
  errorMessages?: string[];
  errorCode?: string;
  retryAt?: string;
};

/**
 * Limite do plano gratuito ou recurso Premium: 403 com `PLAN_LIMIT_REACHED`, ou 403 sem código
 * (bloqueio antigo de assinatura). O app oferece o Premium em vez de mostrar um erro.
 */
export function isPlanLimitError(error: unknown): error is ApiError {
  return (
    error instanceof ApiError &&
    error.status === 403 &&
    (error.code === undefined || error.code === 'PLAN_LIMIT_REACHED')
  );
}

/**
 * E-mail ainda não confirmado (403 `EMAIL_NOT_VERIFIED`): a API bloqueia tudo, exceto as rotas da
 * verificação, até o código ser digitado. O app abre a tela `verify-email`.
 */
export function isEmailNotVerifiedError(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 403 && error.code === 'EMAIL_NOT_VERIFIED';
}

/** Limite de mensagens do chat no Premium (429 `CHAT_RATE_LIMIT`), liberado em `retryAt`. */
export function isChatRateLimitError(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 429 && error.code === 'CHAT_RATE_LIMIT';
}

type QueryParams = Record<string, string | number>;

/** Opções por requisição. Chamadas que passam pela IA (Gemini) precisam de um tempo maior. */
export type RequestOptions = {
  timeoutMs?: number;
};

function getBaseUrl(): string {
  const url = process.env.EXPO_PUBLIC_API_URL;
  if (!url) {
    throw new ApiError('URL da API não configurada (EXPO_PUBLIC_API_URL).');
  }
  return url.replace(/\/+$/, '');
}

async function request(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  options: { body?: unknown; token?: string; params?: QueryParams; timeoutMs?: number } = {},
): Promise<Response> {
  const query = options.params
    ? `?${new URLSearchParams(
        Object.entries(options.params).map(([key, value]) => [key, String(value)]),
      )}`
    : '';

  const headers: Record<string, string> = {
    Accept: 'application/json',
    // A API usa este cabeçalho para escolher o idioma das mensagens de erro.
    'Accept-Language': 'pt-BR',
  };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.token) headers.Authorization = `Bearer ${options.token}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${getBaseUrl()}${path}${query}`, {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('Não foi possível conectar ao servidor. Verifique sua conexão.');
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as ErrorBody | null;
    // A validação da API pode devolver várias mensagens (ex.: cadastro); mostra todas.
    const messages = data?.errorMessages?.filter(Boolean) ?? [];
    throw new ApiError(
      messages.length ? messages.join('\n') : UNKNOWN_ERROR,
      response.status,
      data?.errorCode || undefined,
      data?.retryAt || undefined,
    );
  }

  return response;
}

/** Corpo JSON da resposta, ou `null` quando não há conteúdo (204, ou 201 sem corpo). */
async function readJson<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  return text ? (JSON.parse(text) as T) : null;
}

/** POST; com `token`, a requisição é autenticada (Bearer). Sem corpo na resposta → `null`. */
export async function apiPost<TResponse>(
  path: string,
  body: unknown,
  token?: string,
  options?: RequestOptions,
): Promise<TResponse | null> {
  return readJson<TResponse>(await request('POST', path, { body, token, ...options }));
}

/** GET autenticado. Devolve `null` quando a API responde 204 (sem conteúdo). */
export async function apiGet<TResponse>(
  path: string,
  token: string,
  params?: QueryParams,
  options?: RequestOptions,
): Promise<TResponse | null> {
  return readJson<TResponse>(await request('GET', path, { token, params, ...options }));
}

/** PUT autenticado. A maioria das rotas responde 204 (→ `null`); algumas devolvem um corpo JSON. */
export async function apiPut<TResponse = void>(
  path: string,
  body: unknown,
  token: string,
): Promise<TResponse | null> {
  return readJson<TResponse>(await request('PUT', path, { body, token }));
}

/** DELETE autenticado (a API responde 204, sem corpo). Algumas rotas recebem um corpo JSON. */
export async function apiDelete(path: string, token: string, body?: unknown): Promise<void> {
  await request('DELETE', path, { token, body });
}
