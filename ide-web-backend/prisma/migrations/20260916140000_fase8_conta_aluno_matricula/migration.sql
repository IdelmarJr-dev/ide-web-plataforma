-- Fase 8, etapa 1 — conta própria do aluno e matrícula em turma.
-- Ver docs/decisions/fase8-conta-do-aluno-matricula-estudo-livre.md.

-- Os alunos criados pela sessão leve não têm e-mail/senha e não conseguiriam logar
-- depois desta fase. São dados de teste (decisão D12): saem junto do que pende deles.
CREATE TEMP TABLE alunos_sessao_leve AS
SELECT "id" FROM "usuarios" WHERE "papel" = 'aluno' AND "email" IS NULL;

DELETE FROM "logs_execucao_sql"
WHERE "submissao_id" IN (
  SELECT "id" FROM "submissoes_sql" WHERE "usuario_id" IN (SELECT "id" FROM alunos_sessao_leve)
);
DELETE FROM "submissoes_sql" WHERE "usuario_id" IN (SELECT "id" FROM alunos_sessao_leve);
DELETE FROM "dicas_ia" WHERE "usuario_id" IN (SELECT "id" FROM alunos_sessao_leve);
DELETE FROM "diagramas_mer" WHERE "usuario_id" IN (SELECT "id" FROM alunos_sessao_leve);
DELETE FROM "respostas_dissertativas" WHERE "usuario_id" IN (SELECT "id" FROM alunos_sessao_leve);
DELETE FROM "resultados_exercicio" WHERE "usuario_id" IN (SELECT "id" FROM alunos_sessao_leve);
DELETE FROM "usuarios" WHERE "id" IN (SELECT "id" FROM alunos_sessao_leve);

CREATE TABLE "matriculas_turma" (
  "id"        UUID         NOT NULL,
  "aluno_id"  UUID         NOT NULL,
  "turma_id"  UUID         NOT NULL,
  "prova_id"  UUID,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "matriculas_turma_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "matriculas_turma_aluno_id_turma_id_key"
  ON "matriculas_turma"("aluno_id", "turma_id");

ALTER TABLE "matriculas_turma"
  ADD CONSTRAINT "matriculas_turma_aluno_id_fkey"
  FOREIGN KEY ("aluno_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "matriculas_turma"
  ADD CONSTRAINT "matriculas_turma_turma_id_fkey"
  FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "matriculas_turma"
  ADD CONSTRAINT "matriculas_turma_prova_id_fkey"
  FOREIGN KEY ("prova_id") REFERENCES "provas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Alunos que sobraram (já tinham conta) viram matrícula, carregando a prova sorteada.
INSERT INTO "matriculas_turma" ("id", "aluno_id", "turma_id", "prova_id", "criado_em")
SELECT gen_random_uuid(), "id", "turma_id", "prova_id", "criado_em"
FROM "usuarios"
WHERE "papel" = 'aluno' AND "turma_id" IS NOT NULL;

ALTER TABLE "usuarios" DROP COLUMN "turma_id";
ALTER TABLE "usuarios" DROP COLUMN "prova_id";
ALTER TABLE "usuarios" DROP COLUMN "codigo_pessoal_hash";
