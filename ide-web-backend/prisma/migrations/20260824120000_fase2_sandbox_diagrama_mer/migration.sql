-- AlterTable
ALTER TABLE "exercicios" ADD COLUMN "sql_setup" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "diagramas_mer_exercicio_id_usuario_id_key" ON "diagramas_mer"("exercicio_id", "usuario_id");
