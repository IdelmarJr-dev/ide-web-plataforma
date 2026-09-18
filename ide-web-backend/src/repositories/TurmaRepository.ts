import type { Turma, Turno } from '../generated/prisma/client';
import { prisma } from '../lib/prisma';

export interface CreateTurmaInput {
  nome: string;
  disciplina?: string;
  semestre: string;
  turno?: Turno;
  sala?: string;
  professor_id: string;
  codigo: string;
}

export interface TurmaRepository {
  findById(id: string): Promise<Turma | null>;
  findByCodigo(codigo: string): Promise<Turma | null>;
  findByProfessorId(professorId: string): Promise<Turma[]>;
  findAll(): Promise<Turma[]>;
  create(input: CreateTurmaInput): Promise<Turma>;
  definirEncerramento(id: string, encerradaEm: Date | null): Promise<Turma>;
}

export class PrismaTurmaRepository implements TurmaRepository {
  findById(id: string): Promise<Turma | null> {
    return prisma.turma.findUnique({ where: { id } });
  }

  findByCodigo(codigo: string): Promise<Turma | null> {
    return prisma.turma.findUnique({ where: { codigo } });
  }

  findByProfessorId(professorId: string): Promise<Turma[]> {
    return prisma.turma.findMany({ where: { professor_id: professorId }, orderBy: { criado_em: 'desc' } });
  }

  findAll(): Promise<Turma[]> {
    return prisma.turma.findMany({ orderBy: { criado_em: 'desc' } });
  }

  create(input: CreateTurmaInput): Promise<Turma> {
    return prisma.turma.create({ data: input });
  }

  definirEncerramento(id: string, encerradaEm: Date | null): Promise<Turma> {
    return prisma.turma.update({ where: { id }, data: { encerrada_em: encerradaEm } });
  }
}
