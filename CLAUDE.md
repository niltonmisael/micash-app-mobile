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
- **Backend:** MiCash.API em .NET/C#, código em `C:\Workspace\Project MiCash\Repos\micash-api` (contratos em `src/MiCash.Communication`). JSON em camelCase; erros como `{ "errorMessages": string[] }`; idioma via `Accept-Language`. Consulte o código do backend antes de integrar um endpoint; não invente contratos. Não altere o backend a partir deste repositório.
- **Integração atual:** `POST /login` e `POST /api/user/register` (o cadastro devolve os mesmos tokens do login e já autentica; o e-mail de boas-vindas é enviado pela API); recuperação de senha anônima com `POST /forgot-password` (também reenvia; resposta igual exista ou não a conta), `POST /verify-password-reset-code` (código de 6 dígitos → `resetToken` de uso único) e `POST /reset-password` (`src/lib/passwordReset.ts`; não autentica, e sessões anteriores deixam de renovar). Nas duas trocas de senha a API recusa a nova igual à atual (`NEW_PASSWORD_SAME_AS_CURRENT`; no `reset-password` o `resetToken` continua válido). Alterar senha também revoga as sessões anteriores: o app refaz o `/login` com a nova senha para manter o usuário conectado; leitura autenticada de `GET /api/dashboard/monthly-summary`, `GET /api/dashboard/daily-summary` (gráfico "Resumo do mês": valores por dia e acumulados calculados pela API), `GET /api/dashboard/lastest-expenses` e `GET /api/income` (Dashboard e Transações), `GET /api/dashboard/month-forecast` (card "Previsão do mês" do Dashboard, `MonthForecastCard`; Premium: o 403 vira o card bloqueado, que abre `subscription`, e não um erro; com `isReliable` falso não mostra números) e `GET /api/dashboard/expenses-by-category` (Relatórios; `src/lib/reports.ts`); perfil e conta com `GET /api/user/profile`, `PUT /api/user/update`, `PUT /api/user/change-password` (`src/lib/user.ts`); assinatura com `GET /api/subscription/current`, `GET /api/plan`, `POST /api/checkout`, `DELETE /api/subscription/cancel` (agenda o cancelamento para o fim do período pago) e `POST /api/subscription/reactivate` (desfaz o agendamento) (`src/lib/subscription.ts`; o checkout só abre o link do Pagar.me — a ativação vem do webhook no backend; a API não informa o período do plano: `plansByCycle` separa mensal/anual pelo nome e, sem pista, pelo preço); limites do plano com `GET /api/subscription/limits` (`PlanProvider`/`usePlan` em `src/hooks/usePlan.tsx`, montado em `app/_layout.tsx`: carregado ao entrar na área autenticada, ao voltar o app ao primeiro plano, ao sair de `subscription` e após cada mensagem do chat; `null` = sem limite; só assinatura ativa é Premium). Limites do Free são oferta, não erro: 403 com `errorCode` `PLAN_LIMIT_REACHED` (ou 403 sem código) é detectado por `isPlanLimitError` (`src/lib/api.ts`, que também lê `errorCode`/`retryAt` no `ApiError`); `useAuthenticatedAction` abre a oferta (`PremiumOfferSheet`) e lança `PremiumOfferShownError`, e `useAuthenticatedQuery` devolve `locked` (mensagem da API) em vez de `error`. As telas tratam `HandledActionError` (base de `SessionEndedError` e `PremiumOfferShownError`) encerrando a ação. 429 `CHAT_RATE_LIMIT` (Premium) bloqueia o envio até `retryAt`. Datas UTC de limite aparecem no horário de Brasília (`formatBrasiliaTime`); os benefícios dos planos ficam em `src/constants/plans.ts`. O app não exporta relatórios (PDF/Excel ficam para uma futura aplicação web; a API não tem mais `api/Report`); `POST /logout` revoga o refresh token (`logout()` em `src/lib/auth.ts`); criação com `POST /api/income`, `POST /api/expense` e categorias de despesa (`GET /api/category/all`, `GET|PUT|DELETE /api/category/{id}`, `POST /api/category/create`; `src/lib/categories.ts`). limites de gasto por categoria e mês com `GET|POST /api/financial-goal`, `GET /api/financial-goal/progress`, `GET|PUT|DELETE /api/financial-goal/{id}` e `POST /api/financial-goal/copy` (`src/lib/goals.ts`; o Dashboard mostra os 2 mais usados); metas de economia com `GET|POST /api/savings-goal`, `GET|PUT|DELETE /api/savings-goal/{id}` e `POST /api/savings-goal/{id}/deposit|withdraw` (`src/lib/savings.ts`; guardado, falta, percentual e "por mês" vêm calculados da API, e o prazo é enviado como o último dia do mês escolhido); MI Assistente com `GET /api/financialinsights`, `POST /api/chat/message`, `GET /api/chat/messages` (histórico da conversa ativa, paginado por `before`) e `POST /api/chat/conversations` (nova conversa) (`src/lib/assistant.ts`; chamadas à IA usam `AI_REQUEST_TIMEOUT_MS`; no Free os insights vêm como prévia (`isPreview`, `lockedInsightsCount`) e o chat tem 5 mensagens por mês (403 `PLAN_LIMIT_REACHED`); no Premium, 30 por dia e 5 por minuto (429)). `DELETE` só inativa a categoria; categorias não têm tipo na API (são todas de despesa) e as de receita são o enum fixo `IncomeCategory`. Escrita autenticada via `useAuthenticatedAction` (`src/hooks`). URL base em `EXPO_PUBLIC_API_URL` (`.env`, ver `.env.example`); cliente em `src/lib/api.ts` (`apiPost`, `apiGet` com Bearer e 204 → `null`); sessão (`name`, `token`, `refreshToken`) salva com `expo-secure-store` em `src/lib/auth.ts`. Toda chamada autenticada passa por `withSession` (`src/lib/auth.ts`): no 401 renova a sessão com `POST /refresh` (anônimo; a API troca e apaga o refresh token usado, por isso há uma única troca por vez, compartilhada pelas requisições em paralelo) e repete uma vez; se a renovação for recusada (401/404), lança `SessionUnavailableError`. Telas autenticadas carregam dados com `useAuthenticatedQuery` e escrevem com `useAuthenticatedAction` (`src/hooks`), que nesse caso apagam a sessão e voltam ao Login. Nunca chame a API com `getSession().token` diretamente.
- **Notificações push:** `expo-notifications` + Expo Push Service (FCM V1/APNs por trás; sem Firebase SDK no app). `src/lib/notifications.ts` pede a permissão (uma vez) e obtém o Expo Push Token; `usePushNotifications` (`src/hooks`, montado em `app/(tabs)/_layout.tsx`) registra o aparelho e escuta as notificações, abrindo `data.url` (rota interna) ao tocar. O token é registrado na API com `POST /api/device/push-token` (`expoPushToken`, `platform`, `deviceId` do `expo-application` e `deviceName` = modelo) a cada entrada na área autenticada e guardado no SecureStore (`micash.pushToken`); o `logout()` chama `DELETE /api/device/push-token` e depois `/logout` (ambos com `withSession`: com o access token vencido, renova antes e o `/logout` recebe o refresh token novo). `apiDelete` aceita corpo. A tela `notifications` lista os aparelhos (`GET /api/device/push-tokens`) e, só em `__DEV__`, envia o teste (`POST /api/device/push-token/test`, que a API só expõe em Development); preferências por tipo de aviso não existem na API. Central de notificações (sino do Dashboard → `notification-center`): `GET /api/notification?before&limit` (da mais recente para a mais antiga, cursor `before` = id da última), `GET /api/notification/unread-count` (número do sino, via `useUnreadNotificationsCount`), `PUT /api/notification/{id}/read` e `PUT /api/notification/read-all` (`src/lib/notificationCenter.ts`). Toda notificação fica na central, mesmo sem aparelho ativo; tocar no push também marca como lida, pelo `notificationId` (texto) do `data`. Nunca importe `expo-notifications` no topo de um arquivo (só `import type`): use `getNotificationsModule()` (`src/lib/notifications.ts`), que devolve `null` na web e no Expo Go, onde a própria importação lança "Cannot find native module 'ExpoTopicSubscriptionModule'" e derruba as rotas. Push remoto exige development build (não funciona no Expo Go): em Android, aparelho físico ou emulador com Google Play Services; em iOS, só iPhone físico. O `google-services.json` é público e versionado; a chave da Service Account do Firebase fica só no EAS e é ignorada pelo Git.
- **Datas da API:** `DateOnly` ("AAAA-MM-DD") é usado como está; `DateTime` com fuso (ex.: `expenseDate` em UTC) é convertido para o dia local. Sempre use `toDateKey` (`src/utils/format.ts`).

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

| Pasta            | Finalidade                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/`           | Rotas do Expo Router. `_layout.tsx` é a raiz (um `Stack` sem cabeçalho); `app/(tabs)/` é a área autenticada com a barra inferior (`home`, `transactions`, `reports`, `profile`); `categories` é aba oculta (`href: null`), aberta pelo Perfil; `goals` (Metas, `?tab=limits` abre nos limites de gasto) também é aba oculta; `new-transaction` (`?type=` receita ou despesa), `category-form` (`?id=` para editar), `goal-form` (`?type=savings` para meta de economia; `?id=` para editar) e `savings-goal` (`?id=`, detalhe da meta de economia), `assistant` (chat com a MI), `assistant-tips` (insights), `notification-center` (central de notificações; a engrenagem abre `notifications`, as configurações) e `forgot-password` (recuperação de senha: as etapas ficam em estado interno, sem e-mail, código ou `resetToken` na URL) ficam fora das abas, assim como as telas do Perfil (`personal-data`, `change-password`, `notifications`, `subscription`, `settings`). |
| `src/components` | Componentes reutilizáveis.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `src/constants`  | Constantes da aplicação.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `src/hooks`      | Hooks customizados.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `src/lib`        | Configuração e wrappers de bibliotecas de terceiros.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| `src/types`      | Tipos TypeScript compartilhados.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `src/utils`      | Funções utilitárias puras.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `assets/`        | Imagens (`images/`) e fontes (`fonts/`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `docs/`          | Documentação técnica (`architecture.md`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |

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

- Há testes unitários para `src/lib/*` e `src/utils/*`; ainda não há testes de tela.
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

### Interface

- Referência visual: protótipos em `C:\Workspace\Project MiCash\Docs\MiCash-Telas` (`micash_NN_*.html` e `MiCash-Telas.jpg`; os e-mails transacionais ficam em `Docs\MiCash-Emails`), fora do repositório. Reproduza com componentes nativos; não copie HTML/CSS.
- Cores só via `src/constants/colors.ts`; fontes só via `fonts.*` de `src/constants/typography.ts` (`fontFamily`, nunca `fontWeight`).
- Ícones Tabler importados um a um: `import IconMail from '@tabler/icons-react-native/IconMail'`. Nunca importe do índice `@tabler/icons-react-native` (adiciona ~5 MB ao bundle).
- Reutilize os componentes de `src/components` antes de criar equivalentes: `AppLogo`, `TextField` (`hideLabel`, `variant="white"`), `PrimaryButton`, `PasswordVisibilityToggle`, `BottomNav`, `AddTransactionSheet`, `TransactionRow`, `Skeleton`/`TransactionRowSkeleton`, `ErrorNotice`, `BottomSheet`, `FieldShell` (moldura comum dos campos), `SelectField` (com `icon` por opção e `action`), `DateField`, `SegmentedControl`, `CategoryIcon`, `DonutChart`, `BarChart` e `LineChart` (gráficos com `react-native-svg`/`View`, sem biblioteca de gráficos; o traçado da linha fica em `src/utils/chart.ts`), `ScreenHeader`, `MenuRow`, `Avatar`, `ProgressBar`, `GoalLimitRow`, `SavingsGoalRow`, `SavingsMovementSheet` (depósito/retirada de meta de economia) e `RichText` (negrito e listas nas respostas da IA), `CodeInput` (código em caixas: um `TextInput` só, com colar e preenchimento automático), `PasswordStrength` (barra de força e, com `showRules`, as regras de `PASSWORD_RULES`), `PremiumOfferSheet` (a única oferta do Premium; abra com `usePlan().showOffer`, nunca renderize outra) e `PremiumLockedCard` (conteúdo bloqueado com cadeado, que abre a oferta). A coroa laranja (`IconCrown`) marca recursos Premium.
- Configurações locais (sem backend) ficam em `src/lib/settings.ts` (`expo-secure-store`): `showBalance` e `biometrics`. A biometria (`expo-local-authentication`, `src/lib/biometrics.ts`) é uma trava local na Splash; não substitui o login na API.
- Consultas mensais usam `MonthPeriod` e os utilitários de `src/utils/period.ts`.
- Categorias e metas de economia gravam `icon` como nome de ícone Tabler (`CATEGORY_ICONS` / `SAVINGS_GOAL_ICONS`) e `color` em hexadecimal (`CATEGORY_COLORS`); valores fora desse padrão aparecem com ícone/cor padrão.
- Enums da API são enviados como número, com os valores do backend (`src/types/transactions.ts`); nunca use a posição na lista como valor. Categorias de despesa são do usuário e vêm da API, não de um enum.
- Valores monetários são editados em centavos inteiros (`parseCentsInput`) e convertidos com `centsToAmount` só no envio.
- Novas abas entram em `app/(tabs)/` e na `BottomNav`; itens sem tela mostram "Em breve" (sem telas vazias).
- Validações de formulário ficam em `src/utils/validation.ts` e devem espelhar as regras da API (ex.: `isValidPassword` = `PasswordValidator` do backend).

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

O projeto está no início do desenvolvimento das telas. Login, cadastro, Dashboard, Transações, Relatórios, o cadastro de receitas e despesas, o gerenciamento de categorias, as metas (limites de gasto e economia), a MI Assistente e o módulo Perfil já estão integrados (ver "Integração atual"). Até que uma tarefa autorize explicitamente:

- Não amplie a autenticação além do login, cadastro, refresh e recuperação de senha já integrados (ex.: login social, verificação de e-mail, aceite de Termos de Uso/Política de Privacidade).
- Não integre outros endpoints da API (ex.: edição/exclusão de movimentações).
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
