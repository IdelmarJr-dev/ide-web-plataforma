# ide-web-front

Frontend em React + TypeScript + Vite, organizado por features, com data-fetching
Suspense-first (`@tanstack/react-query`), validação de formulários com Zod e Tailwind CSS v4.

## Stack

- React 19 + TypeScript (strict)
- Vite 8
- React Router (roteamento)
- TanStack Query para dados de servidor (sessão de auth, mutations)
- Zod para validação de formulários
- Tailwind CSS v4 para estilos
- Monaco Editor (`@monaco-editor/react`, self-hosted — sem CDN) para o editor SQL
- React Flow (`@xyflow/react`) para o canvas do diagrama MER
- ESLint (strict, com regras de React, hooks e acessibilidade)
- Vitest + Testing Library para testes

## Estrutura de pastas

```
src/
  app/                # App.tsx, providers globais (QueryClient, Router, Auth), rotas
  features/
    auth/              # sessão (AuthProvider/useAuth), login, registro
    turmas/            # criação/matrícula/encerramento de turma
    exercicio/         # editor: SQLEditor (Monaco) + modelagem MER (React Flow) lado a lado
    dica-ia/            # botão/modal de dica de IA (SQL e modelagem)
    painel/             # dashboards do professor e do aluno (/dashboard)
    estudo-livre/        # IDE sem turma, schema sandbox próprio do aluno (/estudar)
    admin/               # área do professor/pesquisador (turmas, provas, pesquisa)
    tcle/                # termo de consentimento do fluxo de pesquisa
    pesquisa/             # TCLE → sessão → SUS → RTLX (exclusivo do período de coleta do TCC)
    legal/                # páginas estáticas (privacidade etc.)
  shared/
    components/       # componentes de UI reutilizáveis (Button, Input, Modal, AuthGuard, PageStub)
    hooks/             # hooks genéricos reutilizáveis entre features
  lib/                 # cliente HTTP (httpClient) e outras integrações de infraestrutura
  styles/              # tokens de design e configuração do Tailwind
  types/               # tipos globais compartilhados
tests/                 # testes com Testing Library (test-utils.tsx tem os providers de teste)
```

Importar de outra feature é sempre pelo `index.ts` dela (exceto quando o consumidor só
precisa de um `service`/hook leve e a feature também exporta uma página pesada, como
`exercicio` com o Monaco — nesse caso importa o arquivo concreto direto, pra não puxar
a página pesada de graça). Visão geral de módulos e arquitetura em
[`../CLAUDE.md`](../CLAUDE.md).

`features/pesquisa/`, `features/tcle/` e a rota `/admin/pesquisa` são exclusivas do
período de coleta de dados do TCC — o autor remove esse código depois da coleta, antes
deste projeto servir como ferramenta real de uso do IFPI (ver "Restrições
não-negociáveis" em [`CLAUDE.md`](../CLAUDE.md)).

## Como rodar localmente

```bash
npm install
cp .env.example .env
npm run dev
```

A aplicação sobe em `http://localhost:5173`. Requer o backend rodando em `http://localhost:3000`
(ver [../ide-web-backend/README.md](../ide-web-backend/README.md)) para autenticação funcionar.

## Variáveis de ambiente

| Variável                  | Descrição                                                         | Padrão                          |
| --------------------------- | -------------------------------------------------------------------- | ---------------------------------- |
| `VITE_API_URL`               | URL base da API (backend Node) consumida pelo app                    | `http://localhost:3000/api/v1`        |
| `VITE_RESEARCH_API_URL`      | URL base do backend Python de pesquisa (self-hosted, o front fala direto com ele) | `http://localhost:8001`   |

## Nota sobre o bundle do Monaco Editor

O Monaco é carregado localmente (`monaco-editor` + `loader.config({ monaco })`), nunca via CDN — mantém o
app 100% self-hosted. Isso inclui todas as linguagens suportadas pelo pacote (~2.6MB no chunk de
`/exercicios/:id`, carregado sob demanda). Reduzir para só a linguagem SQL é uma otimização de bundle
válida para quando o `SQLEditor` ganhar features reais (Fase 2) e puder ser testada em navegador.

## Comandos disponíveis

| Comando              | Descrição                                   |
| --------------------- | --------------------------------------------- |
| `npm run dev`          | Sobe o servidor de desenvolvimento (Vite)    |
| `npm run build`        | Type-check (`tsc -b`) e build de produção    |
| `npm run preview`      | Serve o build de produção localmente         |
| `npm run lint`         | Roda o ESLint em todo o projeto              |
| `npm run test`         | Roda a suíte de testes uma vez (Vitest)      |
| `npm run test:watch`   | Roda os testes em modo watch                 |
