import type { Turma, Usuario } from '../generated/prisma/client';
import { ConflictError, ForbiddenError, NotFoundError } from '../errors';
import type { MatriculaRepository } from '../repositories/MatriculaRepository';
import type { TurmaRepository } from '../repositories/TurmaRepository';
import { gerarCodigoTurma } from '../utils/codigoTurma';
import type { CriarTurmaBodyDto } from '../dtos/turma.dto';

const CODIGO_MAX_TENTATIVAS = 5;

export class TurmaService {
  constructor(
    private readonly turmaRepository: TurmaRepository,
    private readonly matriculaRepository: MatriculaRepository,
  ) {}

  async criar(professorId: string, input: CriarTurmaBodyDto): Promise<Turma> {
    const codigo = await this.gerarCodigoUnico();
    return this.turmaRepository.create({
      nome: input.nome,
      semestre: input.semestre,
      professor_id: professorId,
      codigo,
      ...(input.disciplina !== undefined ? { disciplina: input.disciplina } : {}),
      ...(input.turno !== undefined ? { turno: input.turno } : {}),
      ...(input.sala !== undefined ? { sala: input.sala } : {}),
    });
  }

  async minhas(usuarioId: string, papel: Usuario['papel']): Promise<Turma[]> {
    if (papel === 'professor') {
      return this.turmaRepository.findByProfessorId(usuarioId);
    }

    if (papel === 'pesquisador') {
      // Pesquisador precisa ver todas as turmas pra escolher em qual "Iniciar
      // pesquisa" (ver docs/decisions/fase4-pesquisa-python-sessao-aluno-login.md).
      return this.turmaRepository.findAll();
    }

    const matriculas = await this.matriculaRepository.findByAlunoId(usuarioId);
    const turmas = await Promise.all(matriculas.map((matricula) => this.turmaRepository.findById(matricula.turma_id)));
    return turmas.filter((turma): turma is Turma => turma !== null);
  }

  async listarAlunos(professorId: string, turmaId: string): Promise<Usuario[]> {
    await this.exigirTurmaDoProfessor(turmaId, professorId);
    return this.matriculaRepository.findAlunosDaTurma(turmaId);
  }

  /**
   * O código da turma deixou de ser credencial de acesso e virou matrícula: o aluno
   * já chega logado e usa o código uma vez só, permanecendo na turma até o professor
   * encerrá-la — ver docs/decisions/fase8-conta-do-aluno-matricula-estudo-livre.md.
   */
  async matricular(alunoId: string, codigo: string): Promise<Turma> {
    const turma = await this.turmaRepository.findByCodigo(codigo);
    if (!turma) {
      throw new NotFoundError('Turma');
    }

    if (turma.encerrada_em !== null) {
      throw new ConflictError('Esta turma foi encerrada e não aceita mais matrículas');
    }

    const existente = await this.matriculaRepository.findByAlunoETurma(alunoId, turma.id);
    if (existente) {
      throw new ConflictError('Você já está nesta turma');
    }

    await this.matriculaRepository.criar(alunoId, turma.id);
    return turma;
  }

  /** Congela a turma: continua visível e revisável, mas não aceita entrega nem matrícula. */
  async encerrar(professorId: string, turmaId: string): Promise<Turma> {
    const turma = await this.exigirTurmaDoProfessor(turmaId, professorId);
    if (turma.encerrada_em !== null) {
      return turma;
    }

    return this.turmaRepository.definirEncerramento(turmaId, new Date());
  }

  /** Reabre uma turma encerrada por engano. */
  async reabrir(professorId: string, turmaId: string): Promise<Turma> {
    await this.exigirTurmaDoProfessor(turmaId, professorId);
    return this.turmaRepository.definirEncerramento(turmaId, null);
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

  private async gerarCodigoUnico(): Promise<string> {
    for (let tentativa = 0; tentativa < CODIGO_MAX_TENTATIVAS; tentativa += 1) {
      const codigo = gerarCodigoTurma();
      const existente = await this.turmaRepository.findByCodigo(codigo);
      if (!existente) {
        return codigo;
      }
    }

    throw new Error('Não foi possível gerar um código de turma único');
  }
}
