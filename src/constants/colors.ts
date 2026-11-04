// Paleta do MiCash, conforme os protótipos em Docs/micash_*.html.
export const colors = {
  primary: '#F58A3C',
  primarySoft: '#F8B26A',
  beige: '#FDEBDA',
  beigeStroke: '#F8C79B',
  cream: '#FEF7EF',
  grayLight: '#F5F5F5',
  border: '#F0F0F0',
  grayMedium: '#B0AFAF',
  grayInactive: '#C9C9C9',
  incomeLabel: '#B27A45',
  textSecondary: '#8A8A8A',
  textPrimary: '#333333',
  income: '#4E9E6B',
  incomeSoft: '#E4F1E8',
  expense: '#C86A52',
  expenseSoft: '#F8E3DD',
  overlay: 'rgba(51, 51, 51, 0.45)',
  /** Véu sobre conteúdo bloqueado (teaser Premium). */
  veil: 'rgba(255, 255, 255, 0.7)',
  white: '#FFFFFF',
} as const;

/** Cores oferecidas para categorias (gravadas em hexadecimal no campo `color` da API). */
export const CATEGORY_COLORS: string[] = [
  colors.primary,
  colors.primarySoft,
  '#E8C14E',
  colors.income,
  '#5B8DEF',
  '#E06C8B',
  colors.grayMedium,
];
