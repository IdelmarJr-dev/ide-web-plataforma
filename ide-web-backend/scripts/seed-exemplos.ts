/**
 * Cria as contas de teste (professor/aluno) e um exemplo de interação (turma +
 * exercício + matrícula + submissão) pra demonstração da aplicação. Idempotente:
 * roda de novo sem duplicar nada (upsert por e-mail/chave composta, find-then-create
 * pra turma/exercício). Dado de demonstração — não usar como semente de produção.
 *
 * Uso: npx tsx scripts/seed-exemplos.ts
 */
import type { Exercicio, Turma, Usuario } from '../src/generated/prisma/client';
import { prisma } from '../src/lib/prisma';
import { logger } from '../src/utils/logger';
import { hashPassword } from '../src/utils/password';

const CODIGO_TURMA_DEMO = 'DEMO01';
const PONTUACAO_MAXIMA = 10;

async function upsertUsuario(nome: string, email: string, senha: string, papel: 'professor' | 'aluno'): Promise<Usuario> {
  const senha_hash = await hashPassword(senha);
  return prisma.usuario.upsert({
    where: { email },
    create: { nome, email, senha_hash, papel },
    update: { nome, senha_hash, papel },
  });
}

async function obterTurmaDemo(professorId: string): Promise<Turma> {
  const existente = await prisma.turma.findUnique({ where: { codigo: CODIGO_TURMA_DEMO } });
  if (existente) return existente;

  return prisma.turma.create({
    data: {
      nome: 'Turma de Demonstração',
      semestre: '2026.2',
      professor_id: professorId,
      codigo: CODIGO_TURMA_DEMO,
    },
  });
}

async function obterExercicioDemo(turmaId: string): Promise<Exercicio> {
  const existente = await prisma.exercicio.findFirst({ where: { turma_id: turmaId, titulo: 'Clientes ativos' } });
  if (existente) return existente;

  return prisma.exercicio.create({
    data: {
      turma_id: turmaId,
      titulo: 'Clientes ativos',
      enunciado:
        'Escreva uma consulta que liste nome e e-mail de todos os clientes ativos (coluna "ativo" = true), em ordem alfabética pelo nome.',
      nivel_dificuldade: 'iniciante',
      sql_setup:
        "CREATE TABLE clientes (\n  id SERIAL PRIMARY KEY,\n  nome TEXT NOT NULL,\n  email TEXT NOT NULL,\n  ativo BOOLEAN NOT NULL DEFAULT true\n);\n\nINSERT INTO clientes (nome, email, ativo) VALUES\n  ('Ana Souza', 'ana.souza@exemplo.com', true),\n  ('Bruno Lima', 'bruno.lima@exemplo.com', false),\n  ('Carla Dias', 'carla.dias@exemplo.com', true);",
      sql_gabarito: 'SELECT nome, email FROM clientes WHERE ativo = true ORDER BY nome;',
      gabarito_liberado: true,
      gabarito_liberado_em: new Date(),
      ordem: 1,
    },
  });
}

async function main(): Promise<void> {
  const professor = await upsertUsuario('Professor Teste', 'professor.teste@ide-web.local', 'Teste@Prof123', 'professor');
  const aluno = await upsertUsuario('Aluno Teste', 'aluno.teste@ide-web.local', 'Teste@Aluno123', 'aluno');

  const turma = await obterTurmaDemo(professor.id);

  await prisma.matriculaTurma.upsert({
    where: { aluno_id_turma_id: { aluno_id: aluno.id, turma_id: turma.id } },
    create: { aluno_id: aluno.id, turma_id: turma.id },
    update: {},
  });

  const exercicio = await obterExercicioDemo(turma.id);

  const jaSubmeteu = await prisma.submissaoSql.findFirst({ where: { exercicio_id: exercicio.id, usuario_id: aluno.id } });
  if (!jaSubmeteu) {
    await prisma.submissaoSql.create({
      data: {
        exercicio_id: exercicio.id,
        usuario_id: aluno.id,
        query_sql: 'SELECT nome, email FROM clientes WHERE ativo = true ORDER BY nome;',
        resultado_status: 'sucesso',
        linhas_retornadas: 2,
        correta: true,
        tentativa_numero: 1,
      },
    });
  }

  await prisma.resultadoExercicio.upsert({
    where: { usuario_id_exercicio_id: { usuario_id: aluno.id, exercicio_id: exercicio.id } },
    create: { usuario_id: aluno.id, exercicio_id: exercicio.id, sql_correto: true, acertos: 1, pontuacao: PONTUACAO_MAXIMA },
    update: { sql_correto: true, acertos: 1, pontuacao: PONTUACAO_MAXIMA },
  });

  logger.info('Exemplos de demonstração prontos', {
    professorEmail: professor.email,
    alunoEmail: aluno.email,
    turmaCodigo: turma.codigo,
    exercicioId: exercicio.id,
  });
}

main()
  .catch((error: unknown) => {
    logger.error('Falha ao criar exemplos de demonstração', {
      message: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
