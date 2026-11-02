import { ApiError, apiGet, apiPost } from '@/lib/api';
import type {
  ChatHistoryResponse,
  ChatMessage,
  ChatMessageRequest,
  ChatMessageResponse,
  FinancialInsightsResponse,
  StartedConversationResponse,
} from '@/types/assistant';
import type { MonthPeriod } from '@/utils/period';

/**
 * Insights e chat passam pelo Gemini no servidor, que espera até ~30 s pela IA
 * (com novas tentativas); o padrão de 15 s do app cortaria respostas válidas.
 */
export const AI_REQUEST_TIMEOUT_MS = 45000;

/** Limite do `ValidatorChatMessage` da API. */
export const CHAT_MESSAGE_MAX_LENGTH = 1000;

/** Mensagens por página do histórico (padrão da API; máximo 100). */
export const CHAT_HISTORY_PAGE_SIZE = 30;

/**
 * Mensagem para falhas do chat. Erros da IA (429/5xx) vêm com textos técnicos ou genéricos da
 * API; validação (400), falta de assinatura (403), conflito de conversa (409) e falhas de
 * conexão já têm mensagens próprias para o usuário.
 */
export function chatErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return 'A MI não conseguiu responder. Tente novamente.';
  if (error.status === undefined || [400, 403, 409].includes(error.status)) return error.message;
  if (error.status === 429) {
    return 'A MI recebeu muitas perguntas agora. Aguarde um pouco e tente de novo.';
  }
  return 'A MI está indisponível no momento. Tente novamente em instantes.';
}

/** GET /api/financialinsights?month&year — regras fixas + análise da IA (cache de 15 min). */
export async function getInsights(
  token: string,
  period: MonthPeriod,
): Promise<FinancialInsightsResponse> {
  const response = await apiGet<FinancialInsightsResponse>(
    '/api/financialinsights',
    token,
    { month: period.month, year: period.year },
    { timeoutMs: AI_REQUEST_TIMEOUT_MS },
  );
  return {
    insights: response?.insights ?? [],
    artificialInsight: response?.artificialInsight ?? null,
  };
}

/**
 * POST /api/chat/message — a API mantém uma conversa ativa por usuário (criada na primeira
 * mensagem) e usa as últimas mensagens como histórico; o contexto financeiro é o do mês atual.
 */
export async function sendChatMessage(
  token: string,
  message: string,
): Promise<ChatMessageResponse> {
  const body: ChatMessageRequest = { message };
  const response = await apiPost<ChatMessageResponse>('/api/chat/message', body, token, {
    timeoutMs: AI_REQUEST_TIMEOUT_MS,
  });
  if (!response?.message) throw new Error('A MI não devolveu uma resposta.');
  return response;
}

/** Histórico da conversa ativa, pronto para exibir (mensagens "system" ficam de fora). */
export type ChatHistoryPage = {
  messages: ChatMessage[];
  hasMore: boolean;
};

/** Converte o histórico da API nas mensagens da tela, em ordem cronológica. */
export function toChatMessages(history: ChatHistoryResponse | null): ChatHistoryPage {
  const messages = (history?.messages ?? []).flatMap((message): ChatMessage[] =>
    message.role === 'user' || message.role === 'assistant'
      ? [{ id: message.id, role: message.role, text: message.content }]
      : [],
  );
  return { messages, hasMore: history?.hasMore ?? false };
}

/**
 * GET /api/chat/messages — página mais recente da conversa ativa ou, com `before` (id da
 * mensagem mais antiga já exibida), a anterior a ela. Não exige assinatura.
 */
export async function getChatHistory(token: string, before?: number): Promise<ChatHistoryPage> {
  const params: Record<string, number> = { limit: CHAT_HISTORY_PAGE_SIZE };
  if (before !== undefined) params.before = before;
  const response = await apiGet<ChatHistoryResponse>('/api/chat/messages', token, params);
  return toChatMessages(response);
}

/**
 * POST /api/chat/conversations — encerra a conversa ativa (as mensagens ficam guardadas na API)
 * e abre uma vazia: a MI deixa de considerar o histórico anterior. Exige assinatura (403).
 */
export async function startNewConversation(token: string): Promise<void> {
  await apiPost<StartedConversationResponse>('/api/chat/conversations', undefined, token);
}
