-- CreateEnum
CREATE TYPE "Turno" AS ENUM ('manha', 'tarde', 'noite');

-- AlterTable
ALTER TABLE "exercicios" ADD COLUMN     "prazo" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "resultados_exercicio" ADD COLUMN     "envio_liberado_em" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "turmas" ADD COLUMN     "sala" TEXT,
ADD COLUMN     "turno" "Turno";

-- CreateTable
CREATE TABLE "sessoes_auth" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "criada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultima_atividade_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revogada_em" TIMESTAMP(3),

    CONSTRAINT "sessoes_auth_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sessoes_auth_usuario_id_idx" ON "sessoes_auth"("usuario_id");

-- AddForeignKey
ALTER TABLE "sessoes_auth" ADD CONSTRAINT "sessoes_auth_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Fase 10, D6: a escala passa de 0-100 para 0,0-10,0. Decimal(5,2) já comporta, então
-- só o dado existente precisa mudar. Irreversível sem backup (ver Riscos da fase).
UPDATE "resultados_exercicio"
SET "mer_avaliacao" = "mer_avaliacao" / 10
WHERE "mer_avaliacao" IS NOT NULL AND "mer_avaliacao" > 10;

UPDATE "resultados_exercicio"
SET "dissertativa_avaliacao" = "dissertativa_avaliacao" / 10
WHERE "dissertativa_avaliacao" IS NOT NULL AND "dissertativa_avaliacao" > 10;

UPDATE "resultados_exercicio"
SET "pontuacao" = "pontuacao" / 10
WHERE "pontuacao" IS NOT NULL AND "pontuacao" > 10;
