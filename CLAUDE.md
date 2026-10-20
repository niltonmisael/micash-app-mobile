# CLAUDE.md — MiCash Mobile

Instruções permanentes para o Claude Code neste repositório. Leia este arquivo antes de cada tarefa.

## Projeto

- **Nome:** MiCash Mobile (nome no Expo: `MiCash`, slug `micash`, scheme `micash`).
- **Identificador do app:** `br.com.micash.app` (`ios.bundleIdentifier` e `android.package`), derivado do domínio `micash.com.br`. Não altere: depois da publicação nas lojas ele é permanente.
- **Plataforma:** aplicativo mobile em React Native.
- **Linguagem:** TypeScript, com `strict: true`.
- **Framework:** Expo, gerenciado (sem pastas `ios/` e `android/`; elas são geradas por prebuild e ignoradas no Git).
- **Navegação:** Expo Router (entrada `expo-router/entry` no `package.json`, plugin `expo-router` no `app.json`), com rotas tipadas (`experiments.typedRoutes`). Os tipos (`.expo/types`, `expo-env.d.ts`) são gerados pelo `expo start` e ignorados no Git.
- **Execução:** `expo-dev-client` instalado; `npm start` abre em development build (Expo Go só com `npx expo start --go`).
- **EAS:** projeto vinculado via `app.json` (`extra.eas.projectId` e `owner`). O `eas.json` define os perfis de build `development` (development build com `expo-dev-client`, distribuição interna), `preview` (distribuição interna) e `production` (versão gerenciada remotamente, com `autoIncrement`).
- **Backend:** existe um backend em .NET/C#, mas a integração é uma etapa futura. Não há endpoints, contratos, autenticação ou infraestrutura definidos neste repositório. Não invente nenhum desses detalhes.

### Versões instaladas

| Pacote       | Versão |
| ------------ | ------ |
| Expo SDK     | 57     |
| React Native | 0.86.3 |
| React        | 19.2.3 |
| Expo Router  | 57     |
| TypeScript   | 6.0    |

Confirme sempre no `package.json` / `node_modules` antes de usar uma API; essa tabela pode ficar desatualizada.

## Estrutura

| Pasta            | Finalidade                                                               |
| ---------------- | ------------------------------------------------------------------------ |
| `app/`           | Rotas do Expo Router. `_layout.tsx` é a raiz (um `Stack` sem cabeçalho). |
| `src/components` | Componentes reutilizáveis.                                               |
| `src/constants`  | Constantes da aplicação.                                                 |
| `src/hooks`      | Hooks customizados.                                                      |
| `src/lib`        | Configuração e wrappers de bibliotecas de terceiros.                     |
| `src/types`      | Tipos TypeScript compartilhados.                                         |
| `src/utils`      | Funções utilitárias puras.                                               |
| `assets/`        | Imagens (`images/`) e fontes (`fonts/`).                                 |
| `docs/`          | Documentação técnica (`architecture.md`).                                |

Convenções:

- Rotas ficam em `app/`; todo código que não é rota fica em `src/`.
- Alias de import: `@/*` → `src/*` (ex.: `import { x } from '@/utils/x'`).
- Testes ficam ao lado do código testado, com sufixo `.test.ts` / `.test.tsx`.
- Os `.gitkeep` só mantêm pastas vazias no Git; remova o da pasta quando ela receber conteúdo.

## Comandos

| Comando                | Uso                                        |
| ---------------------- | ------------------------------------------ |
| `npm start`            | Servidor de desenvolvimento Expo           |
| `npm run android`      | Abre no Android                            |
| `npm run ios`          | Abre no iOS                                |
| `npm run web`          | Versão web (`react-native-web`)            |
| `npm run typecheck`    | `tsc --noEmit`                             |
| `npm run lint`         | ESLint (`eslint-config-expo` + `prettier`) |
| `npm run lint:fix`     | ESLint com correção automática             |
| `npm run format`       | Prettier, escrevendo os arquivos           |
| `npm run format:check` | Prettier, apenas verificando               |
| `npm test`             | Jest (`jest-expo`, `--passWithNoTests`)    |
| `npm run test:watch`   | Jest em modo observação                    |
| `npm run doctor`       | `npx expo-doctor` (sem instalação local)   |

Observações verificadas:

- Ainda não há nenhum teste; `npm test` passa sem executar nada.
- O Prettier ignora `assets/` e `package-lock.json` (`.prettierignore`).
- Node: versão de referência em `.nvmrc` (24); `engines` exige `>=20`.
- CI (`.github/workflows/ci.yml`) roda `typecheck`, `lint`, `format:check` e `test` em push na `main` e em PRs. Mantenha esses comandos passando.
- `allowScripts` no `package.json` aprova scripts de instalação por versão; ao atualizar um pacote listado, o npm volta a pedir aprovação.

## Regras de desenvolvimento

### Código e arquitetura

- Use TypeScript e tipagem explícita onde ela agrega clareza (props, retornos públicos, tipos compartilhados em `src/types`).
- Prefira componentes pequenos, reutilizáveis e com uma responsabilidade clara.
- Siga a estrutura de pastas acima; não crie novas camadas (ex.: `services/`, `repositories/`, `store/`) sem necessidade concreta e aprovação.
- Evite duplicação e abstrações prematuras.
- Antes de criar um arquivo ou componente, procure se já existe algo equivalente.
- Não adicione dependências sem justificar a necessidade na resposta.

### React Native e Expo

- Use apenas APIs compatíveis com as versões instaladas do Expo e do React Native.
- Instale bibliotecas do ecossistema Expo com `npx expo install <pacote>`, para receber a versão compatível com o SDK.
- Respeite a configuração atual do Expo Router (rotas baseadas em arquivos em `app/`).
- Não recrie o projeto com `create-expo-app` nem substitua configurações existentes sem necessidade comprovada.
- Não atualize o SDK do Expo nem versões de dependências sem uma tarefa que peça isso.
- Preserve `extra.eas.projectId` e `owner` no `app.json`.

### Qualidade

- Siga as configurações existentes de TypeScript (`strict`), ESLint e Prettier (`singleQuote`, `trailingComma: all`, `printWidth: 100`).
- Depois de alterar código, rode no mínimo `npm run typecheck`, `npm run lint` e `npm run format:check`; rode `npm test` quando houver testes relevantes.
- Nunca declare uma verificação como concluída sem ter executado o comando correspondente.
- Corrija os problemas introduzidos pela sua própria alteração antes de concluir.
- Se uma validação não puder ser executada, diga isso e explique o motivo.

### Segurança

- Nunca coloque senhas, tokens, chaves privadas ou credenciais no código.
- Não registre informações sensíveis em logs.
- Variáveis `EXPO_PUBLIC_*` são embutidas no bundle do app e **não são secretas**.
- Arquivos `.env` e `.env.*` são ignorados pelo Git (exceto `.env.example`); não os versione.
- Não crie configurações fictícias de autenticação ou de integração com o backend.
- Não execute comandos destrutivos (ex.: `git reset --hard`, remoção de pastas, `expo prebuild --clean`) sem necessidade e autorização explícita.

## Limites do estágio atual

O projeto está na fase de infraestrutura inicial. Até que uma tarefa autorize explicitamente:

- Não implemente autenticação.
- Não crie integrações com APIs nem cliente HTTP.
- Não desenvolva services ou repositórios de acesso a dados.
- Não implemente regras de negócio.
- Não configure bancos de dados ou estado global.
- Não adicione bibliotecas antecipando funcionalidades futuras.
- Não modifique a arquitetura estabelecida sem justificativa.

Quando uma tarefa pedir uma funcionalidade, trabalhe somente no escopo pedido.

## Fluxo de trabalho

Em cada tarefa:

1. Inspecione os arquivos relevantes antes de alterar código.
2. Em mudanças significativas, explique brevemente o que pretende modificar.
3. Preserve os padrões e as configurações existentes.
4. Implemente somente o escopo solicitado.
5. Execute as verificações compatíveis com a alteração.
6. Informe os arquivos criados, modificados e removidos.
7. Apresente os comandos executados e os resultados das validações.
8. Informe pendências, limitações e decisões que precisem de aprovação.

Uma tarefa não está concluída só porque os arquivos foram escritos.

## Documentação

- Atualize o `README.md` quando uma tarefa pedir, mantendo-o fiel ao funcionamento real do projeto.
- Use `docs/` apenas para documentação técnica realmente necessária.
- Não copie o conteúdo deste arquivo para outros documentos; referencie-o.
