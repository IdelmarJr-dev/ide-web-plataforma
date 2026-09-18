import type { RevisarResultadoBodyDto } from '../dtos/resultado.dto';
import { ForbiddenError, NotFoundError } from '../errors';
import type { Exercicio, ResultadoExercicio } from '../generated/prisma/client';
import type { ExercicioRepository } from '../repositories/ExercicioRepository';
import type { MatriculaRepository } from '../repositories/MatriculaRepository';
import type { RespostaDissertativaRepository } from '../repositories/RespostaDissertativaRepository';
import type { ResultadoExercicioRepository } from '../repositories/ResultadoExercicioRepository';
import type { SubmissaoSqlRepository } from '../repositories/SubmissaoSqlRepository';
import type { TurmaRepository } from '../repositories/TurmaRepository';

export interface MeuResultado {
  exercicio: Exercicio;
  resultado: ResultadoExercicio;
}

/** O que o aluno entregou, para o professor ver antes de dar nota (Fase 9, D17). */
export interface RespostasDoAluno {
  ultimaSubmissaoSql: { query: string; correta: boolean | null; criadoEm: Date } | null;
  dissertativa: { texto: string; atualizadoEm: Date } | null;
}

export class ResultadoExercicioService {
  constructor(
    private readonly resultadoRepository: ResultadoExercicioRepository,
    private readonly exercicioRepository: ExercicioRepository,
    private readonly turmaRepository: TurmaRepository,
    private readonly matriculaRepository: MatriculaRepository,
    private readonly submissaoRepository: SubmissaoSqlRepository,
    private readonly respostaDissertativaRepository: RespostaDissertativaRepository,
  ) {}

  async revisar(
    professorId: string,
    exercicioId: string,
    usuarioId: string,
    input: RevisarResultadoBodyDto,
  ): Promise<ResultadoExercicio> {
    const exercicio = await this.exigirExercicioDoProfessor(exercicioId, professorId);
    await this.exigirAlunoMatriculado(usuarioId, exercicio.turma_id);

    return this.resultadoRepository.upsertRevisao(usuarioId, exercicioId, professorId, {
      ...(input.sqlCorreto !== undefined ? { sql_correto: input.sqlCorreto } : {}),
      ...(input.merAvaliacao !== undefined ? { mer_avaliacao: input.merAvaliacao } : {}),
      ...(input.dissertativaAvaliacao !== undefined ? { dissertativa_avaliacao: input.dissertativaAvaliacao } : {}),
      ...(input.acertos !== undefined ? { acertos: input.acertos } : {}),
      ...(input.erros !== undefined ? { erros: input.erros } : {}),
      ...(input.pontuacao !== undefined ? { pontuacao: input.pontuacao } : {}),
    });
  }

  /** `liberado: false` desfaz a liberação — o clique em "Liberar gabarito" é reversível. */
  async definirGabaritoLiberado(professorId: string, exercicioId: string, liberado: boolean): Promise<Exercicio> {
    await this.exigirExercicioDoProfessor(exercicioId, professorId);
    return this.exercicioRepository.definirGabaritoLiberado(exercicioId, liberado ? new Date() : null);
  }

  async meuResultado(usuarioId: string, exercicioId: string): Promise<MeuResultado | null> {
    const exercicio = await this.exercicioRepository.findById(exercicioId);
    if (!exercicio?.gabarito_liberado) {
      return null;
    }

    const resultado = await this.resultadoRepository.findByUsuarioEExercicio(usuarioId, exercicioId);
    if (!resultado?.revisado) {
      return null;
    }

    return { exercicio, resultado };
  }

  /**
   * Concede ao aluno UM envio extra, atravessando prazo vencido e envio único de prova.
   * É a válvula do modo prova: sem ela, um erro de digitação queimaria a questão sem
   * ninguém poder fazer nada (Fase 10, D8 e D10).
   */
  async liberarEnvio(professorId: string, exercicioId: string, usuarioId: string): Promise<void> {
    const exercicio = await this.exigirExercicioDoProfessor(exercicioId, professorId);
    await this.exigirAlunoMatriculado(usuarioId, exercicio.turma_id);

    await this.resultadoRepository.liberarEnvio(usuarioId, exercicioId);
  }

  /**
   * Sem isto a tela de revisão mostra só os campos de nota, e o professor corrige no escuro
   * (relatório de testes 2026-09-16). A modelagem já tem rota própria, então fica de fora.
   */
  async respostasDoAluno(professorId: string, exercicioId: string, usuarioId: string): Promise<RespostasDoAluno> {
    const exercicio = await this.exigirExercicioDoProfessor(exercicioId, professorId);
    await this.exigirAlunoMatriculado(usuarioId, exercicio.turma_id);

    const [submissao, dissertativa] = await Promise.all([
      this.submissaoRepository.findUltimaTentativa(usuarioId, exercicioId),
      this.respostaDissertativaRepository.findByExercicioEUsuario(exercicioId, usuarioId),
    ]);

    return {
      ultimaSubmissaoSql: submissao
        ? { query: submissao.query_sql, correta: submissao.correta, criadoEm: submissao.criado_em }
        : null,
      dissertativa: dissertativa ? { texto: dissertativa.texto, atualizadoEm: dissertativa.atualizado_em } : null,
    };
  }

  async resultadoDoAluno(
    professorId: string,
    exercicioId: string,
    usuarioId: string,
  ): Promise<ResultadoExercicio | null> {
    await this.exigirExercicioDoProfessor(exercicioId, professorId);
    return this.resultadoRepository.findByUsuarioEExercicio(usuarioId, exercicioId);
  }

  /**
   * `revisar` criava o ResultadoExercicio do zero para qualquer UUID, sem checar vínculo
   * nenhum — dava para lançar nota para alguém que nem é da turma (Fase 9, D16).
   */
  private async exigirAlunoMatriculado(usuarioId: string, turmaId: string): Promise<void> {
    const matricula = await this.matriculaRepository.findByAlunoETurma(usuarioId, turmaId);
    if (!matricula) {
      throw new ForbiddenError('Este aluno não está matriculado na turma do exercício');
    }
  }

  private async exigirExercicioDoProfessor(exercicioId: string, professorId: string): Promise<Exercicio> {
    const exercicio = await this.exercicioRepository.findById(exercicioId);
    if (!exercicio) {
      throw new NotFoundError('Exercício');
    }

    const turma = await this.turmaRepository.findById(exercicio.turma_id);
    if (turma?.professor_id !== professorId) {
      throw new ForbiddenError('Você não é o professor deste exercício');
    }

    return exercicio;
  }
}
