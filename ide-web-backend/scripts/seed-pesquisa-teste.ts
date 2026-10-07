/**
 * Prepara o terreno pra simular a pesquisa do TCC de ponta a ponta: turma dedicada
 * (PESQ01), 2 exercícios de SQL com gabarito, e 6 contas de aluno — a "Aluno Teste"
 * (de seed-exemplos.ts) renomeada pra "Aluno Teste 01" e mais 5 em sequência (02–06),
 * pra ficar fácil acompanhar quem caiu em cada grupo depois do sorteio.
 *
 * Este script só monta o cenário estático (turma, exercícios, matrículas). O ciclo da
 * pesquisa em si (TCLE, sorteio, sessão, SUS, RTLX) é conduzido via HTTP de verdade por
 * scripts/e2e-pesquisa-smoke.ts, contra o backend rodando (`npm run dev`) — é o que
 * exercita as rotas reais, não um atalho direto no banco.
 *
 * O pesquisador NÃO é criado aqui — é a conta única do autor (ver seed-pesquisador.ts),
 * nunca com senha hardcoded. Rode seed-pesquisador.ts com suas próprias variáveis de
 * ambiente locais antes deste script.
 *
 * Uso: npx tsx scripts/seed-exemplos.ts && npx tsx scripts/seed-pesquisa-teste.ts
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Exercicio, Turma, Usuario } from '../src/generated/prisma/client';
import { prisma } from '../src/lib/prisma';
import { logger } from '../src/utils/logger';
import { hashPassword } from '../src/utils/password';

// Ponte pro scripts/e2e-pesquisa-smoke.ts: os IDs são gerados pelo banco, então em vez
// de hardcodar UUID no script de E2E, este seed grava o que criou aqui. Arquivo local,
// sem dado sensível (só ids e e-mails de contas de teste) — fica de fora do git (ver
// .gitignore de scripts/).
const ARQUIVO_CENARIO = join(__dirname, '.pesquisa-teste-cenario.json');
const INDENTACAO_JSON = 2;

const CODIGO_TURMA_PESQUISA = 'PESQ01';
const EMAIL_PROFESSOR_DEMO = 'professor.teste@ide-web.local';
const EMAIL_ALUNO_DEMO = 'aluno.teste@ide-web.local';
const QUANTIDADE_ALUNOS = 6;
const DIGITOS_NUMERO_ALUNO = 2;

interface AlunoPesquisaSeed {
  numero: number;
  nome: string;
  email: string;
  senha: string;
}

function montarAlunos(): AlunoPesquisaSeed[] {
  return Array.from({ length: QUANTIDADE_ALUNOS }, (_, indice) => {
    const numero = indice + 1;
    const sufixo = String(numero).padStart(DIGITOS_NUMERO_ALUNO, '0');
    return {
      numero,
      nome: `Aluno Teste ${sufixo}`,
      // O primeiro (01) é o mesmo e-mail de seed-exemplos.ts — mesma conta, só o nome
      // muda pra entrar na sequência. Os demais (02–06) são contas novas.
      email: numero === 1 ? EMAIL_ALUNO_DEMO : `aluno.teste${sufixo}@ide-web.local`,
      senha: `Teste@Aluno${sufixo}`,
    };
  });
}

async function obterProfessorDemo(): Promise<Usuario> {
  const professor = await prisma.usuario.findUnique({ where: { email: EMAIL_PROFESSOR_DEMO } });
  if (professor) return professor;

  throw new Error(`Professor de demonstração não encontrado. Rode "npx tsx scripts/seed-exemplos.ts" primeiro.`);
}

async function upsertAluno(seed: AlunoPesquisaSeed): Promise<Usuario> {
  const senha_hash = await hashPassword(seed.senha);
  return prisma.usuario.upsert({
    where: { email: seed.email },
    create: { nome: seed.nome, email: seed.email, senha_hash, papel: 'aluno' },
    update: { nome: seed.nome, senha_hash, papel: 'aluno' },
  });
}

async function obterTurmaPesquisa(professorId: string): Promise<Turma> {
  const existente = await prisma.turma.findUnique({ where: { codigo: CODIGO_TURMA_PESQUISA } });
  if (existente) return existente;

  return prisma.turma.create({
    data: {
      nome: 'Turma — simulação de pesquisa',
      semestre: '2026.2',
      professor_id: professorId,
      codigo: CODIGO_TURMA_PESQUISA,
    },
  });
}

async function upsertExercicioPesquisa(
  turmaId: string,
  titulo: string,
  dados: Pick<Exercicio, 'enunciado' | 'nivel_dificuldade' | 'sql_setup' | 'sql_gabarito' | 'ordem'>,
): Promise<Exercicio> {
  const existente = await prisma.exercicio.findFirst({ where: { turma_id: turmaId, titulo } });
  if (existente) {
    return prisma.exercicio.update({
      where: { id: existente.id },
      data: { ...dados, gabarito_liberado: true, gabarito_liberado_em: existente.gabarito_liberado_em ?? new Date() },
    });
  }

  return prisma.exercicio.create({
    data: { turma_id: turmaId, titulo, ...dados, gabarito_liberado: true, gabarito_liberado_em: new Date() },
  });
}

async function main(): Promise<void> {
  const professor = await obterProfessorDemo();
  const turma = await obterTurmaPesquisa(professor.id);

  const alunos: Usuario[] = [];
  for (const seed of montarAlunos()) {
    const aluno = await upsertAluno(seed);
    alunos.push(aluno);

    await prisma.matriculaTurma.upsert({
      where: { aluno_id_turma_id: { aluno_id: aluno.id, turma_id: turma.id } },
      create: { aluno_id: aluno.id, turma_id: turma.id },
      update: {},
    });
  }

  const exercicio1 = await upsertExercicioPesquisa(turma.id, '[Pesquisa] Livros por autor', {
    enunciado: 'Escreva uma consulta que liste o título de todos os livros do autor "J.R.R. Tolkien".',
    nivel_dificuldade: 'iniciante',
    sql_setup:
      'CREATE TABLE autores (id SERIAL PRIMARY KEY, nome TEXT NOT NULL);\n' +
      'CREATE TABLE livros (id SERIAL PRIMARY KEY, titulo TEXT NOT NULL, autor_id INTEGER NOT NULL REFERENCES autores(id));\n\n' +
      "INSERT INTO autores (nome) VALUES ('J.R.R. Tolkien'), ('George Orwell');\n" +
      "INSERT INTO livros (titulo, autor_id) VALUES ('O Hobbit', 1), ('O Senhor dos Anéis', 1), ('1984', 2);",
    sql_gabarito:
      "SELECT l.titulo FROM livros l JOIN autores a ON a.id = l.autor_id WHERE a.nome = 'J.R.R. Tolkien';",
    ordem: 1,
  });

  const exercicio2 = await upsertExercicioPesquisa(turma.id, '[Pesquisa] Alunos aprovados', {
    enunciado:
      'Escreva uma consulta que liste nome e média de todos os alunos com média maior ou igual a 7, ' +
      'em ordem decrescente de média.',
    nivel_dificuldade: 'intermediario',
    sql_setup:
      'CREATE TABLE alunos_disciplina (id SERIAL PRIMARY KEY, nome TEXT NOT NULL, media NUMERIC(4,2) NOT NULL);\n\n' +
      "INSERT INTO alunos_disciplina (nome, media) VALUES ('Ana', 8.5), ('Bruno', 6.0), ('Carla', 7.0), ('Diego', 9.2);",
    sql_gabarito: 'SELECT nome, media FROM alunos_disciplina WHERE media >= 7 ORDER BY media DESC;',
    ordem: 2,
  });

  const cenario = {
    turmaId: turma.id,
    turmaCodigo: turma.codigo,
    exercicioIds: [exercicio1.id, exercicio2.id],
    alunos: montarAlunos().map(({ nome, email, senha }) => ({ nome, email, senha })),
  };
  writeFileSync(ARQUIVO_CENARIO, JSON.stringify(cenario, null, INDENTACAO_JSON), 'utf-8');

  logger.info('Cenário de pesquisa (teste) pronto', { ...cenario, alunos: alunos.map((aluno) => aluno.email) });
}

main()
  .catch((error: unknown) => {
    logger.error('Falha ao preparar cenário de pesquisa (teste)', {
      message: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
