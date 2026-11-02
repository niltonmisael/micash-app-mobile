# Arquitetura — MiCash Mobile

Telas implementadas: Splash (`app/index.tsx`), Login (`app/login.tsx`), Cadastro (`app/register.tsx`) e, na área autenticada com abas (`app/(tabs)/`), Dashboard (`home.tsx`) e Transações (`transactions.tsx`).

## Dashboard e Transações

- Dados: `GET /api/dashboard/monthly-summary` (totais do mês; `balance` = receitas − despesas do mês, exibido como "Saldo do mês"), `GET /api/dashboard/lastest-expenses?count=N` (despesas com data e categoria) e `GET /api/income` (receitas paginadas). A junção e o agrupamento ficam em `src/lib/transactions.ts`.
- "Resumo do mês" (Dashboard): `GET /api/dashboard/daily-summary?year&month` devolve todos os dias do mês (inclusive os sem lançamento) com `income`, `expense` e os acumulados `cumulativeIncome`/`cumulativeExpense`, calculados pela API com os mesmos lançamentos e a mesma regra de mês do `monthly-summary` (o acumulado do último dia é igual aos totais). O `LineChart` desenha os acumulados (Receitas em verde, Despesas em laranja; eixo com os dias 1, 8, 15, 22 e 29) só até hoje (`chartDays`), porque os dias seguintes repetiriam o valor de hoje. Uma falha só troca o gráfico por "Gráfico indisponível no momento.".
- Transações carrega as 50 receitas e as 50 despesas mais recentes; o filtro escolhe a fonte e a busca é local. Totais do mês vêm do `monthly-summary`.
- O botão "+" abre `AddTransactionSheet`, que leva a `app/new-transaction.tsx` (receita ou despesa, alternável no topo).

## Nova receita / Nova despesa

- Receita: `POST /api/income` com `title`, `description` (ou null), `amount`, `receivedAt` ("AAAA-MM-DD"), `incomeCategory` (enum numérico) e `isRecurring`.
- Despesa: `POST /api/expense` com `title`, `description` ("" se vazia), `expenseDate` (UTC; hoje = horário atual, outros dias = meio-dia local; sem datas futuras), `amount`, `paymentType`, `expenseStatus` (Pago/Pendente) e `categoryId` (de `GET /api/category/all`; 204 = nenhuma categoria).
- O campo "Conta" do protótipo não existe na API e não foi implementado. Sem categorias cadastradas, o formulário de despesa avisa e oferece "Cadastrar categoria".
- O seletor de categoria tem "+ Nova categoria": ao voltar do cadastro, a lista é recarregada e a categoria nova (único id que não existia antes; a API não devolve o id) é selecionada.
- Após salvar, Dashboard e Transações recarregam ao voltar ao foco (`useAuthenticatedQuery` usa `useFocusEffect`).

## Relatórios

- Tela `app/(tabs)/reports.tsx`. O filtro de período oferece o mês atual e os 11 anteriores (a API aceita qualquer ano/mês).
- "Despesas por categoria": `GET /api/dashboard/expenses-by-category?year&month` (valores e percentuais calculados pela API); o total é o `totalExpense` do `monthly-summary` do mês. Cores fora do padrão hexadecimal recebem uma cor da paleta.
- "Evolução mensal": não há endpoint de série histórica; o app consulta o `monthly-summary` de cada um dos 6 meses até o selecionado e usa o `totalExpense` de cada um (totais do backend, sem somas no app).
- O mês na API é o do `ExpenseDate` em UTC: uma despesa lançada à noite no último dia do mês (horário de Brasília) entra no mês seguinte.

## Perfil

- Aba `app/(tabs)/profile.tsx`: nome e e-mail (`GET /api/user/profile`), plano atual (`GET /api/subscription/current`; sem assinatura vem `planId: null` = Gratuito) e menu. "Preferências" e "Ajuda e suporte" mostram "Em breve" (nada definido no backend nem no app).
- `app/personal-data.tsx`: `PUT /api/user/update` com `name` e `email` (a API não tem telefone nem verificação de troca de e-mail); o nome também é atualizado na sessão salva.
- `app/change-password.tsx`: `PUT /api/user/change-password` com `password` e `newPassword` (a confirmação não é enviada). A API confere a senha atual e não encerra outras sessões.
- `app/notifications.tsx`: "Este aparelho" mostra a permissão e o registro (ativar, ou "Abrir ajustes" quando negada; recarrega ao voltar dos Ajustes); "Aparelhos conectados" lista `GET /api/device/push-tokens` (o token não vem inteiro: este aparelho é reconhecido pelo `tokenSuffix`, calculado como no `PushTokenMask` da API); em development build, "Enviar notificação de teste" chama `POST /api/device/push-token/test` (só existe com a API em Development; fora dela, 404). As preferências por tipo de aviso seguem desligadas e bloqueadas: a API não as guarda.

## Notificações push

- Fluxo: app (`expo-notifications`) → Expo Push Token → API .NET (a definir) → Expo Push Service (`https://exp.host/--/api/v2/push/send`), que entrega pelo FCM V1 (Android) e APNs (iOS). O app não usa o Firebase diretamente; o `google-services.json` é a configuração pública do Android (`expo.android.googleServicesFile`).
- `src/lib/notifications.ts`: exibição com o app aberto (banner), canal Android `default`, permissão (o diálogo só aparece enquanto o usuário não respondeu; negada não é pedida de novo) e `registerForPushNotifications()`, que devolve o token ou o motivo (`denied`, `unsupported` em web/simulador do iOS/Expo Go, `error`). O token usa o `extra.eas.projectId`.
- `src/hooks/usePushNotifications.ts`, montado em `app/(tabs)/_layout.tsx` (área autenticada): registra o aparelho uma vez e escuta as notificações. Ao tocar, abre a rota interna de `data.url` (ex.: `"/goals"`); outros valores são ignorados.
- Registro: a cada entrada na área autenticada, `POST /api/device/push-token` com `expoPushToken`, `platform` (`"android"`/`"ios"`), `deviceId` (Android ID ou identificador do fornecedor no iOS, via `expo-application`; a API desativa tokens antigos do mesmo aparelho) e `deviceName` (modelo, não o nome dado pelo usuário). A API cria ou atualiza pelo token; se ele era de outra conta, passa para a atual. O token registrado fica no SecureStore (`micash.pushToken`). Falhas são silenciosas e o registro é tentado de novo na próxima entrada.
- Logout: `DELETE /api/device/push-token` (`{ expoPushToken }`) antes do `POST /logout`, porque a rota exige a sessão. Com o access token vencido, a sessão é renovada antes (`withSession`). Falhas (sem conexão, 404) não impedem o logout. Só quando o refresh token também é recusado (mais de 7 dias desde o último login ou refresh, ou revogado) o token não é desativado: o aparelho volta a ser da conta que entrar depois.
- Central de notificações (`app/notification-center.tsx`, aberta pelo sino do Dashboard): a API grava toda notificação do usuário, mesmo sem aparelho ativo. A lista usa `GET /api/notification?before&limit` (20 por página, da mais recente para a mais antiga; "Carregar mais" envia `before` = id da última). Tocar marca como lida (`PUT /api/notification/{id}/read`, sem esperar a resposta) e abre a `url` (rota interna; `null` = nada a abrir); "Marcar todas como lidas" usa `PUT /api/notification/read-all`. A engrenagem abre `app/notifications.tsx`.
- Sino: `useUnreadNotificationsCount` (`GET /api/notification/unread-count`) recarrega ao voltar ao Dashboard e quando chega um push com o app aberto; falhas só escondem o número (a sessão expirada é tratada pela consulta do Dashboard). Mostra até "9+".
- Tocar no push: além de abrir `data.url`, marca a notificação como lida pelo `data.notificationId` (a API o envia como texto, porque o id só existe depois de gravada).
- Canal Android `default`: o mesmo `ExpoPush:ChannelId` da API. A API só aceita em `data.url` as rotas de `PushRoutes.AllowedPaths`.
- Push remoto exige development build (`eas build --profile development`); o Expo Go não recebe. No Android, funciona em aparelho físico ou em emulador cuja imagem do sistema tenha o Google Play Services; no iOS, só em iPhone físico (o simulador não gera token). A chave da Service Account do Firebase (FCM V1) fica só nas credenciais do EAS e é ignorada pelo Git.
- `app/subscription.tsx`: planos de `GET /api/plan` (só nome e preço; sem benefícios, limites ou plano anual). "Assinar" chama `POST /api/checkout` e abre o link do Pagar.me; a assinatura só muda quando o backend confirma o pagamento.
- `app/settings.tsx`: moeda (Real), tema (Claro) e dia de início do mês (1) são informativos. "Exibir saldo na tela inicial" e "Biometria" ficam salvos no aparelho (`src/lib/settings.ts`). "Confirmar exclusão de transações" está bloqueado (o app não exclui transações).
- Sessão: no 401, `withSession` (`src/lib/auth.ts`) chama `POST /refresh` (anônimo, com o refresh token), salva a sessão nova e repete a requisição uma vez. A API apaga o refresh token usado e cria outro válido por 7 dias, então requisições em paralelo esperam a mesma troca (com trocas simultâneas, as seguintes usariam um token já apagado). Refresh recusado (401/404) → a sessão é apagada e o app volta ao Login; sem conexão, a sessão é mantida e a tela mostra o erro de rede. O `/login` (senha errada também é 401) e o próprio `/refresh` não passam por esse fluxo.
- Sair: `POST /logout` revoga o refresh token e a sessão local é apagada. Com o access token vencido, a sessão é renovada antes e o `/logout` recebe o refresh token novo. O access token (JWT) continua válido até expirar, pois a API não tem lista de revogação.

## Categorias

- Tela `app/(tabs)/categories.tsx` (aba oculta, aberta pelo Perfil). Lista só as categorias de despesa (as únicas que existem na API); a seta de cada item abre o menu Editar/Excluir. As categorias de receita são o enum fixo e aparecem apenas no formulário de receita.
- `app/category-form.tsx`: cria (`POST /api/category/create`) ou edita (`GET` + `PUT /api/category/{id}`) com `name`, `icon` e `color`. O app valida os três campos, porque o `PUT` da API não valida.
- Excluir (`DELETE /api/category/{id}`) pede confirmação; a API inativa a categoria (não apaga) e as despesas continuam ligadas a ela.
- Convenção de aparência: `icon` = nome do ícone Tabler, `color` = hexadecimal (`src/components/CategoryIcon.tsx`).

- Limitações do backend: `POST /api/expense` não verifica se a categoria pertence ao usuário, e um `categoryId` inexistente gera erro 500.
- Limitações da API: não há saldo acumulado, série diária para o gráfico, endpoint único de movimentações com filtro e paginação, nem ícone da categoria nas despesas. `GET /api/expense` só devolve `id`, `title` e `amount`.

## Autenticação

- O Login chama `POST /login` e o Cadastro chama `POST /api/user/register` da MiCash.API (`src/lib/api.ts` → `src/lib/auth.ts`). As duas respostas trazem `name`, `token` e `refreshToken`, então o cadastro já autentica.
- A sessão fica no armazenamento seguro do aparelho (`expo-secure-store`).
- A Splash abre `/home` se houver sessão salva, senão `/login`. "Sair" apaga a sessão local.
- O cadastro envia `name` e `email` sem espaços nas pontas e `password` como digitada; `phone` (opcional na API) não é enviado. A regra de senha do app espelha o `PasswordValidator` da API.
- Cadastro: a API envia o e-mail de boas-vindas (Hangfire + Resend) depois de criar a conta; o app só avisa no alerta "Conta criada" e não faz nenhuma chamada a mais.
- Recuperação de senha (`app/forgot-password.tsx`, aberta por "Esqueceu sua senha?" no Login; `src/lib/passwordReset.ts`), numa rota só com as etapas em estado interno (nada na URL nem no aparelho):
  1. E-mail ("Obter código") → `POST /forgot-password`. A resposta (`202`) é a mesma exista ou não a conta e traz `resendAvailableInSeconds` (60), `codeExpiresInMinutes` (15) e `codeLength` (6).
  2. Código (`CodeInput`) → `POST /verify-password-reset-code` → `resetToken` (uso único, 10 min). Errado, expirado, usado ou com as 5 tentativas esgotadas têm a mesma mensagem; o app conta as tentativas e pede um novo código depois de 5. "Reenviar código" chama `/forgot-password` de novo, liberado depois da contagem; a API ignora em silêncio pedidos antes de 60 s ou acima de 5 por hora, e um código novo invalida o anterior.
  3. Nova senha (regras de `PASSWORD_RULES` = `PasswordValidator`) → `POST /reset-password` (`204`). Não autentica: "Voltar para o login". Senha nova igual à guardada → `400` "A nova senha deve ser diferente da senha atual."; a autorização não é consumida, então a pessoa digita outra senha na mesma tela. "Solicitar novo código" só aparece com a autorização vencida (10 min contados no app) ou recusada pela API.
  - Limite por IP: 20 requisições em 10 min somando as três rotas (`429` com mensagem própria).
- Alterar senha (`app/change-password.tsx`): `validateChangePasswordForm` espelha o `ChangePasswordUseCase`, inclusive a nova senha idêntica à atual (texto exato, sem trim; o aviso de formato vem antes). A senha atual errada só a API sabe: a mensagem dela aparece embaixo do botão. A API revoga os refresh tokens anteriores, inclusive o deste aparelho; o app faz `/login` com o e-mail do perfil e a nova senha logo depois, para a sessão continuar.
- Ainda não implementado: login social, verificação de e-mail e aceite de Termos de Uso/Política de Privacidade (o espaço da tela está reservado, sem checkbox).

## Stack

- React Native + TypeScript (modo `strict`)
- Expo SDK 57 com Expo Router (navegação baseada em arquivos)
- ESLint (`eslint-config-expo` + `eslint-config-prettier`) e Prettier
- Jest (`jest-expo`) e React Native Testing Library
- Fonte Inter (`@expo-google-fonts/inter`), ícones Tabler (`@tabler/icons-react-native`) e `react-native-svg`

## Estrutura de pastas

| Pasta            | Finalidade                                                                |
| ---------------- | ------------------------------------------------------------------------- |
| `app/`           | Rotas do Expo Router. Cada arquivo vira uma rota; `_layout.tsx` é a raiz. |
| `src/components` | Componentes reutilizáveis.                                                |
| `src/constants`  | Constantes da aplicação.                                                  |
| `src/hooks`      | Hooks customizados.                                                       |
| `src/lib`        | Configuração e wrappers de bibliotecas de terceiros.                      |
| `src/types`      | Tipos TypeScript compartilhados.                                          |
| `src/utils`      | Funções utilitárias puras.                                                |
| `assets/`        | Imagens (`images/`) e fontes (`fonts/`).                                  |
| `docs/`          | Documentação do projeto.                                                  |

Os arquivos `.gitkeep` apenas mantêm as pastas vazias no Git e devem ser removidos quando houver conteúdo.

## Convenções

- Alias de import: `@/*` aponta para `src/*` (ex.: `import { x } from '@/utils/x'`).
- Rotas ficam em `app/`; código que não é rota fica em `src/`.
- Testes ficam ao lado do código testado, com sufixo `.test.ts` / `.test.tsx`.
- Formatação por Prettier (`npm run format`); qualidade por ESLint (`npm run lint`) e `npm run typecheck`.
- Cores em `src/constants/colors.ts` e fontes em `src/constants/typography.ts`. Use `fonts.*` como `fontFamily`, não `fontWeight`.
- Ícones importados um a um: `import IconMail from '@tabler/icons-react-native/IconMail'`. O import pelo índice do pacote adiciona ~5 MB ao bundle.

## Fora do escopo desta etapa

Design system completo, demais telas, outros endpoints da API, estado global e regras de negócio.
