import { ForbiddenError, NotFoundError } from '../errors';
import type { DiagramaMer, Prisma } from '../generated/prisma/client';
import type { DiagramaMerRepository } from '../repositories/DiagramaMerRepository';
import type { ExercicioRepository } from '../repositories/ExercicioRepository';
import type { TurmaRepository } from '../repositories/TurmaRepository';
import type { AcessoExercicioService } from './AcessoExercicioService';

export class DiagramaMerService {
  constructor(
    private readonly diagramaMerRepository: DiagramaMerRepository,
    private readonly exercicioRepository: ExercicioRepository,
    private readonly acessoExercicio: AcessoExercicioService,
    private readonly turmaRepository: TurmaRepository,
  ) {}

  async salvar(usuarioId: string, exercicioId: string, conteudoJson: Prisma.InputJsonValue): Promise<DiagramaMer> {
    await this.acessoExercicio.exigirEntrega(usuarioId, exercicioId);
    return this.diagramaMerRepository.upsert(exercicioId, usuarioId, conteudoJson);
  }

  async buscar(usuarioId: string, exercicioId: string): Promise<DiagramaMer | null> {
    await this.acessoExercicio.exigirLeitura(usuarioId, exercicioId);
    return this.diagramaMerRepository.findByExercicioEUsuario(exercicioId, usuarioId);
  }

  /**
   * Leitura do modelo de um aluno pelo professor da turma (tela de revisão) — só leitura,
   * o professor nunca escreve no diagrama do aluno.
   */
  async buscarDoAluno(professorId: string, exercicioId: string, alunoId: string): Promise<DiagramaMer | null> {
    const exercicio = await this.exercicioRepository.findById(exercicioId);
    if (!exercicio) {
      throw new NotFoundError('Exercício');
    }

    const turma = await this.turmaRepository.findById(exercicio.turma_id);
    if (turma?.professor_id !== professorId) {
      throw new ForbiddenError('Você não é o professor deste exercício');
    }

    return this.diagramaMerRepository.findByExercicioEUsuario(exercicioId, alunoId);
  }
}
