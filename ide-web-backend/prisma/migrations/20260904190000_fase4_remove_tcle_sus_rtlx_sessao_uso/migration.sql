-- Fase 4: TcleConsentimento, RespostaSus, RespostaRtlx e SessaoUso migram para o
-- backend Python self-hosted (dado de sujeito de pesquisa — ver
-- docs/decisions/fase4-pesquisa-python-sessao-aluno-login.md e a restrição
-- não-negociável no CLAUDE.md). Removidas do banco principal (Supabase).

-- DropForeignKey
ALTER TABLE "respostas_sus" DROP CONSTRAINT IF EXISTS "respostas_sus_sessao_id_fkey";
ALTER TABLE "respostas_sus" DROP CONSTRAINT IF EXISTS "respostas_sus_usuario_id_fkey";
ALTER TABLE "respostas_rtlx" DROP CONSTRAINT IF EXISTS "respostas_rtlx_sessao_id_fkey";
ALTER TABLE "respostas_rtlx" DROP CONSTRAINT IF EXISTS "respostas_rtlx_usuario_id_fkey";
ALTER TABLE "sessoes_uso" DROP CONSTRAINT IF EXISTS "sessoes_uso_usuario_id_fkey";
ALTER TABLE "sessoes_uso" DROP CONSTRAINT IF EXISTS "sessoes_uso_exercicio_id_fkey";
ALTER TABLE "tcle_consentimentos" DROP CONSTRAINT IF EXISTS "tcle_consentimentos_usuario_id_fkey";

-- DropTable
DROP TABLE IF EXISTS "respostas_sus";
DROP TABLE IF EXISTS "respostas_rtlx";
DROP TABLE IF EXISTS "sessoes_uso";
DROP TABLE IF EXISTS "tcle_consentimentos";

-- DropEnum
DROP TYPE IF EXISTS "Ambiente";
