# Arquitetura — MiCash Mobile

Telas implementadas: Splash (`app/index.tsx`), Login (`app/login.tsx`), Cadastro (`app/register.tsx`) e, na área autenticada com abas (`app/(tabs)/`), Dashboard (`home.tsx`) e Transações (`transactions.tsx`).

## Dashboard e Transações

- Dados: `GET /api/dashboard/monthly-summary` (totais do mês; `balance` = receitas − despesas do mês, exibido como "Saldo do mês"), `GET /api/dashboard/lastest-expenses?count=N` (despesas com data e categoria) e `GET /api/income` (receitas paginadas). A junção e o agrupamento ficam em `src/lib/transactions.ts`.
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
- `app/notifications.tsx`: opções desligadas e bloqueadas — não há notificações no app nem preferências na API.
- `app/subscription.tsx`: planos de `GET /api/plan` (só nome e preço; sem benefícios, limites ou plano anual). "Assinar" chama `POST /api/checkout` e abre o link do Pagar.me; a assinatura só muda quando o backend confirma o pagamento.
- `app/settings.tsx`: moeda (Real), tema (Claro) e dia de início do mês (1) são informativos. "Exibir saldo na tela inicial" e "Biometria" ficam salvos no aparelho (`src/lib/settings.ts`). "Confirmar exclusão de transações" está bloqueado (o app não exclui transações).
- Sair: `POST /logout` revoga o refresh token e a sessão local é apagada. O access token (JWT) continua válido até expirar, pois a API não tem lista de revogação.

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
- Ainda não implementado: `/refresh`, `/logout` no servidor, login social, recuperação de senha e aceite de Termos de Uso/Política de Privacidade (o espaço da tela está reservado, sem checkbox).

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
