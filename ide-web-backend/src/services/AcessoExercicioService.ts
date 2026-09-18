import { ForbiddenError, NotFoundError } from '../errors';
import type { Exercicio } from '../generated/prisma/client';
import type { ExercicioRepository } from '../repositories/ExercicioRepository';
import type { MatriculaRepository } from '../repositories/MatriculaRepository';
import type { ResultadoExercicioRepository } from '../repositories/ResultadoExercicioRepository';
import type { SubmissaoSqlRepository } from '../repositories/SubmissaoSqlRepository';
import type { TurmaRepository } from '../repositories/TurmaRepository';

/**
 * Ponto único de acesso do aluno a um exercício. Antes cada serviço comparava
 * `usuario.turma_id === exercicio.turma_id`; com matrícula em várias turmas e
 * exercício público, essa comparação passaria a liberar por coincidência de nulos em
 * vez de por regra — ver docs/decisions/fase8-conta-do-aluno-matricula-estudo-livre.md.
 *
 * Exercício público não congela com a turma de origem: pra quem chega por fora, ele é
 * material de estudo e o ciclo de vida daquela turma não diz respeito a ele.
 */
export class AcessoExercicioService {
  constructor(
    private readonly exercicioRepository: ExercicioRepository,
    private readonly matriculaRepository: MatriculaRepository,
    private readonly turmaRepository: TurmaRepository,
    private readonly submissaoRepository: SubmissaoSqlRepository,
    private readonly resultadoRepository: ResultadoExercicioRepository,
  ) {}

  /** Abrir o exercício: público, ou de uma turma em que o aluno está matriculado. */
  async exigirLeitura(usuarioId: string, exercicioId: string): Promise<Exercicio> {
    const exercicio = await this.buscarExercicio(exercicioId);
    if (exercicio.publico) {
      return exercicio;
    }

    await this.exigirMatricula(usuarioId, exercicio.turma_id);
    return exercicio;
  }

  /**
   * Entregar algo (SQL, diagrama, finalizar). Na ordem: turma aberta, prazo, envio
   * único da prova. A liberação concedida pelo professor atravessa as duas últimas —
   * é o mesmo conceito para o engano na prova e para o prazo perdido (Fase 10, D8).
   */
  async exigirEntrega(usuarioId: string, exercicioId: string): Promise<Exercicio> {
    const exercicio = await this.exigirLeitura(usuarioId, exercicioId);
    if (exercicio.publico) {
      return exercicio;
    }

    await this.exigirTurmaAberta(exercicio.turma_id);

    if (await this.temEnvioLiberado(usuarioId, exercicioId)) {
      return exercicio;
    }

    this.exigirDentroDoPrazo(exercicio);
    await this.exigirEnvioUnicoDisponivel(usuarioId, exercicio);

    return exercicio;
  }

  /**
   * Testar a consulta no sandbox. Em questão de prova é proibido: testar livremente
   * transformaria a prova num exercício comum, com o aluno iterando até acertar sem
   * pensar (Fase 10, D9).
   */
  async exigirTeste(usuarioId: string, exercicioId: string): Promise<Exercicio> {
    const exercicio = await this.exigirEntrega(usuarioId, exercicioId);
    if (exercicio.prova_id != null) {
      throw new ForbiddenError('Questão de prova não permite testar: revise sua consulta e envie uma vez');
    }

    return exercicio;
  }

  /** Consome a liberação: ela vale para um envio só (Fase 10, D8). */
  async consumirLiberacao(usuarioId: string, exercicioId: string): Promise<void> {
    if (await this.temEnvioLiberado(usuarioId, exercicioId)) {
      await this.resultadoRepository.limparEnvioLiberado(usuarioId, exercicioId);
    }
  }

  private async temEnvioLiberado(usuarioId: string, exercicioId: string): Promise<boolean> {
    const resultado = await this.resultadoRepository.findByUsuarioEExercicio(usuarioId, exercicioId);
    return resultado?.envio_liberado_em != null;
  }

  private exigirDentroDoPrazo(exercicio: Exercicio): void {
    if (exercicio.prazo != null && exercicio.prazo.getTime() < Date.now()) {
      const quando = exercicio.prazo.toLocaleString('pt-BR');
      throw new ForbiddenError(`O prazo desta atividade encerrou em ${quando}`);
    }
  }

  private async exigirEnvioUnicoDisponivel(usuarioId: string, exercicio: Exercicio): Promise<void> {
    if (exercicio.prova_id == null) {
      return;
    }

    const ultima = await this.submissaoRepository.findUltimaTentativa(usuarioId, exercicio.id);
    if (ultima) {
      throw new ForbiddenError('Questão de prova aceita um envio só, e o seu já foi registrado');
    }
  }

  private async buscarExercicio(exercicioId: string): Promise<Exercicio> {
    const exercicio = await this.exercicioRepository.findById(exercicioId);
    if (!exercicio) {
      throw new NotFoundError('Exercício');
    }

    return exercicio;
  }

  private async exigirMatricula(usuarioId: string, turmaId: string): Promise<void> {
    const matricula = await this.matriculaRepository.findByAlunoETurma(usuarioId, turmaId);
    if (!matricula) {
      throw new ForbiddenError('Você não pertence a esta turma');
    }
  }

  private async exigirTurmaAberta(turmaId: string): Promise<void> {
    const turma = await this.turmaRepository.findById(turmaId);
    if (!turma) {
      throw new NotFoundError('Turma');
    }

    if (turma.encerrada_em !== null) {
      throw new ForbiddenError('Esta turma foi encerrada e não aceita mais entregas');
    }
  }
}
