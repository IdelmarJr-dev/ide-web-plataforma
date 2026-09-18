# IDE Web

IDE web para ensino de Banco de Dados: os alunos modelam (Chen conceitual + lógico, com
conversão assistida entre os dois) e escrevem SQL real contra um sandbox isolado por
aluno, enquanto professores criam exercícios com gabarito, corrigem e acompanham o
progresso da turma em um painel dedicado. Desenvolvido como Trabalho de Conclusão de
Curso (TCC) em Análise e Desenvolvimento de Sistemas — IFPI.

## Visão geral

| Camada | Stack | Diretório |
| --- | --- | --- |
| Frontend | React + TypeScript + Vite | [`ide-web-front/`](ide-web-front) |
| Backend | Node.js + Express + TypeScript | [`ide-web-backend/`](ide-web-backend) |
| Banco principal | PostgreSQL via Supabase, acesso via Prisma | — |
| Sandbox SQL do aluno | Projeto Supabase separado, schema isolado por aluno+exercício | — |

O editor de exercícios combina Monaco (SQL) e React Flow (diagramas MER) lado a lado.
A modelagem conceitual segue a notação de Chen, com conversão assistida para o modelo
lógico e geração de SQL PostgreSQL a partir dele.

## Como rodar localmente

Requer Docker e Docker Compose.

```bash
cp .env.example .env   # ajuste as senhas/segredos
docker compose up --build
```

- Frontend: `http://localhost:8080`
- Backend (API): `http://localhost:3000/api/v1`

Para desenvolver cada parte fora do container (hot reload), veja o README de cada
projeto: [`ide-web-backend/README.md`](ide-web-backend/README.md) e
[`ide-web-front/README.md`](ide-web-front/README.md).

## Arquitetura

Backend em camadas MSC (`routes → controllers → services → repositories`) com Prisma;
frontend organizado por feature (`features/<domínio>/`). Visão geral de módulos, modelo
de dados e decisões de cada fase em [`CLAUDE.md`](CLAUDE.md).

O sandbox de SQL executa consultas reais do aluno isoladas por schema/role dedicados,
sem acesso ao banco principal da aplicação — a role de execução nunca tem privilégio
próprio, só assume a identidade do aluno da vez via `SET ROLE`.

## Licença e contribuição

Distribuído sob a licença [MIT](LICENSE): livre para baixar, usar e modificar,
inclusive em derivações próprias. Não há push direto neste repositório — mudanças
externas passam por fork + pull request, sujeitas à revisão do mantenedor.

## Escopo de pesquisa

Este repositório contém apenas o "produto": a ferramenta de ensino. O módulo de
pesquisa do TCC (TCLE, sorteio de grupo, questionários SUS/RTLX) roda num backend
Python self-hosted separado, fora deste repositório e fora de qualquer serviço cloud de
terceiros — dado de sujeito de pesquisa humana não é tratado aqui.
