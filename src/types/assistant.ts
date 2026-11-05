// Contratos de insights e do chat da MI (MiCash.API), ambos gerados com apoio do Gemini.

/** FinancialInsightType */
export enum InsightType {
  Warning = 0,
  Improvement = 1,
  Information = 2,
}

/** ResponseFinancialInsightJson — regra fixa calculada pela API (não é texto da IA). */
export type FinancialInsight = {
  type: InsightType;
  typeDescription: string;
  title: string;
  message: string;
};

/** ResponseArtificialInsightJson — análise em texto livre gerada pela IA. */
export type ArtificialInsight = {
  title: string;
  message: string;
};

/**
 * ResponseFinancialInsightsJson — GET /api/financial-insights?month&year.
 * `artificialInsight` é `null` quando a IA falhou (a API ainda devolve as regras fixas) e na
 * prévia do plano gratuito.
 */
export type FinancialInsightsResponse = {
  insights: FinancialInsight[];
  artificialInsight: ArtificialInsight | null;
  /** Plano gratuito: só o primeiro insight, sem a análise da MI. */
  isPreview: boolean;
  /** Insights escondidos pela prévia, incluindo a análise da MI; 0 no Premium. */
  lockedInsightsCount: number;
};

/** RequestChatMessageJson — POST /api/chat/message */
export type ChatMessageRequest = {
  message: string;
};

/** ResponseChatMessageJson — resposta da MI, com os ids gravados das duas mensagens. */
export type ChatMessageResponse = {
  /** Id da mensagem da MI. */
  id: number;
  /** Id dado à mensagem do usuário que acabou de ser enviada. */
  userMessageId: number;
  conversationId: number;
  message: string;
  /** DateTime em UTC. */
  createdAt: string;
};

/** ResponseChatHistoryMessageJson — a API também pode devolver "system", que o app não mostra. */
export type ChatHistoryMessage = {
  id: number;
  role: string;
  content: string;
  /** DateTime em UTC. */
  createdAt: string;
};

/**
 * ResponseChatHistoryJson — GET /api/chat/messages?before&limit. Mensagens da conversa ativa em
 * ordem cronológica; `hasMore` indica que há mais antigas (pedir com `before` = id da primeira).
 */
export type ChatHistoryResponse = {
  /** `null` quando ainda não há conversa ativa. */
  conversationId: number | null;
  messages: ChatHistoryMessage[];
  hasMore: boolean;
};

/** Mensagem exibida na tela do chat (vinda do histórico ou enviada nesta visita). */
export type ChatMessage = {
  /** Id da API; mensagens do usuário ainda sem resposta usam um id local negativo. */
  id: number;
  role: 'user' | 'assistant';
  text: string;
  /** Só mensagens do usuário: erro ao obter a resposta da MI (permite reenviar). */
  error?: string;
};

/** ResponseStartedConversationJson — POST /api/chat/conversations (201). */
export type StartedConversationResponse = {
  conversationId: number;
};
