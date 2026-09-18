import type { MatriculaTurma, Usuario } from '../generated/prisma/client';
import { prisma } from '../lib/prisma';

export interface MatriculaRepository {
  findByAlunoETurma(alunoId: string, turmaId: string): Promise<MatriculaTurma | null>;
  findByAlunoId(alunoId: string): Promise<MatriculaTurma[]>;
  findByTurmaId(turmaId: string): Promise<MatriculaTurma[]>;
  findAlunosDaTurma(turmaId: string): Promise<Usuario[]>;
  criar(alunoId: string, turmaId: string): Promise<MatriculaTurma>;
  definirProva(id: string, provaId: string): Promise<MatriculaTurma>;
}

export class PrismaMatriculaRepository implements MatriculaRepository {
  findByAlunoETurma(alunoId: string, turmaId: string): Promise<MatriculaTurma | null> {
    return prisma.matriculaTurma.findUnique({
      where: { aluno_id_turma_id: { aluno_id: alunoId, turma_id: turmaId } },
    });
  }

  findByAlunoId(alunoId: string): Promise<MatriculaTurma[]> {
    return prisma.matriculaTurma.findMany({ where: { aluno_id: alunoId }, orderBy: { criado_em: 'desc' } });
  }

  findByTurmaId(turmaId: string): Promise<MatriculaTurma[]> {
    return prisma.matriculaTurma.findMany({ where: { turma_id: turmaId }, orderBy: { criado_em: 'asc' } });
  }

  async findAlunosDaTurma(turmaId: string): Promise<Usuario[]> {
    const matriculas = await prisma.matriculaTurma.findMany({
      where: { turma_id: turmaId },
      include: { aluno: true },
      orderBy: { aluno: { nome: 'asc' } },
    });
    return matriculas.map((matricula) => matricula.aluno);
  }

  criar(alunoId: string, turmaId: string): Promise<MatriculaTurma> {
    return prisma.matriculaTurma.create({ data: { aluno_id: alunoId, turma_id: turmaId } });
  }

  definirProva(id: string, provaId: string): Promise<MatriculaTurma> {
    return prisma.matriculaTurma.update({ where: { id }, data: { prova_id: provaId } });
  }
}
