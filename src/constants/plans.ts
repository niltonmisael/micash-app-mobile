// Benefícios exibidos na tela de assinatura. A API não informa benefícios (só nome e preço do
// plano); os textos espelham os limites aplicados pelo backend (GET /api/subscription/limits).

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

/** Oferta padrão quando o app bloqueia antes de chamar a API (a API manda o próprio texto). */
export const PREMIUM_OFFERS = {
  history: 'Veja todo o seu histórico com o Premium.',
  copyGoals: 'Copie suas metas para outro mês com o Premium.',
  insights: 'Veja todos os insights e a análise da MI com o Premium.',
  goals:
    'O plano gratuito permite até 3 metas de gasto por mês. Assine o Premium para ter metas ilimitadas.',
  savings: 'O plano gratuito permite 1 caixinha. Assine o Premium para ter caixinhas ilimitadas.',
} as const;
