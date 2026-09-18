import type { Exercicio, NivelDificuldade, Prisma } from '../generated/prisma/client';
import { prisma } from '../lib/prisma';

export interface CreateExercicioInput {
  turma_id: string;
  prova_id?: string | null;
  titulo: string;
  enunciado: string;
  nivel_dificuldade: Exercicio['nivel_dificuldade'];
  ordem: number;
  prazo?: Date | null;
  publico?: boolean;
  mer_gabarito?: Prisma.InputJsonValue;
  modo_mer?: Exercicio['modo_mer'];
  sql_gabarito?: string;
  sql_setup?: string;
  gabarito_dissertativo?: string;
}

export type UpdateExercicioInput = Partial<Omit<CreateExercicioInput, 'turma_id'>>;

export interface ExercicioRepository {
  findById(id: string): Promise<Exercicio | null>;
  findByTurmaId(turmaId: string): Promise<Exercicio[]>;
  proximaOrdem(turmaId: string): Promise<number>;
  findSemProva(turmaId: string, nivel?: NivelDificuldade): Promise<Exercicio[]>;
  vincularAProva(exercicioIds: string[], provaId: string, prazo: Date | null): Promise<number>;
  findPublicos(): Promise<Exercicio[]>;
  findByIds(ids: string[]): Promise<Exercicio[]>;
  create(input: CreateExercicioInput): Promise<Exercicio>;
  update(id: string, input: UpdateExercicioInput): Promise<Exercicio>;
  // `liberadoEm: null` oculta de novo (professor que liberou por engano).
  definirGabaritoLiberado(id: string, liberadoEm: Date | null): Promise<Exercicio>;
}

export class PrismaExercicioRepository implements ExercicioRepository {
  findById(id: string): Promise<Exercicio | null> {
    return prisma.exercicio.findUnique({ where: { id } });
  }

  findByTurmaId(turmaId: string): Promise<Exercicio[]> {
    return prisma.exercicio.findMany({ where: { turma_id: turmaId }, orderBy: { ordem: 'asc' } });
  }

  /**
   * Acervo disponível pra montar prova: `Exercicio.prova_id` é único, então montar uma
   * prova é distribuir exercícios que ainda não pertencem a nenhuma (Fase 10, D13).
   */
  findSemProva(turmaId: string, nivel?: NivelDificuldade): Promise<Exercicio[]> {
    return prisma.exercicio.findMany({
      where: { turma_id: turmaId, prova_id: null, ...(nivel ? { nivel_dificuldade: nivel } : {}) },
      orderBy: { ordem: 'asc' },
    });
  }

  async vincularAProva(exercicioIds: string[], provaId: string, prazo: Date | null): Promise<number> {
    const { count } = await prisma.exercicio.updateMany({
      where: { id: { in: exercicioIds } },
      data: { prova_id: provaId, ...(prazo === null ? {} : { prazo }) },
    });

    return count;
  }

  /**
   * Próxima posição livre da turma. O professor não inventa mais esse número à mão:
   * "ordem" só diz onde o exercício aparece na lista (Fase 10, D12).
   */
  async proximaOrdem(turmaId: string): Promise<number> {
    const agregado = await prisma.exercicio.aggregate({
      where: { turma_id: turmaId },
      _max: { ordem: true },
    });

    return (agregado._max.ordem ?? 0) + 1;
  }

  findPublicos(): Promise<Exercicio[]> {
    return prisma.exercicio.findMany({
      where: { publico: true },
      orderBy: [{ nivel_dificuldade: 'asc' }, { ordem: 'asc' }],
    });
  }

  findByIds(ids: string[]): Promise<Exercicio[]> {
    return prisma.exercicio.findMany({ where: { id: { in: ids } } });
  }

  create(input: CreateExercicioInput): Promise<Exercicio> {
    return prisma.exercicio.create({ data: input });
  }

  update(id: string, input: UpdateExercicioInput): Promise<Exercicio> {
    return prisma.exercicio.update({ where: { id }, data: input });
  }

  definirGabaritoLiberado(id: string, liberadoEm: Date | null): Promise<Exercicio> {
    return prisma.exercicio.update({
      where: { id },
      data: { gabarito_liberado: liberadoEm !== null, gabarito_liberado_em: liberadoEm },
    });
  }
}
