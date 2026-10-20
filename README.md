# MiCash Mobile

Aplicativo mobile do MiCash, em React Native + TypeScript com Expo e Expo Router.

> Estado atual: apenas a infraestrutura inicial. Veja [docs/architecture.md](docs/architecture.md).

## Pré-requisitos

- Node.js 20 ou superior (versão de referência em `.nvmrc`: 24) e npm
- Emulador Android, simulador iOS ou aparelho físico
- [EAS CLI](https://docs.expo.dev/build/setup/) (`npm install -g eas-cli`) para gerar builds

## Instalação

```bash
npm install
```

## Executando no aparelho

O projeto usa `expo-dev-client`, então `npm start` abre o app em uma **development build**, não no Expo Go.

1. Gere e instale a development build (uma vez, ou quando mudar dependência nativa):

   ```bash
   eas build --profile development --platform android   # ou ios
   ```

2. Inicie o servidor com `npm start` e abra o app instalado.

Para usar o Expo Go temporariamente: `npx expo start --go`.

## Builds (EAS)

Perfis definidos em `eas.json`:

| Perfil        | Uso                                              |
| ------------- | ------------------------------------------------ |
| `development` | Development build com `expo-dev-client`          |
| `preview`     | Build de teste com distribuição interna          |
| `production`  | Build para as lojas (versão incrementada no EAS) |

Identificador do app (iOS e Android): `br.com.micash.app`.

## Comandos

| Comando                | Descrição                                  |
| ---------------------- | ------------------------------------------ |
| `npm start`            | Inicia o servidor de desenvolvimento Expo  |
| `npm run android`      | Inicia e abre no Android                   |
| `npm run ios`          | Inicia e abre no iOS                       |
| `npm run web`          | Inicia a versão web                        |
| `npm run typecheck`    | Verificação de tipos (TypeScript)          |
| `npm run lint`         | Análise estática (ESLint)                  |
| `npm run lint:fix`     | ESLint com correções automáticas           |
| `npm run format`       | Formata os arquivos (Prettier)             |
| `npm run format:check` | Verifica a formatação sem alterar          |
| `npm test`             | Executa os testes (Jest)                   |
| `npm run test:watch`   | Testes em modo observação                  |
| `npm run doctor`       | Diagnóstico de dependências e configuração |

## Integração contínua

O workflow `.github/workflows/ci.yml` roda `typecheck`, `lint`, `format:check` e `test` a cada push na `main` e em pull requests.

## Estrutura

Resumo em [docs/architecture.md](docs/architecture.md).
