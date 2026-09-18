import type { AtualizarExercicioBodyDto, CriarExercicioBodyDto } from '../dtos/exercicio.dto';
import { ForbiddenError, NotFoundError } from '../errors';
import type { Exercicio, Papel, Turma } from '../generated/prisma/client';
import type { ExercicioRepository } from '../repositories/ExercicioRepository';
import type { MatriculaRepository } from '../repositories/MatriculaRepository';
import type { ProvaRepository } from '../repositories/ProvaRepository';
import type { TurmaRepository } from '../repositories/TurmaRepository';
import type { AcessoExercicioService } from './AcessoExercicioService';

export class ExercicioService {
  constructor(
    private readonly exercicioRepository: ExercicioRepository,
    private readonly turmaRepository: TurmaRepository,
    private readonly matriculaRepository: MatriculaRepository,
    private readonly provaRepository: ProvaRepository,
    private readonly acessoExercicio: AcessoExercicioService,
  ) {}

  async criar(professorId: string, input: CriarExercicioBodyDto): Promise<Exercicio> {
    await this.exigirTurmaDoProfessor(input.turmaId, professorId);

    if (input.provaId) {
      await this.exigirProvaDaTurma(input.provaId, input.turmaId);
    }

    return this.exercicioRepository.create({
      turma_id: input.turmaId,
      titulo: input.titulo,
      enunciado: input.enunciado,
      nivel_dificuldade: input.nivelDificuldade,
      ordem: input.ordem ?? (await this.exercicioRepository.proximaOrdem(input.turmaId)),
      ...(input.prazo !== undefined ? { prazo: input.prazo } : {}),
      ...(input.provaId ? { prova_id: input.provaId } : {}),
      ...(input.publico !== undefined ? { publico: input.publico } : {}),
      ...(input.merGabarito !== undefined ? { mer_gabarito: input.merGabarito } : {}),
      ...(input.modoMer !== undefined ? { modo_mer: input.modoMer } : {}),
      ...(input.sqlGabarito !== undefined ? { sql_gabarito: input.sqlGabarito } : {}),
      ...(input.sqlSetup !== undefined ? { sql_setup: input.sqlSetup } : {}),
      ...(input.gabaritoDissertativo !== undefined ? { gabarito_dissertativo: input.gabaritoDissertativo } : {}),
    });
  }

  async atualizar(professorId: string, exercicioId: string, input: AtualizarExercicioBodyDto): Promise<Exercicio> {
    const exercicio = await this.exigirExercicioDoProfessor(exercicioId, professorId);

    if (input.provaId) {
      await this.exigirProvaDaTurma(input.provaId, exercicio.turma_id);
    }

    return this.exercicioRepository.update(exercicio.id, {
      ...(input.titulo !== undefined ? { titulo: input.titulo } : {}),
      ...(input.enunciado !== undefined ? { enunciado: input.enunciado } : {}),
      ...(input.nivelDificuldade !== undefined ? { nivel_dificuldade: input.nivelDificuldade } : {}),
      ...(input.ordem !== undefined ? { ordem: input.ordem } : {}),
      ...(input.provaId !== undefined ? { prova_id: input.provaId } : {}),
      ...(input.prazo !== undefined ? { prazo: input.prazo } : {}),
      ...(input.publico !== undefined ? { publico: input.publico } : {}),
      ...(input.merGabarito !== undefined ? { mer_gabarito: input.merGabarito } : {}),
      ...(input.modoMer !== undefined ? { modo_mer: input.modoMer } : {}),
      ...(input.sqlGabarito !== undefined ? { sql_gabarito: input.sqlGabarito } : {}),
      ...(input.sqlSetup !== undefined ? { sql_setup: input.sqlSetup } : {}),
      ...(input.gabaritoDissertativo !== undefined ? { gabarito_dissertativo: input.gabaritoDissertativo } : {}),
    });
  }

  async listarPorTurma(usuarioId: string, papel: Papel, turmaId: string): Promise<Exercicio[]> {
    await this.exigirAcessoATurma(usuarioId, papel, turmaId);
    const exercicios = await this.exercicioRepository.findByTurmaId(turmaId);

    if (papel !== 'aluno') {
      return exercicios;
    }

    const matricula = await this.matriculaRepository.findByAlunoETurma(usuarioId, turmaId);
    return exercicios.filter(
      (exercicio) => exercicio.prova_id === null || exercicio.prova_id === matricula?.prova_id,
    );
  }

  /** Estudo livre: exercícios que o professor publicou pra qualquer aluno resolver. */
  listarPublicos(): Promise<Exercicio[]> {
    return this.exercicioRepository.findPublicos();
  }

  async buscarPorId(usuarioId: string, papel: Papel, exercicioId: string): Promise<Exercicio> {
    if (papel === 'aluno') {
      return this.buscarParaAluno(usuarioId, exercicioId);
    }

    const exercicio = await this.exercicioRepository.findById(exercicioId);
    if (!exercicio) {
      throw new NotFoundError('Exercício');
    }

    await this.exigirAcessoATurma(usuarioId, papel, exercicio.turma_id);
    return exercicio;
  }

  private async buscarParaAluno(usuarioId: string, exercicioId: string): Promise<Exercicio> {
    const exercicio = await this.acessoExercicio.exigirLeitura(usuarioId, exercicioId);

    // Exercício público não entra em sorteio de prova — quem chega por fora não tem
    // variante sorteada nenhuma.
    if (exercicio.publico || exercicio.prova_id === null) {
      return exercicio;
    }

    const matricula = await this.matriculaRepository.findByAlunoETurma(usuarioId, exercicio.turma_id);
    if (matricula?.prova_id !== exercicio.prova_id) {
      throw new ForbiddenError('Este exercício pertence a outra prova');
    }

    return exercicio;
  }

  private async exigirAcessoATurma(usuarioId: string, papel: Papel, turmaId: string): Promise<void> {
    if (papel === 'professor') {
      await this.exigirTurmaDoProfessor(turmaId, usuarioId);
      return;
    }

    if (papel === 'aluno') {
      const matricula = await this.matriculaRepository.findByAlunoETurma(usuarioId, turmaId);
      if (!matricula) {
        throw new ForbiddenError('Você não pertence a esta turma');
      }
      return;
    }

    // Pesquisador escolhe os exercícios da tarefa de qualquer turma (ver
    // docs/decisions/fase6-alinhamento-tcc.md) — vê o exercício sem gabarito (DTO do aluno).
    const turma = await this.turmaRepository.findById(turmaId);
    if (!turma) {
      throw new NotFoundError('Turma');
    }
  }

  private async exigirTurmaDoProfessor(turmaId: string, professorId: string): Promise<Turma> {
    const turma = await this.turmaRepository.findById(turmaId);
    if (!turma) {
      throw new NotFoundError('Turma');
    }

    if (turma.professor_id !== professorId) {
      throw new ForbiddenError('Você não é o professor desta turma');
    }

    return turma;
  }

  private async exigirExercicioDoProfessor(exercicioId: string, professorId: string): Promise<Exercicio> {
    const exercicio = await this.exercicioRepository.findById(exercicioId);
    if (!exercicio) {
      throw new NotFoundError('Exercício');
    }

    await this.exigirTurmaDoProfessor(exercicio.turma_id, professorId);
    return exercicio;
  }

  private async exigirProvaDaTurma(provaId: string, turmaId: string): Promise<void> {
    const prova = await this.provaRepository.findById(provaId);
    if (prova?.turma_id !== turmaId) {
      throw new NotFoundError('Prova');
    }
  }
}
