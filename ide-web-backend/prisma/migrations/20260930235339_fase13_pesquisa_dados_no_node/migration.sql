-- CreateEnum
CREATE TYPE "Ambiente" AS ENUM ('ide_web', 'ferramentas_tradicionais');

-- CreateEnum
CREATE TYPE "Grupo" AS ENUM ('controle', 'experimental');

-- CreateTable
CREATE TABLE "pesquisas" (
    "id" UUID NOT NULL,
    "turma_id" UUID NOT NULL,
    "exercicio_ids" TEXT[],
    "iniciada_por" UUID NOT NULL,
    "iniciada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grupos_sorteados_em" TIMESTAMP(3),
    "encerrada_em" TIMESTAMP(3),

    CONSTRAINT "pesquisas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tcle_consentimentos" (
    "id" UUID NOT NULL,
    "pesquisa_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "aceito" BOOLEAN NOT NULL,
    "versao_termo" TEXT NOT NULL,
    "respondido_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tcle_consentimentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alocacoes_grupo" (
    "id" UUID NOT NULL,
    "pesquisa_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "grupo" "Grupo" NOT NULL,
    "alocado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alocacoes_grupo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessoes_uso" (
    "id" UUID NOT NULL,
    "pesquisa_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "ambiente" "Ambiente" NOT NULL,
    "iniciada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizada_em" TIMESTAMP(3),

    CONSTRAINT "sessoes_uso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "respostas_sus" (
    "id" UUID NOT NULL,
    "sessao_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "itens" JSONB NOT NULL,
    "pontuacao_sus" DECIMAL(5,2) NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "respostas_sus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "respostas_rtlx" (
    "id" UUID NOT NULL,
    "sessao_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "dimensoes" JSONB NOT NULL,
    "pontuacao_rtlx" DECIMAL(5,2) NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "respostas_rtlx_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- No máximo uma pesquisa ativa (não encerrada) por turma — Prisma não expressa índice
-- único parcial no schema, então este WHERE foi adicionado à mão (mesma regra que
-- existia no backend Python, ver pesquisa-backend/app/models.py::Pesquisa).
CREATE UNIQUE INDEX "uq_pesquisas_ativa_por_turma" ON "pesquisas"("turma_id") WHERE "encerrada_em" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "tcle_consentimentos_pesquisa_id_usuario_id_key" ON "tcle_consentimentos"("pesquisa_id", "usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "alocacoes_grupo_pesquisa_id_usuario_id_key" ON "alocacoes_grupo"("pesquisa_id", "usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessoes_uso_pesquisa_id_usuario_id_key" ON "sessoes_uso"("pesquisa_id", "usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "respostas_sus_sessao_id_key" ON "respostas_sus"("sessao_id");

-- CreateIndex
CREATE UNIQUE INDEX "respostas_rtlx_sessao_id_key" ON "respostas_rtlx"("sessao_id");

-- AddForeignKey
ALTER TABLE "pesquisas" ADD CONSTRAINT "pesquisas_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pesquisas" ADD CONSTRAINT "pesquisas_iniciada_por_fkey" FOREIGN KEY ("iniciada_por") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tcle_consentimentos" ADD CONSTRAINT "tcle_consentimentos_pesquisa_id_fkey" FOREIGN KEY ("pesquisa_id") REFERENCES "pesquisas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tcle_consentimentos" ADD CONSTRAINT "tcle_consentimentos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alocacoes_grupo" ADD CONSTRAINT "alocacoes_grupo_pesquisa_id_fkey" FOREIGN KEY ("pesquisa_id") REFERENCES "pesquisas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alocacoes_grupo" ADD CONSTRAINT "alocacoes_grupo_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessoes_uso" ADD CONSTRAINT "sessoes_uso_pesquisa_id_fkey" FOREIGN KEY ("pesquisa_id") REFERENCES "pesquisas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessoes_uso" ADD CONSTRAINT "sessoes_uso_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respostas_sus" ADD CONSTRAINT "respostas_sus_sessao_id_fkey" FOREIGN KEY ("sessao_id") REFERENCES "sessoes_uso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respostas_rtlx" ADD CONSTRAINT "respostas_rtlx_sessao_id_fkey" FOREIGN KEY ("sessao_id") REFERENCES "sessoes_uso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
