// No Android, `fontWeight` não seleciona variações de fontes customizadas,
// então cada peso da Inter é referenciado pelo próprio `fontFamily`.
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
} as const;
