// O pacote só publica tipos para o índice principal, que carrega todos os ícones
// (~5 MB no bundle). Importar cada ícone pelo subcaminho mantém só os usados.
// Uso: import IconMail from '@tabler/icons-react-native/IconMail';
declare module '@tabler/icons-react-native/*' {
  import type { Icon } from '@tabler/icons-react-native';

  const icon: Icon;
  export default icon;
}
