-- Fase 5: sorteador de provas — ver docs/decisions/fase5-sorteador-provas.md.

-- CreateTable
CREATE TABLE "provas" (
    "id" UUID NOT NULL,
    "turma_id" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provas_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN "prova_id" UUID;

-- AlterTable
ALTER TABLE "exercicios" ADD COLUMN "prova_id" UUID;

-- AddForeignKey
ALTER TABLE "provas" ADD CONSTRAINT "provas_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_prova_id_fkey" FOREIGN KEY ("prova_id") REFERENCES "provas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercicios" ADD CONSTRAINT "exercicios_prova_id_fkey" FOREIGN KEY ("prova_id") REFERENCES "provas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
