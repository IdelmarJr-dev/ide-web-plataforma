import { ForbiddenError, NotFoundError } from '../errors';
import type { Exercicio, MatriculaTurma, Turma, Usuario } from '../generated/prisma/client';
import type { ExercicioRepository } from '../repositories/ExercicioRepository';
import type { MatriculaRepository } from '../repositories/MatriculaRepository';
import type { PainelRepository } from '../repositories/PainelRepository';
import type { TurmaRepository } from '../repositories/TurmaRepository';
import { aguardaRevisao, estadoDaCelula, exercicioVisivelParaAluno } from '../utils/painel';
import type { EstadoCelula } from '../utils/painel';

export interface ResumoProfessor {
  turmasAtivas: number;
  turmasEncerradas: number;
  alunos: number;
  exercicios: number;
  aguardandoRevisao: number;
}

export interface TurmaDoPainel {
  turma: Turma;
  alunos: number;
  exercicios: number;
  entregas: number;
  aguardandoRevisao: number;
  ultimaAtividadeEm: Date | null;
}

export interface PainelProfessor {
  resumo: ResumoProfessor;
  turmas: TurmaDoPainel[];
}

export interface CelulaMatriz {
  alunoId: string;
  exercicioId: string;
  estado: EstadoCelula;
  tentativas: number;
  dicas: number;
  finalizadoEm: Date | null;
  /** Nota final lançada pelo professor, quando houver (Fase 10, item 4). */
  pontuacao: number | null;
  /** Último envio nem executou: em prova isso queimou o envio único (D10). */
  ultimoEnvioComErro: boolean;
}

export interface DificuldadeExercicio {
  exercicioId: string;
  taxaAcerto: number | null;
  mediaTentativas: number | null;
  dicasPorAluno: number;
}

export interface PainelTurma {
  turma: Turma;
  exercicios: Exercicio[];
  alunos: (Usuario & { provaId: string | null })[];
  celulas: CelulaMatriz[];
  dificuldade: DificuldadeExercicio[];
}

export interface ExercicioDoAluno {
  exercicio: Exercicio;
  estado: EstadoCelula;
  turmaId: string;
  turmaNome: string;
  disciplina: string;
  gabaritoLiberado: boolean;
  finalizadoEm: Date | null;
}

export interface TurmaDoAluno {
  turma: Turma;
  exercicios: ExercicioDoAluno[];
}

export interface DisciplinaDoAluno {
  disciplina: string;
  turmas: TurmaDoAluno[];
}

export interface PainelAluno {
  resumo: { turmas: number; pendentes: number; entregues: number; acertos: number };
  disciplinas: DisciplinaDoAluno[];
  pendencias: ExercicioDoAluno[];
  historico: ExercicioDoAluno[];
  progresso: {
    porTurma: { turmaId: string; turmaNome: string; total: number; entregues: number }[];
    tentativasAteAcertar: { exercicioId: string; titulo: string; tentativas: number }[];
  };
}

/** Uma atividade do aluno na visão do professor que vai corrigir (Fase 10, D4). */
export interface AtividadeDoAluno {
  exercicio: Exercicio;
  estado: EstadoCelula;
  tentativas: number;
  dicas: number;
  finalizadoEm: Date | null;
  sqlCorreto: boolean | null;
  merAvaliacao: number | null;
  dissertativaAvaliacao: number | null;
  pontuacao: number | null;
  revisado: boolean;
  envioLiberadoEm: Date | null;
  /** Último envio morreu em erro de sintaxe: o professor decide se libera (D10). */
  ultimoEnvioComErro: boolean;
}

export interface AtividadesDoAluno {
  aluno: Usuario;
  turma: Turma;
  atividades: AtividadeDoAluno[];
}

function chave(usuarioId: string, exercicioId: string): string {
  return `${usuarioId}:${exercicioId}`;
}

export class PainelService {
  constructor(
    private readonly painelRepository: PainelRepository,
    private readonly turmaRepository: TurmaRepository,
    private readonly exercicioRepository: ExercicioRepository,
    private readonly matriculaRepository: MatriculaRepository,
  ) {}

  async doProfessor(professorId: string): Promise<PainelProfessor> {
    const turmas = await this.turmaRepository.findByProfessorId(professorId);
    const turmaIds = turmas.map((turma) => turma.id);

    const exercicios = (await Promise.all(turmaIds.map((id) => this.exercicioRepository.findByTurmaId(id)))).flat();
    const exercicioIds = exercicios.map((exercicio) => exercicio.id);

    const [alunosPorTurma, alunosDistintos, exerciciosPorTurma, resultados, atividades] = await Promise.all([
      this.painelRepository.contarAlunosPorTurma(turmaIds),
      this.painelRepository.contarAlunosDistintos(turmaIds),
      this.painelRepository.contarExerciciosPorTurma(turmaIds),
      this.painelRepository.findResultadosPorExercicios(exercicioIds),
      this.painelRepository.ultimaAtividadePorExercicio(exercicioIds),
    ]);

    const turmaDoExercicio = new Map(exercicios.map((exercicio) => [exercicio.id, exercicio.turma_id]));
    const exercicioPorId = new Map(exercicios.map((exercicio) => [exercicio.id, exercicio]));
    const alunosPorTurmaId = new Map(alunosPorTurma.map((linha) => [linha.turmaId, linha.total]));
    const exerciciosPorTurmaId = new Map(exerciciosPorTurma.map((linha) => [linha.turmaId, linha.total]));

    const entregasPorTurma = new Map<string, number>();
    const revisaoPorTurma = new Map<string, number>();
    for (const resultado of resultados) {
      const turmaId = turmaDoExercicio.get(resultado.exercicio_id);
      const exercicio = exercicioPorId.get(resultado.exercicio_id);
      if (!turmaId || !exercicio) continue;

      if (resultado.finalizado_em !== null) {
        entregasPorTurma.set(turmaId, (entregasPorTurma.get(turmaId) ?? 0) + 1);
      }
      if (aguardaRevisao(exercicio, resultado)) {
        revisaoPorTurma.set(turmaId, (revisaoPorTurma.get(turmaId) ?? 0) + 1);
      }
    }

    const atividadePorTurma = new Map<string, Date>();
    for (const atividade of atividades) {
      const turmaId = turmaDoExercicio.get(atividade.exercicioId);
      if (!turmaId) continue;

      const atual = atividadePorTurma.get(turmaId);
      if (!atual || atividade.em > atual) {
        atividadePorTurma.set(turmaId, atividade.em);
      }
    }

    const turmasDoPainel = turmas.map<TurmaDoPainel>((turma) => ({
      turma,
      alunos: alunosPorTurmaId.get(turma.id) ?? 0,
      exercicios: exerciciosPorTurmaId.get(turma.id) ?? 0,
      entregas: entregasPorTurma.get(turma.id) ?? 0,
      aguardandoRevisao: revisaoPorTurma.get(turma.id) ?? 0,
      ultimaAtividadeEm: atividadePorTurma.get(turma.id) ?? null,
    }));

    return {
      resumo: {
        turmasAtivas: turmas.filter((turma) => turma.encerrada_em === null).length,
        turmasEncerradas: turmas.filter((turma) => turma.encerrada_em !== null).length,
        // Pessoas, não matrículas: somar as turmas contaria duas vezes quem está em duas.
        alunos: alunosDistintos,
        exercicios: exercicios.length,
        aguardandoRevisao: turmasDoPainel.reduce((soma, item) => soma + item.aguardandoRevisao, 0),
      },
      turmas: turmasDoPainel,
    };
  }

  async daTurma(professorId: string, turmaId: string): Promise<PainelTurma> {
    const turma = await this.turmaRepository.findById(turmaId);
    if (!turma) {
      throw new NotFoundError('Turma');
    }
    if (turma.professor_id !== professorId) {
      throw new ForbiddenError('Você não é o professor desta turma');
    }

    const [exercicios, matriculas, alunos] = await Promise.all([
      this.exercicioRepository.findByTurmaId(turmaId),
      this.matriculaRepository.findByTurmaId(turmaId),
      this.matriculaRepository.findAlunosDaTurma(turmaId),
    ]);

    const exercicioIds = exercicios.map((exercicio) => exercicio.id);
    const [resultados, submissoes, dicas, comDiagrama, paresComErro_] = await Promise.all([
      this.painelRepository.findResultadosPorExercicios(exercicioIds),
      this.painelRepository.contarSubmissoesPorPar(exercicioIds),
      this.painelRepository.contarDicasPorPar(exercicioIds),
      this.painelRepository.findParesComDiagrama(exercicioIds),
      this.painelRepository.paresComUltimoEnvioEmErro(exercicioIds),
    ]);

    const provaPorAluno = new Map(matriculas.map((matricula: MatriculaTurma) => [matricula.aluno_id, matricula.prova_id]));
    const resultadoPorPar = new Map(
      resultados.map((resultado) => [chave(resultado.usuario_id, resultado.exercicio_id), resultado]),
    );
    const submissoesPorPar = new Map(submissoes.map((linha) => [chave(linha.usuarioId, linha.exercicioId), linha.total]));
    const dicasPorPar = new Map(dicas.map((linha) => [chave(linha.usuarioId, linha.exercicioId), linha.total]));
    const paresComDiagrama = new Set(comDiagrama.map((par) => chave(par.usuarioId, par.exercicioId)));
    const paresComErro = new Set(paresComErro_.map((par) => chave(par.usuarioId, par.exercicioId)));

    const celulas: CelulaMatriz[] = [];
    for (const aluno of alunos) {
      for (const exercicio of exercicios) {
        // D3: exercício de prova não gera célula pra quem não foi sorteado com ela.
        if (!exercicioVisivelParaAluno(exercicio.prova_id, provaPorAluno.get(aluno.id))) continue;

        const par = chave(aluno.id, exercicio.id);
        const resultado = resultadoPorPar.get(par) ?? null;
        const tentativas = submissoesPorPar.get(par) ?? 0;
        const temAtividade = tentativas > 0 || paresComDiagrama.has(par);

        celulas.push({
          alunoId: aluno.id,
          exercicioId: exercicio.id,
          estado: estadoDaCelula(exercicio, resultado, temAtividade),
          tentativas,
          dicas: dicasPorPar.get(par) ?? 0,
          finalizadoEm: resultado?.finalizado_em ?? null,
          pontuacao: resultado?.pontuacao?.toNumber() ?? null,
          ultimoEnvioComErro: paresComErro.has(par),
        });
      }
    }

    return {
      turma,
      exercicios,
      alunos: alunos.map((aluno) => ({ ...aluno, provaId: provaPorAluno.get(aluno.id) ?? null })),
      celulas,
      dificuldade: exercicios.map((exercicio) => this.dificuldadeDe(exercicio.id, celulas, resultadoPorPar)),
    };
  }

  /**
   * Tudo o que um aluno tem numa turma, para o professor corrigir a pessoa e não uma
   * questão solta (Fase 10, D4).
   */
  async atividadesDoAluno(professorId: string, turmaId: string, usuarioId: string): Promise<AtividadesDoAluno> {
    const turma = await this.turmaRepository.findById(turmaId);
    if (!turma) {
      throw new NotFoundError('Turma');
    }
    if (turma.professor_id !== professorId) {
      throw new ForbiddenError('Você não é o professor desta turma');
    }

    const [alunos, matricula, exercicios] = await Promise.all([
      this.matriculaRepository.findAlunosDaTurma(turmaId),
      this.matriculaRepository.findByAlunoETurma(usuarioId, turmaId),
      this.exercicioRepository.findByTurmaId(turmaId),
    ]);

    const aluno = alunos.find((candidato) => candidato.id === usuarioId);
    if (!aluno || !matricula) {
      throw new NotFoundError('Aluno nesta turma');
    }

    // D3 de novo: o aluno só responde pelo que a prova sorteada dele libera.
    const visiveis = exercicios.filter((exercicio) =>
      exercicioVisivelParaAluno(exercicio.prova_id, matricula.prova_id),
    );
    const exercicioIds = visiveis.map((exercicio) => exercicio.id);

    const [resultados, submissoes, dicas, comDiagrama, ultimasComErro] = await Promise.all([
      this.painelRepository.findResultadosDoAluno(usuarioId, exercicioIds),
      this.painelRepository.contarSubmissoesPorPar(exercicioIds),
      this.painelRepository.contarDicasPorPar(exercicioIds),
      this.painelRepository.findParesComDiagrama(exercicioIds),
      this.painelRepository.exerciciosComUltimoEnvioEmErro(usuarioId, exercicioIds),
    ]);

    const resultadoPorExercicio = new Map(resultados.map((resultado) => [resultado.exercicio_id, resultado]));
    const tentativasPorExercicio = new Map(
      submissoes.filter((linha) => linha.usuarioId === usuarioId).map((linha) => [linha.exercicioId, linha.total]),
    );
    const dicasPorExercicio = new Map(
      dicas.filter((linha) => linha.usuarioId === usuarioId).map((linha) => [linha.exercicioId, linha.total]),
    );
    const comDiagramaDoAluno = new Set(
      comDiagrama.filter((par) => par.usuarioId === usuarioId).map((par) => par.exercicioId),
    );
    const comErro = new Set(ultimasComErro);

    return {
      aluno,
      turma,
      atividades: visiveis.map<AtividadeDoAluno>((exercicio) => {
        const resultado = resultadoPorExercicio.get(exercicio.id) ?? null;
        const tentativas = tentativasPorExercicio.get(exercicio.id) ?? 0;

        return {
          exercicio,
          estado: estadoDaCelula(exercicio, resultado, tentativas > 0 || comDiagramaDoAluno.has(exercicio.id)),
          tentativas,
          dicas: dicasPorExercicio.get(exercicio.id) ?? 0,
          finalizadoEm: resultado?.finalizado_em ?? null,
          sqlCorreto: resultado?.sql_correto ?? null,
          merAvaliacao: resultado?.mer_avaliacao?.toNumber() ?? null,
          dissertativaAvaliacao: resultado?.dissertativa_avaliacao?.toNumber() ?? null,
          pontuacao: resultado?.pontuacao?.toNumber() ?? null,
          revisado: resultado?.revisado ?? false,
          envioLiberadoEm: resultado?.envio_liberado_em ?? null,
          ultimoEnvioComErro: comErro.has(exercicio.id),
        };
      }),
    };
  }

  /**
   * Painel do aluno. Só dados dele: nenhum agregado da turma, nenhuma média, nenhuma
   * posição — comparação social é o principal vetor de desmotivação apontado na
   * literatura de learning analytics dashboards (Fase 9, D6).
   */
  async doAluno(usuarioId: string): Promise<PainelAluno> {
    const matriculas = await this.matriculaRepository.findByAlunoId(usuarioId);
    const turmas = (
      await Promise.all(matriculas.map((matricula) => this.turmaRepository.findById(matricula.turma_id)))
    ).filter((turma): turma is Turma => turma !== null);

    const provaPorTurma = new Map(matriculas.map((matricula) => [matricula.turma_id, matricula.prova_id]));

    const porTurma = await Promise.all(
      turmas.map(async (turma) => {
        const exercicios = await this.exercicioRepository.findByTurmaId(turma.id);
        return {
          turma,
          // D3 de novo: o aluno só enxerga o que a prova sorteada dele libera.
          exercicios: exercicios.filter((exercicio) =>
            exercicioVisivelParaAluno(exercicio.prova_id, provaPorTurma.get(turma.id)),
          ),
        };
      }),
    );

    const exercicioIds = porTurma.flatMap((item) => item.exercicios.map((exercicio) => exercicio.id));
    const [resultados, submissoes, comDiagrama, tentativas] = await Promise.all([
      this.painelRepository.findResultadosDoAluno(usuarioId, exercicioIds),
      this.painelRepository.contarSubmissoesPorPar(exercicioIds),
      this.painelRepository.findParesComDiagrama(exercicioIds),
      this.painelRepository.tentativasAteAcertar(usuarioId, exercicioIds),
    ]);

    const resultadoPorExercicio = new Map(resultados.map((resultado) => [resultado.exercicio_id, resultado]));
    const submissoesDoAluno = new Map(
      submissoes
        .filter((linha) => linha.usuarioId === usuarioId)
        .map((linha) => [linha.exercicioId, linha.total]),
    );
    const diagramasDoAluno = new Set(
      comDiagrama.filter((par) => par.usuarioId === usuarioId).map((par) => par.exercicioId),
    );

    const disciplinas = new Map<string, TurmaDoAluno[]>();
    const todos: ExercicioDoAluno[] = [];

    for (const item of porTurma) {
      const exercicios = item.exercicios.map<ExercicioDoAluno>((exercicio) => {
        const resultado = resultadoPorExercicio.get(exercicio.id) ?? null;
        const temAtividade = (submissoesDoAluno.get(exercicio.id) ?? 0) > 0 || diagramasDoAluno.has(exercicio.id);

        return {
          exercicio,
          estado: estadoDaCelula(exercicio, resultado, temAtividade),
          turmaId: item.turma.id,
          turmaNome: item.turma.nome,
          disciplina: item.turma.disciplina,
          gabaritoLiberado: exercicio.gabarito_liberado,
          finalizadoEm: resultado?.finalizado_em ?? null,
        };
      });

      todos.push(...exercicios);
      const doGrupo = disciplinas.get(item.turma.disciplina) ?? [];
      doGrupo.push({ turma: item.turma, exercicios });
      disciplinas.set(item.turma.disciplina, doGrupo);
    }

    const tituloPorExercicio = new Map(
      porTurma.flatMap((item) => item.exercicios.map((exercicio) => [exercicio.id, exercicio.titulo])),
    );

    const pendencias = todos.filter(
      (item) => item.estado === 'nao_iniciou' || item.estado === 'em_andamento',
    );
    const historico = todos
      .filter((item) => item.finalizadoEm !== null)
      .sort((a, b) => (b.finalizadoEm?.getTime() ?? 0) - (a.finalizadoEm?.getTime() ?? 0));

    return {
      resumo: {
        turmas: turmas.length,
        pendentes: pendencias.length,
        entregues: historico.length,
        acertos: todos.filter((item) => item.estado === 'correto').length,
      },
      disciplinas: [...disciplinas.entries()]
        .map(([disciplina, turmasDaDisciplina]) => ({ disciplina, turmas: turmasDaDisciplina }))
        .sort((a, b) => a.disciplina.localeCompare(b.disciplina)),
      pendencias,
      historico,
      progresso: {
        porTurma: porTurma.map((item) => ({
          turmaId: item.turma.id,
          turmaNome: item.turma.nome,
          total: item.exercicios.length,
          entregues: todos.filter((doAluno) => doAluno.turmaId === item.turma.id && doAluno.finalizadoEm !== null)
            .length,
        })),
        tentativasAteAcertar: tentativas.map((linha) => ({
          exercicioId: linha.exercicioId,
          titulo: tituloPorExercicio.get(linha.exercicioId) ?? '',
          tentativas: linha.total,
        })),
      },
    };
  }

  /**
   * Métricas por exercício, sempre entre quem de fato mexeu nele: dividir pelo total de
   * alunos da turma faria um exercício recém-publicado parecer dificílimo.
   */
  private dificuldadeDe(
    exercicioId: string,
    celulas: CelulaMatriz[],
    resultadoPorPar: Map<string, { sql_correto: boolean | null }>,
  ): DificuldadeExercicio {
    const doExercicio = celulas.filter((celula) => celula.exercicioId === exercicioId);
    const comTentativa = doExercicio.filter((celula) => celula.tentativas > 0);

    const avaliados = comTentativa.filter(
      (celula) => resultadoPorPar.get(chave(celula.alunoId, exercicioId))?.sql_correto != null,
    );
    const acertos = avaliados.filter(
      (celula) => resultadoPorPar.get(chave(celula.alunoId, exercicioId))?.sql_correto === true,
    );

    return {
      exercicioId,
      taxaAcerto: avaliados.length === 0 ? null : acertos.length / avaliados.length,
      mediaTentativas:
        comTentativa.length === 0
          ? null
          : comTentativa.reduce((soma, celula) => soma + celula.tentativas, 0) / comTentativa.length,
      dicasPorAluno:
        doExercicio.length === 0
          ? 0
          : doExercicio.reduce((soma, celula) => soma + celula.dicas, 0) / doExercicio.length,
    };
  }
}
