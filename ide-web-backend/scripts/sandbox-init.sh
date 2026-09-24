#!/bin/sh
# Roda uma única vez, na primeira inicialização do container db_sandbox (imagem
# oficial do Postgres executa tudo em /docker-entrypoint-initdb.d/ nesse momento).
# Cria a role de login da conexão de execução do sandbox SQL (sandbox_login) — usada
# só pra autenticar, nunca pra rodar DDL/DML diretamente. Sem privilégio nenhum por
# padrão, inclusive sem GRANT de schema: a cada request, a conexão faz SET ROLE pra
# assumir a identidade real de execução daquele aluno (exec_<usuario_id>), criada sob
# demanda no provisionamento (ver src/repositories/sandbox/SandboxProvisioningRepository.ts,
# Fase 12 — SET ROLE só funciona porque sandbox_login é tornada membro de cada
# exec_<usuario_id> no momento em que essa role é criada). Nunca a mesma role de
# provisionamento (POSTGRES_USER deste container, que localmente já é superuser e por
# isso já tem CREATEROLE pra criar as roles por aluno).
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
  CREATE ROLE sandbox_login WITH LOGIN PASSWORD '$SANDBOX_EXEC_DB_PASSWORD' NOSUPERUSER NOCREATEDB NOCREATEROLE;
EOSQL
