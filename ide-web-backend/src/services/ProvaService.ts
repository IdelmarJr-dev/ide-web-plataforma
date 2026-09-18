import type { NivelDificuldade, Prova } from '../generated/prisma/client';
import { ConflictError, ForbiddenError, NotFoundError } from '../errors';
import type { ExercicioRepository } from '../repositories/ExercicioRepository';
import type { MatriculaRepository } from '../repositories/MatriculaRepository';
import type { ProvaRepository } from '../repositories/ProvaRepository';
import type { TurmaRepository } from '../repositories/TurmaRepository';

export interface SortearResultado {
  alunosSorteados: number;
}

function escolherAleatorio<T>(itens: readonly T[]): T {
  const item = itens[Math.floor(Math.random() * itens.length)];
  if (item === undefined) {
    throw new Error('Não é possível sortear de uma lista vazia');
  }
  return item;
}

export class ProvaService {
  constructor(
    private readonly provaRepository: ProvaRepository,
    private readonly turmaRepository: TurmaRepository,
    private readonly matriculaRepository: MatriculaRepository,
    private readonly exercicioRepository: ExercicioRepository,
  ) {}

  async criar(professorId: string, turmaId: string, titulo: string): Promise<Prova> {
    await this.exigirTurmaDoProfessor(turmaId, professorId);
    return this.provaRepository.create({ turma_id: turmaId, titulo });
  }

  /** Quantos exercícios da turma ainda podem virar questão de prova (Fase 10, D13). */
  async acervoDisponivel(professorId: string, turmaId: string): Promise<{ total: number; porNivel: Record<NivelDificuldade, number> }> {
    await this.exigirTurmaDoProfessor(turmaId, professorId);

    const disponiveis = await this.exercicioRepository.findSemProva(turmaId);

    return {
      total: disponiveis.length,
      porNivel: {
        iniciante: disponiveis.filter((exercicio) => exercicio.nivel_dificuldade === 'iniciante').length,
        intermediario: disponiveis.filter((exercicio) => exercicio.nivel_dificuldade === 'intermediario').length,
      },
    };
  }

  /**
   * Monta uma prova com `quantidade` questões tiradas do acervo sem prova da turma.
   * Recusa se faltar exercício: prova pela metade é pior que erro claro (Fase 10, D13).
   */
  async montarComAssistente(
    professorId: string,
    turmaId: string,
    input: { titulo: string; quantidade: number; nivel?: NivelDificuldade | undefined; prazo?: Date | undefined },
  ): Promise<{ prova: Prova; questoes: number }> {
    await this.exigirTurmaDoProfessor(turmaId, professorId);

    const disponiveis = await this.exercicioRepository.findSemProva(turmaId, input.nivel);
    if (disponiveis.length < input.quantidade) {
      throw new ConflictError(
        `A turma tem ${String(disponiveis.length)} exercício(s) sem prova, e você pediu ${String(input.quantidade)}. ` +
          'Cadastre mais exercícios ou peça menos questões.',
      );
    }

    const prova = await this.provaRepository.create({ turma_id: turmaId, titulo: input.titulo });
    const escolhidos = disponiveis.slice(0, input.quantidade).map((exercicio) => exercicio.id);
    const questoes = await this.exercicioRepository.vincularAProva(escolhidos, prova.id, input.prazo ?? null);

    return { prova, questoes };
  }

  async listarPorTurma(professorId: string, turmaId: string): Promise<Prova[]> {
    await this.exigirTurmaDoProfessor(turmaId, professorId);
    return this.provaRepository.findByTurmaId(turmaId);
  }

  /**
   * Sorteia uma prova aleatória pra cada aluno da turma que ainda não tem uma —
   * seguro de rodar de novo (só preenche quem entrou depois do último sorteio, nunca
   * reatribui quem já foi sorteado). A variante fica na matrícula, não no aluno,
   * porque o mesmo aluno pode ser sorteado em turmas diferentes (Fase 8).
   * Ver docs/decisions/fase5-sorteador-provas.md.
   */
  async sortear(professorId: string, turmaId: string): Promise<SortearResultado> {
    await this.exigirTurmaDoProfessor(turmaId, professorId);

    const provas = await this.provaRepository.findByTurmaId(turmaId);
    if (provas.length === 0) {
      throw new ConflictError('Crie ao menos uma prova antes de sortear');
    }

    const matriculas = await this.matriculaRepository.findByTurmaId(turmaId);
    const semProva = matriculas.filter((matricula) => matricula.prova_id === null);

    await Promise.all(
      semProva.map((matricula) => {
        const provaSorteada = escolherAleatorio(provas);
        return this.matriculaRepository.definirProva(matricula.id, provaSorteada.id);
      }),
    );

    return { alunosSorteados: semProva.length };
  }

  private async exigirTurmaDoProfessor(turmaId: string, professorId: string): Promise<void> {
    const turma = await this.turmaRepository.findById(turmaId);
    if (!turma) {
      throw new NotFoundError('Turma');
    }

    if (turma.professor_id !== professorId) {
      throw new ForbiddenError('Você não é o professor desta turma');
    }
  }
}
