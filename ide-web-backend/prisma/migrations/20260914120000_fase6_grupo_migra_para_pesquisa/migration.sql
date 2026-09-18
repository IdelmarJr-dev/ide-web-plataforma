-- Fase 6: grupo controle/experimental deixa o banco principal (Supabase) e passa a ser
-- sorteado e guardado no backend de pesquisa self-hosted, depois do TCLE
-- (docs/decisions/fase6-alinhamento-tcc.md). Sem dado real de coleta até aqui.

-- AlterTable
ALTER TABLE "usuarios" DROP COLUMN "grupo";

-- DropEnum
DROP TYPE "Grupo";
