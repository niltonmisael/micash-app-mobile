const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier/flat');

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: ['dist/*', '.expo/*', 'node_modules/*'],
  },
  {
    rules: {
      // Os ícones são importados por subcaminho (ver src/types/tabler-icons.d.ts), que o
      // resolvedor do ESLint não reconhece; o Metro e o TypeScript resolvem normalmente.
      'import/no-unresolved': ['error', { ignore: ['^@tabler/icons-react-native/'] }],
    },
  },
]);
