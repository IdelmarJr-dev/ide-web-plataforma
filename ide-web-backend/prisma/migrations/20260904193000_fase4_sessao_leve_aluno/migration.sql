-- Fase 4: sessão leve do aluno (sem conta/senha) — ver
-- docs/decisions/fase4-pesquisa-python-sessao-aluno-login.md.

-- AlterTable
ALTER TABLE "usuarios" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "usuarios" ALTER COLUMN "senha_hash" DROP NOT NULL;
ALTER TABLE "usuarios" ADD COLUMN "codigo_pessoal_hash" TEXT;

-- O fluxo de solicitação/aprovação de turma foi removido (entrar com o código da
-- turma já basta — decisão revista na Fase 4). A tabela "solicitacoes_turma" nunca
-- chegou a ser criada por uma migration anterior (drift entre schema.prisma e o
-- histórico de migrations); os DROP abaixo são defensivos (IF EXISTS) para o caso de
-- algum ambiente ter sincronizado via `prisma db push` em algum momento.
ALTER TABLE IF EXISTS "solicitacoes_turma" DROP CONSTRAINT IF EXISTS "solicitacoes_turma_usuario_id_fkey";
ALTER TABLE IF EXISTS "solicitacoes_turma" DROP CONSTRAINT IF EXISTS "solicitacoes_turma_turma_id_fkey";
DROP TABLE IF EXISTS "solicitacoes_turma";
DROP TYPE IF EXISTS "StatusSolicitacaoTurma";
