-- Fase 8, etapa 4 — finalizar deixa de ser efeito colateral do download.
ALTER TABLE "resultados_exercicio" ADD COLUMN "finalizado_em" TIMESTAMP(3);
