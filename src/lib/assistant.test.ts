import { ApiError } from '@/lib/api';

import {
  chatErrorMessage,
  getChatHistory,
  sendChatMessage,
  startNewConversation,
  toChatMessages,
} from './assistant';

describe('assistant', () => {
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

  describe('toChatMessages', () => {
    it('mantém a ordem da API e descarta mensagens "system"', () => {
      expect(
        toChatMessages({
          conversationId: 3,
          hasMore: true,
          messages: [
            { id: 10, role: 'system', content: 'contexto', createdAt: '2026-11-02T10:00:00Z' },
            { id: 11, role: 'user', content: 'Oi', createdAt: '2026-11-02T10:00:01Z' },
            { id: 12, role: 'assistant', content: 'Olá!', createdAt: '2026-11-02T10:00:02Z' },
          ],
        }),
      ).toEqual({
        hasMore: true,
        messages: [
          { id: 11, role: 'user', text: 'Oi' },
          { id: 12, role: 'assistant', text: 'Olá!' },
        ],
      });
    });

    it('sem conversa ativa, devolve lista vazia', () => {
      expect(toChatMessages({ conversationId: null, messages: [], hasMore: false })).toEqual({
        messages: [],
        hasMore: false,
      });
      expect(toChatMessages(null)).toEqual({ messages: [], hasMore: false });
    });
  });

  it('busca o histórico mais recente e, com cursor, as mensagens anteriores', async () => {
    fetchMock.mockResolvedValue(respond(200, { conversationId: 1, messages: [], hasMore: false }));

    await getChatHistory('token-123');
    await getChatHistory('token-123', 41);

    expect(fetchMock.mock.calls[0][0]).toBe('http://api.test/api/chat/messages?limit=30');
    expect(fetchMock.mock.calls[1][0]).toBe('http://api.test/api/chat/messages?limit=30&before=41');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer token-123');
  });

  it('devolve a resposta da MI com os ids gravados', async () => {
    const answer = {
      id: 12,
      userMessageId: 11,
      conversationId: 3,
      message: 'Você gastou R$ 2.110,00.',
      createdAt: '2026-11-02T10:00:02Z',
    };
    fetchMock.mockResolvedValueOnce(respond(200, answer));

    await expect(sendChatMessage('t', 'Quanto gastei?')).resolves.toEqual(answer);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ message: 'Quanto gastei?' });
  });

  it('inicia uma nova conversa sem corpo na requisição', async () => {
    fetchMock.mockResolvedValueOnce(respond(201, { conversationId: 4 }));

    await startNewConversation('t');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/api/chat/conversations');
    expect(init.method).toBe('POST');
    expect(init.body).toBeUndefined();
  });

  describe('chatErrorMessage', () => {
    it('mostra a mensagem da API para validação, assinatura e conflito', () => {
      for (const status of [400, 403, 409]) {
        expect(chatErrorMessage(new ApiError('Mensagem da API', status))).toBe('Mensagem da API');
      }
    });

    it('troca erros da IA por mensagens amigáveis', () => {
      expect(chatErrorMessage(new ApiError('Too Many Requests', 429))).toBe(
        'A MI recebeu muitas perguntas agora. Aguarde um pouco e tente de novo.',
      );
      expect(chatErrorMessage(new ApiError('Bad Gateway', 502))).toBe(
        'A MI está indisponível no momento. Tente novamente em instantes.',
      );
    });
  });
});
