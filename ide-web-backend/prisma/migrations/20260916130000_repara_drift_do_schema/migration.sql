-- Reparo de divergência entre o histórico de migrations e `schema.prisma`.
--
-- As migrations anteriores não criavam `respostas_dissertativas`, `resultados_exercicio`,
-- `turmas.codigo` nem as colunas de liberação de gabarito: os bancos existentes ganharam
-- esses objetos por `prisma db push`, então o desvio só aparecia ao montar um banco novo
-- por `migrate deploy` (criar turma quebrava com "column turmas.codigo does not exist").
--
-- Por isso tudo aqui é idempotente: nos bancos que já têm os objetos, a migration passa
-- sem efeito; num banco novo, ela completa o schema.

-- Gabarito do exercício
ALTER TABLE "exercicios" ADD COLUMN IF NOT EXISTS "gabarito_dissertativo" TEXT;
ALTER TABLE "exercicios" ADD COLUMN IF NOT EXISTS "gabarito_liberado" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "exercicios" ADD COLUMN IF NOT EXISTS "gabarito_liberado_em" TIMESTAMP(3);

-- Código da turma: entra opcional, recebe um valor nas turmas que já existem e só então
-- vira obrigatório (uma coluna NOT NULL sem default quebraria numa tabela com dados).
ALTER TABLE "turmas" ADD COLUMN IF NOT EXISTS "codigo" TEXT;
UPDATE "turmas" SET "codigo" = upper(substr(md5(random()::text || "id"::text), 1, 6)) WHERE "codigo" IS NULL;
ALTER TABLE "turmas" ALTER COLUMN "codigo" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "turmas_codigo_key" ON "turmas"("codigo");

-- Resposta dissertativa do aluno
CREATE TABLE IF NOT EXISTS "respostas_dissertativas" (
    "id" UUID NOT NULL,
    "exercicio_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "texto" TEXT NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "respostas_dissertativas_pkey" PRIMARY KEY ("id")
);

-- Correção e nota por aluno/exercício
CREATE TABLE IF NOT EXISTS "resultados_exercicio" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "exercicio_id" UUID NOT NULL,
    "sql_correto" BOOLEAN,
    "mer_avaliacao" DECIMAL(5,2),
    "dissertativa_avaliacao" DECIMAL(5,2),
    "acertos" INTEGER NOT NULL DEFAULT 0,
    "erros" INTEGER NOT NULL DEFAULT 0,
    "pontuacao" DECIMAL(5,2),
    "revisado" BOOLEAN NOT NULL DEFAULT false,
    "revisado_em" TIMESTAMP(3),
    "revisado_por" UUID,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resultados_exercicio_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "resultados_exercicio_usuario_id_exercicio_id_key"
    ON "resultados_exercicio"("usuario_id", "exercicio_id");

-- Chaves estrangeiras (ADD CONSTRAINT não tem IF NOT EXISTS no PostgreSQL).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'respostas_dissertativas_exercicio_id_fkey') THEN
    ALTER TABLE "respostas_dissertativas" ADD CONSTRAINT "respostas_dissertativas_exercicio_id_fkey"
      FOREIGN KEY ("exercicio_id") REFERENCES "exercicios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'respostas_dissertativas_usuario_id_fkey') THEN
    ALTER TABLE "respostas_dissertativas" ADD CONSTRAINT "respostas_dissertativas_usuario_id_fkey"
      FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'resultados_exercicio_usuario_id_fkey') THEN
    ALTER TABLE "resultados_exercicio" ADD CONSTRAINT "resultados_exercicio_usuario_id_fkey"
      FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'resultados_exercicio_exercicio_id_fkey') THEN
    ALTER TABLE "resultados_exercicio" ADD CONSTRAINT "resultados_exercicio_exercicio_id_fkey"
      FOREIGN KEY ("exercicio_id") REFERENCES "exercicios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
