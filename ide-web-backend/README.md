# IDE Web — Backend

Backend do projeto IDE Web, construído em Node.js + Express + TypeScript seguindo arquitetura em camadas (`routes → controllers → services → repositories`). Todas as rotas da API ficam sob o prefixo `/api/v1`. Persistência via Prisma + PostgreSQL (driver adapter `@prisma/adapter-pg`).

## Como rodar localmente

```bash
npm install
cp .env.example .env   # ajuste DATABASE_URL, JWT_SECRET, RESEARCH_JWT_SECRET e as SANDBOX_*
npx prisma migrate dev # cria o banco ide_web e aplica o schema (precisa de um Postgres em DATABASE_URL)
npm run dev
```

O servidor sobe em `http://localhost:3000` (porta configurável via `.env`); a API fica em `http://localhost:3000/api/v1`. O sandbox SQL (`SANDBOX_DATABASE_URL`/`SANDBOX_EXEC_DATABASE_URL`) precisa de um segundo Postgres, separado do principal — em dev local é o serviço `db_sandbox` do `docker-compose.yml` da raiz.

## Variáveis de ambiente

| Variável                    | Descrição                                                            | Padrão                       |
| ---------------------------- | ---------------------------------------------------------------------- | ------------------------------ |
| `NODE_ENV`                   | Ambiente de execução (`development`/`test`/`production`)              | `development`                    |
| `PORT`                       | Porta HTTP do servidor                                                 | `3000`                            |
| `LOG_LEVEL`                  | Nível mínimo de log (`debug`/`info`/`warn`/`error`)                    | `info`                             |
| `CORS_ORIGIN`                | Origem permitida para CORS (com `credentials: true`)                   | `http://localhost:5173`            |
| `DATABASE_URL`               | Connection string do PostgreSQL principal                              | — (obrigatória)                      |
| `JWT_SECRET`                 | Segredo usado para assinar access e refresh tokens                     | — (obrigatória)                      |
| `JWT_ACCESS_EXPIRES_IN`      | Validade do access token                                               | `15m`                                 |
| `JWT_REFRESH_EXPIRES_IN`     | Validade do refresh token                                              | `7d`                                   |
| `RESEARCH_JWT_SECRET`        | Segredo compartilhado com o backend Python de pesquisa (self-hosted, à parte deste repositório) | — (obrigatória) |
| `RESEARCH_JWT_EXPIRES_IN`    | Validade do token curto emitido em `GET /pesquisa/token`               | `30m`                                    |
| `LLM_API_KEY`                | Chave da API de LLM (dicas de IA) — sem ela, a rota responde `LLM_NAO_CONFIGURADO` | vazio                     |
| `LLM_MODEL`                  | Modelo usado no provedor de LLM (Groq)                                 | `llama-3.1-8b-instant`                   |
| `SANDBOX_DATABASE_URL`       | Connection string da role de provisionamento do sandbox SQL (banco separado) | — (obrigatória)                     |
| `SANDBOX_EXEC_DATABASE_URL`  | Connection string da role de execução (`SET ROLE` por aluno) do sandbox SQL  | — (obrigatória)                     |
| `SANDBOX_STATEMENT_TIMEOUT_MS` | Timeout de cada statement do aluno no sandbox                        | `5000`                                    |

Nunca commitar um arquivo `.env` real — use `.env.example` como referência. `PESQUISADOR_NOME`/`PESQUISADOR_EMAIL`/`PESQUISADOR_SENHA` não são variáveis de runtime da API: só são lidas na hora de rodar `scripts/seed-pesquisador.ts` (conta única do papel `pesquisador`) e nunca ficam persistidas em lugar nenhum.

## Banco de dados (Prisma)

Schema em `prisma/schema.prisma`, no schema `public` do Postgres. Os schemas `sandbox_*` (dados de exemplo que o aluno consulta) não são modelados aqui — ficam fora do Prisma, criados sob demanda via DDL dinâmico e isolados por schema/role própria por aluno+exercício (ver [`../CLAUDE.md`](../CLAUDE.md)).

| Comando                  | Descrição                                              |
| ------------------------- | -------------------------------------------------------- |
| `npx prisma migrate dev`  | Cria/atualiza o banco local a partir das migrations     |
| `npx prisma generate`     | Regenera o client TypeScript em `src/generated/prisma`  |
| `npx prisma studio`       | Abre uma UI para inspecionar os dados                    |

## Autenticação

JWT via cookies `httpOnly` (`access_token` curto + `refresh_token` longo, ver `src/utils/cookies.ts`). A sessão tem estado no servidor (`SessaoAuth`): o token carrega um `sid`, `requireAuth` valida a sessão a cada request (revogada / teto de 6h / 1h de ociosidade) e `POST /auth/logout` revoga de fato — não é só limpar cookie. Todo papel (`aluno`/`professor`/`pesquisador`) tem conta própria com e-mail e senha; a conta de `pesquisador` não tem autocadastro, é criada por `scripts/seed-pesquisador.ts`.

## Comandos disponíveis

| Comando            | Descrição                                                |
| ------------------- | ----------------------------------------------------------- |
| `npm run dev`        | Sobe o servidor em modo desenvolvimento (watch)             |
| `npm run build`      | Compila o TypeScript para `dist/`                            |
| `npm start`          | Roda a build de produção (`dist/server.js`)                  |
| `npm test`           | Executa os testes (Vitest)                                    |
| `npm run lint`       | Roda o ESLint em todo o projeto                                |
| `npm run typecheck`  | Type-check do projeto e da suíte de testes, sem gerar build     |

## Arquitetura

```
src/
├── config/        # Configuração centralizada (env validado com Zod)
├── controllers/   # Recebem req/res e delegam para services
├── services/       # Regras de negócio, sem acesso a HTTP ou banco
├── repositories/   # Acesso a dados (interface + implementação, via Prisma)
├── models/         # Entidades de domínio (sem tabela própria, ex.: HealthStatus)
├── dtos/           # Validação/formatação de entrada e saída (Zod)
├── errors/         # Classes de erro customizadas
├── middlewares/    # Error handler central, 404, requireAuth
├── routes/         # Definição de endpoints
├── lib/            # Clientes de infraestrutura (Prisma singleton)
├── types/          # Augmentations globais (ex.: express.d.ts)
├── generated/      # Client Prisma gerado — não editar, não versionado
├── utils/          # Helpers (asyncHandler, logger, jwt, cookies, password)
├── app.ts          # Montagem do Express app
└── server.ts       # Bootstrap HTTP
```

### Fluxo de referência: `GET /health` e módulo `auth`

`GET /health` é o exemplo mínimo (sem banco): `health.routes.ts → HealthController → HealthService → HealthRepository`.

O módulo `auth` (`POST /auth/registrar`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`) é o exemplo com persistência real via Prisma: `auth.routes.ts → AuthController → AuthService → UsuarioRepository`, com `requireAuth` protegendo as rotas autenticadas.

Novas features devem seguir o mesmo padrão: repository isola a fonte de dado atrás de uma interface, service concentra a regra de negócio (sem conhecer HTTP), controller apenas traduz request/response, e a rota só registra o handler.

## Tratamento de erros

Todo erro de negócio deve estender `AppError` (`src/errors`) e ser tratado pelo middleware central (`src/middlewares/errorHandler.ts`). Não usar `try/catch` espalhado nos controllers — os handlers assíncronos são envolvidos por `asyncHandler`, que encaminha qualquer rejeição para o middleware de erro.
