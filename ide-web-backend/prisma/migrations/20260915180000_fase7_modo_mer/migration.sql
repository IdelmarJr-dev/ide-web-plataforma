-- Fase 7: nível da modelagem por exercício (docs/decisions/fase7-modelagem-conceitual-logica.md).
-- O conteúdo de exercicios.mer_gabarito e diagramas_mer.conteudo_json passa ao documento de
-- modelagem versão 2; diagramas no formato antigo abrem vazios (sem uso real a migrar).
CREATE TYPE "ModoMer" AS ENUM ('conceitual', 'logico', 'conceitual_logico', 'aluno_escolhe');

ALTER TABLE "exercicios" ADD COLUMN "modo_mer" "ModoMer" NOT NULL DEFAULT 'conceitual_logico';
