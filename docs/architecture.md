# Arquitetura — MiCash Mobile

Documento da estrutura inicial. Nenhuma funcionalidade de negócio foi implementada ainda.

## Stack

- React Native + TypeScript (modo `strict`)
- Expo SDK 57 com Expo Router (navegação baseada em arquivos)
- ESLint (`eslint-config-expo` + `eslint-config-prettier`) e Prettier
- Jest (`jest-expo`) e React Native Testing Library

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

## Fora do escopo desta etapa

Design system, telas, services, cliente HTTP, integração com o backend .NET, autenticação, estado global e regras de negócio.
