// Benefícios exibidos na tela do plano. A API não informa benefícios; os textos espelham os limites
// aplicados pelo backend (GET /api/subscription/limits).
//
// O app não vende assinaturas (a contratação é feita no site): nenhum texto aqui convida a assinar,
// mostra preço de venda ou aponta para um pagamento. Os avisos só explicam o que é do Premium.

export const FREE_BENEFITS = [
  'Lançamentos ilimitados',
  'Dashboard do mês',
  'Até 3 metas por mês',
  '1 caixinha',
  '5 perguntas à MI por mês',
];

export const PREMIUM_BENEFITS = [
  'Assistente MI (30 por dia)',
  'Insights completos',
  'Previsão do fim do mês',
  'Histórico completo',
  'Metas e caixinhas ilimitadas',
];

/** Aviso padrão quando o app bloqueia antes de chamar a API (a API manda o próprio texto). */
export const PREMIUM_OFFERS = {
  history: 'O histórico completo faz parte do plano Premium.',
  copyGoals: 'Copiar metas para outro mês é um recurso do plano Premium.',
  insights: 'Todos os insights e a análise da MI fazem parte do plano Premium.',
  goals:
    'O plano gratuito permite até 3 metas de gasto por mês. Metas ilimitadas fazem parte do plano Premium.',
  savings:
    'O plano gratuito permite 1 caixinha. Caixinhas ilimitadas fazem parte do plano Premium.',
} as const;
