-- Fase 7, etapa 6: o nível da modelagem é definido só pelo professor — o modo
-- "aluno escolhe" saiu (ver docs/decisions/fase7-modelagem-conceitual-logica.md, D2/D3).
-- Postgres não remove valor de enum: recria o tipo e converte quem estiver no valor antigo.
ALTER TYPE "ModoMer" RENAME TO "ModoMer_old";

CREATE TYPE "ModoMer" AS ENUM ('conceitual', 'logico', 'conceitual_logico');

ALTER TABLE "exercicios" ALTER COLUMN "modo_mer" DROP DEFAULT;

ALTER TABLE "exercicios"
  ALTER COLUMN "modo_mer" TYPE "ModoMer"
  USING (CASE WHEN "modo_mer"::text = 'aluno_escolhe' THEN 'conceitual_logico' ELSE "modo_mer"::text END)::"ModoMer";

ALTER TABLE "exercicios" ALTER COLUMN "modo_mer" SET DEFAULT 'conceitual_logico';

DROP TYPE "ModoMer_old";
