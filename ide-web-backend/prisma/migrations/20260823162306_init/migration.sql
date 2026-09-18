-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Papel" AS ENUM ('aluno', 'professor', 'pesquisador');

-- CreateEnum
CREATE TYPE "Grupo" AS ENUM ('controle', 'experimental');

-- CreateEnum
CREATE TYPE "NivelDificuldade" AS ENUM ('iniciante', 'intermediario');

-- CreateEnum
CREATE TYPE "ResultadoStatus" AS ENUM ('sucesso', 'erro_sintaxe', 'erro_execucao');

-- CreateEnum
CREATE TYPE "ContextoDica" AS ENUM ('mer', 'sql');

-- CreateEnum
CREATE TYPE "Ambiente" AS ENUM ('ide_web', 'ferramentas_tradicionais');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha_hash" TEXT NOT NULL,
    "papel" "Papel" NOT NULL,
    "matricula" TEXT,
    "turma_id" UUID,
    "grupo" "Grupo",
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turmas" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "disciplina" TEXT NOT NULL DEFAULT 'Banco de Dados',
    "semestre" TEXT NOT NULL,
    "professor_id" UUID NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "turmas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exercicios" (
    "id" UUID NOT NULL,
    "turma_id" UUID NOT NULL,
    "titulo" TEXT NOT NULL,
    "enunciado" TEXT NOT NULL,
    "nivel_dificuldade" "NivelDificuldade" NOT NULL,
    "mer_gabarito" JSONB,
    "sql_gabarito" TEXT,
    "ordem" INTEGER NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exercicios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagramas_mer" (
    "id" UUID NOT NULL,
    "exercicio_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "conteudo_json" JSONB NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diagramas_mer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissoes_sql" (
    "id" UUID NOT NULL,
    "exercicio_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "query_sql" TEXT NOT NULL,
    "resultado_status" "ResultadoStatus" NOT NULL,
    "linhas_retornadas" INTEGER,
    "tempo_execucao_ms" INTEGER,
    "correta" BOOLEAN,
    "tentativa_numero" INTEGER NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submissoes_sql_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dicas_ia" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "exercicio_id" UUID NOT NULL,
    "contexto" "ContextoDica" NOT NULL,
    "estado_enviado" JSONB NOT NULL,
    "prompt_montado" TEXT NOT NULL,
    "resposta_ia" TEXT NOT NULL,
    "modelo_llm" TEXT NOT NULL,
    "tokens_usados" INTEGER,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dicas_ia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessoes_uso" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "exercicio_id" UUID NOT NULL,
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

-- CreateTable
CREATE TABLE "tcle_consentimentos" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "aceito" BOOLEAN NOT NULL,
    "versao_termo" TEXT NOT NULL,
    "ip_registro" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tcle_consentimentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logs_execucao_sql" (
    "id" UUID NOT NULL,
    "submissao_id" UUID NOT NULL,
    "explain_json" JSONB NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logs_execucao_sql_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "respostas_sus_sessao_id_key" ON "respostas_sus"("sessao_id");

-- CreateIndex
CREATE UNIQUE INDEX "respostas_rtlx_sessao_id_key" ON "respostas_rtlx"("sessao_id");

-- CreateIndex
CREATE UNIQUE INDEX "tcle_consentimentos_usuario_id_key" ON "tcle_consentimentos"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "logs_execucao_sql_submissao_id_key" ON "logs_execucao_sql"("submissao_id");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turmas" ADD CONSTRAINT "turmas_professor_id_fkey" FOREIGN KEY ("professor_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercicios" ADD CONSTRAINT "exercicios_turma_id_fkey" FOREIGN KEY ("turma_id") REFERENCES "turmas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagramas_mer" ADD CONSTRAINT "diagramas_mer_exercicio_id_fkey" FOREIGN KEY ("exercicio_id") REFERENCES "exercicios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagramas_mer" ADD CONSTRAINT "diagramas_mer_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissoes_sql" ADD CONSTRAINT "submissoes_sql_exercicio_id_fkey" FOREIGN KEY ("exercicio_id") REFERENCES "exercicios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissoes_sql" ADD CONSTRAINT "submissoes_sql_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dicas_ia" ADD CONSTRAINT "dicas_ia_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dicas_ia" ADD CONSTRAINT "dicas_ia_exercicio_id_fkey" FOREIGN KEY ("exercicio_id") REFERENCES "exercicios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessoes_uso" ADD CONSTRAINT "sessoes_uso_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessoes_uso" ADD CONSTRAINT "sessoes_uso_exercicio_id_fkey" FOREIGN KEY ("exercicio_id") REFERENCES "exercicios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respostas_sus" ADD CONSTRAINT "respostas_sus_sessao_id_fkey" FOREIGN KEY ("sessao_id") REFERENCES "sessoes_uso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respostas_sus" ADD CONSTRAINT "respostas_sus_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respostas_rtlx" ADD CONSTRAINT "respostas_rtlx_sessao_id_fkey" FOREIGN KEY ("sessao_id") REFERENCES "sessoes_uso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "respostas_rtlx" ADD CONSTRAINT "respostas_rtlx_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tcle_consentimentos" ADD CONSTRAINT "tcle_consentimentos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logs_execucao_sql" ADD CONSTRAINT "logs_execucao_sql_submissao_id_fkey" FOREIGN KEY ("submissao_id") REFERENCES "submissoes_sql"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

