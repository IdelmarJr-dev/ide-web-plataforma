import type { ResultadoExercicio } from '../generated/prisma/client';
import { prisma } from '../lib/prisma';

export interface ContagemPorTurma {
  turmaId: string;
  total: number;
}

export interface ContagemPorPar {
  usuarioId: string;
  exercicioId: string;
  total: number;
}

export interface AtividadePorExercicio {
  exercicioId: string;
  em: Date;
}

export interface ParAlunoExercicio {
  usuarioId: string;
  exercicioId: string;
}

/**
 * Leituras agregadas dos painéis. Tudo aqui é `groupBy`/`findMany` em lote sobre listas
 * de ids: nada de uma consulta por célula — a matriz de uma turma cheia seria centenas
 * de idas ao banco (Fase 9, D2 e D5).
 */
export interface PainelRepository {
  contarAlunosPorTurma(turmaIds: string[]): Promise<ContagemPorTurma[]>;
  contarAlunosDistintos(turmaIds: string[]): Promise<number>;
  contarExerciciosPorTurma(turmaIds: string[]): Promise<ContagemPorTurma[]>;
  findResultadosPorExercicios(exercicioIds: string[]): Promise<ResultadoExercicio[]>;
  findResultadosDoAluno(usuarioId: string, exercicioIds: string[]): Promise<ResultadoExercicio[]>;
  contarSubmissoesPorPar(exercicioIds: string[]): Promise<ContagemPorPar[]>;
  contarDicasPorPar(exercicioIds: string[]): Promise<ContagemPorPar[]>;
  findParesComDiagrama(exercicioIds: string[]): Promise<ParAlunoExercicio[]>;
  ultimaAtividadePorExercicio(exercicioIds: string[]): Promise<AtividadePorExercicio[]>;
  tentativasAteAcertar(usuarioId: string, exercicioIds: string[]): Promise<ContagemPorPar[]>;
  exerciciosComUltimoEnvioEmErro(usuarioId: string, exercicioIds: string[]): Promise<string[]>;
  paresComUltimoEnvioEmErro(exercicioIds: string[]): Promise<ParAlunoExercicio[]>;
}

export class PrismaPainelRepository implements PainelRepository {
  async contarAlunosPorTurma(turmaIds: string[]): Promise<ContagemPorTurma[]> {
    if (turmaIds.length === 0) return [];

    const linhas = await prisma.matriculaTurma.groupBy({
      by: ['turma_id'],
      where: { turma_id: { in: turmaIds } },
      _count: { _all: true },
    });

    return linhas.map((linha) => ({ turmaId: linha.turma_id, total: linha._count._all }));
  }

  /**
   * O mesmo aluno pode estar em várias turmas do professor (Fase 8), então somar as
   * contagens por turma o conta mais de uma vez. O cartão de resumo fala de pessoas.
   */
  async contarAlunosDistintos(turmaIds: string[]): Promise<number> {
    if (turmaIds.length === 0) return 0;

    const linhas = await prisma.matriculaTurma.findMany({
      where: { turma_id: { in: turmaIds } },
      select: { aluno_id: true },
      distinct: ['aluno_id'],
    });

    return linhas.length;
  }

  async contarExerciciosPorTurma(turmaIds: string[]): Promise<ContagemPorTurma[]> {
    if (turmaIds.length === 0) return [];

    const linhas = await prisma.exercicio.groupBy({
      by: ['turma_id'],
      where: { turma_id: { in: turmaIds } },
      _count: { _all: true },
    });

    return linhas.map((linha) => ({ turmaId: linha.turma_id, total: linha._count._all }));
  }

  findResultadosPorExercicios(exercicioIds: string[]): Promise<ResultadoExercicio[]> {
    if (exercicioIds.length === 0) return Promise.resolve([]);

    return prisma.resultadoExercicio.findMany({ where: { exercicio_id: { in: exercicioIds } } });
  }

  findResultadosDoAluno(usuarioId: string, exercicioIds: string[]): Promise<ResultadoExercicio[]> {
    if (exercicioIds.length === 0) return Promise.resolve([]);

    return prisma.resultadoExercicio.findMany({
      where: { usuario_id: usuarioId, exercicio_id: { in: exercicioIds } },
    });
  }

  async contarSubmissoesPorPar(exercicioIds: string[]): Promise<ContagemPorPar[]> {
    if (exercicioIds.length === 0) return [];

    const linhas = await prisma.submissaoSql.groupBy({
      by: ['usuario_id', 'exercicio_id'],
      where: { exercicio_id: { in: exercicioIds } },
      _count: { _all: true },
    });

    return linhas.map((linha) => ({
      usuarioId: linha.usuario_id,
      exercicioId: linha.exercicio_id,
      total: linha._count._all,
    }));
  }

  async contarDicasPorPar(exercicioIds: string[]): Promise<ContagemPorPar[]> {
    if (exercicioIds.length === 0) return [];

    const linhas = await prisma.dicaIa.groupBy({
      by: ['usuario_id', 'exercicio_id'],
      where: { exercicio_id: { in: exercicioIds } },
      _count: { _all: true },
    });

    return linhas.map((linha) => ({
      usuarioId: linha.usuario_id,
      exercicioId: linha.exercicio_id,
      total: linha._count._all,
    }));
  }

  /** Modelagem salva também conta como "começou", mesmo sem nenhuma consulta enviada. */
  async findParesComDiagrama(exercicioIds: string[]): Promise<ParAlunoExercicio[]> {
    if (exercicioIds.length === 0) return [];

    const linhas = await prisma.diagramaMer.findMany({
      where: { exercicio_id: { in: exercicioIds } },
      select: { usuario_id: true, exercicio_id: true },
    });

    return linhas.map((linha) => ({ usuarioId: linha.usuario_id, exercicioId: linha.exercicio_id }));
  }

  async ultimaAtividadePorExercicio(exercicioIds: string[]): Promise<AtividadePorExercicio[]> {
    if (exercicioIds.length === 0) return [];

    const linhas = await prisma.submissaoSql.groupBy({
      by: ['exercicio_id'],
      where: { exercicio_id: { in: exercicioIds } },
      _max: { criado_em: true },
    });

    return linhas.flatMap((linha) =>
      linha._max.criado_em ? [{ exercicioId: linha.exercicio_id, em: linha._max.criado_em }] : [],
    );
  }

  /** Mesma pergunta da anterior, para a turma inteira: alimenta a matriz. */
  async paresComUltimoEnvioEmErro(exercicioIds: string[]): Promise<ParAlunoExercicio[]> {
    if (exercicioIds.length === 0) return [];

    const submissoes = await prisma.submissaoSql.findMany({
      where: { exercicio_id: { in: exercicioIds } },
      select: { usuario_id: true, exercicio_id: true, resultado_status: true, tentativa_numero: true },
      orderBy: { tentativa_numero: 'desc' },
    });

    const vistos = new Set<string>();
    const comErro: ParAlunoExercicio[] = [];
    for (const submissao of submissoes) {
      const par = `${submissao.usuario_id}:${submissao.exercicio_id}`;
      if (vistos.has(par)) continue;
      vistos.add(par);

      if (submissao.resultado_status !== 'sucesso') {
        comErro.push({ usuarioId: submissao.usuario_id, exercicioId: submissao.exercicio_id });
      }
    }

    return comErro;
  }

  /**
   * Exercícios em que a ÚLTIMA submissão do aluno não chegou a executar. Em questão de
   * prova isso queima o envio único, e é o caso em que o professor precisa decidir se
   * libera outro (Fase 10, D10).
   */
  async exerciciosComUltimoEnvioEmErro(usuarioId: string, exercicioIds: string[]): Promise<string[]> {
    if (exercicioIds.length === 0) return [];

    const ultimas = await prisma.submissaoSql.findMany({
      where: { usuario_id: usuarioId, exercicio_id: { in: exercicioIds } },
      select: { exercicio_id: true, resultado_status: true, tentativa_numero: true },
      orderBy: { tentativa_numero: 'desc' },
    });

    const vistos = new Set<string>();
    const comErro: string[] = [];
    for (const submissao of ultimas) {
      if (vistos.has(submissao.exercicio_id)) continue;
      vistos.add(submissao.exercicio_id);

      if (submissao.resultado_status !== 'sucesso') {
        comErro.push(submissao.exercicio_id);
      }
    }

    return comErro;
  }

  /**
   * Em que tentativa o aluno acertou cada exercício. `min` porque o número da tentativa
   * cresce a cada envio: a menor entre as corretas é a primeira vez que ele acertou.
   */
  async tentativasAteAcertar(usuarioId: string, exercicioIds: string[]): Promise<ContagemPorPar[]> {
    if (exercicioIds.length === 0) return [];

    const linhas = await prisma.submissaoSql.groupBy({
      by: ['usuario_id', 'exercicio_id'],
      where: { usuario_id: usuarioId, exercicio_id: { in: exercicioIds }, correta: true },
      _min: { tentativa_numero: true },
    });

    return linhas.flatMap((linha) =>
      linha._min.tentativa_numero === null
        ? []
        : [
            {
              usuarioId: linha.usuario_id,
              exercicioId: linha.exercicio_id,
              total: linha._min.tentativa_numero,
            },
          ],
    );
  }
}
