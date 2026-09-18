import type { Prova } from '../generated/prisma/client';
import { prisma } from '../lib/prisma';

export interface CreateProvaInput {
  turma_id: string;
  titulo: string;
}

export interface ProvaRepository {
  findById(id: string): Promise<Prova | null>;
  findByTurmaId(turmaId: string): Promise<Prova[]>;
  create(input: CreateProvaInput): Promise<Prova>;
}

export class PrismaProvaRepository implements ProvaRepository {
  findById(id: string): Promise<Prova | null> {
    return prisma.prova.findUnique({ where: { id } });
  }

  findByTurmaId(turmaId: string): Promise<Prova[]> {
    return prisma.prova.findMany({ where: { turma_id: turmaId }, orderBy: { criado_em: 'asc' } });
  }

  create(input: CreateProvaInput): Promise<Prova> {
    return prisma.prova.create({ data: input });
  }
}
