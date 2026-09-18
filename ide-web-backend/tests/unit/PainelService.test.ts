import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Exercicio, MatriculaTurma, ResultadoExercicio, Turma, Usuario } from '../../src/generated/prisma/client';
import type { ExercicioRepository } from '../../src/repositories/ExercicioRepository';
import type { MatriculaRepository } from '../../src/repositories/MatriculaRepository';
import type { PainelRepository } from '../../src/repositories/PainelRepository';
import type { TurmaRepository } from '../../src/repositories/TurmaRepository';
import { PainelService } from '../../src/services/PainelService';

const PROFESSOR = 'professor-1';
const TURMA = 'turma-1';

function turma(overrides: Partial<Turma> = {}): Turma {
  return {
    id: TURMA,
    nome: 'Turma A',
    disciplina: 'Banco de Dados',
    semestre: '2026.2',
    turno: null,
    sala: null,
    professor_id: PROFESSOR,
    codigo: 'ABC123',
    encerrada_em: null,
    criado_em: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function exercicio(overrides: Partial<Exercicio> = {}): Exercicio {
  return {
    id: 'exercicio-1',
    turma_id: TURMA,
    prova_id: null,
    titulo: 'Liste os clientes',
    enunciado: '...',
    nivel_dificuldade: 'iniciante',
    mer_gabarito: null,
    modo_mer: 'conceitual_logico',
    publico: false,
    sql_gabarito: 'SELECT 1',
    sql_setup: null,
    gabarito_dissertativo: null,
    gabarito_liberado: false,
    gabarito_liberado_em: null,
    prazo: null,
    ordem: 1,
    criado_em: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function aluno(id: string, nome: string): Usuario {
  return {
    id,
    nome,
    email: `${id}@teste.com`,
    senha_hash: null,
    papel: 'aluno',
    matricula: null,
    criado_em: new Date('2026-01-01T00:00:00.000Z'),
  };
}

function matricula(alunoId: string, provaId: string | null): MatriculaTurma {
  return {
    id: `matricula-${alunoId}`,
    aluno_id: alunoId,
    turma_id: TURMA,
    prova_id: provaId,
    criado_em: new Date('2026-01-01T00:00:00.000Z'),
  };
}

function resultado(overrides: Partial<ResultadoExercicio> = {}): ResultadoExercicio {
  return {
    id: 'resultado-1',
    usuario_id: 'aluno-1',
    exercicio_id: 'exercicio-1',
    sql_correto: null,
    mer_avaliacao: null,
    dissertativa_avaliacao: null,
    acertos: 0,
    erros: 0,
    pontuacao: null,
    finalizado_em: null,
    envio_liberado_em: null,
    revisado: false,
    revisado_em: null,
    revisado_por: null,
    criado_em: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('PainelService', () => {
  const findTurmaById = vi.fn<TurmaRepository['findById']>();
  const findByProfessorId = vi.fn<TurmaRepository['findByProfessorId']>();
  const findExerciciosByTurmaId = vi.fn<ExercicioRepository['findByTurmaId']>();
  const findMatriculasByTurmaId = vi.fn<MatriculaRepository['findByTurmaId']>();
  const findAlunosDaTurma = vi.fn<MatriculaRepository['findAlunosDaTurma']>();
  const findByAlunoId = vi.fn<MatriculaRepository['findByAlunoId']>();
  const findByAlunoETurma = vi.fn<MatriculaRepository['findByAlunoETurma']>();

  const contarAlunosPorTurma = vi.fn<PainelRepository['contarAlunosPorTurma']>();
  const contarAlunosDistintos = vi.fn<PainelRepository['contarAlunosDistintos']>();
  const contarExerciciosPorTurma = vi.fn<PainelRepository['contarExerciciosPorTurma']>();
  const findResultadosPorExercicios = vi.fn<PainelRepository['findResultadosPorExercicios']>();
  const findResultadosDoAluno = vi.fn<PainelRepository['findResultadosDoAluno']>();
  const contarSubmissoesPorPar = vi.fn<PainelRepository['contarSubmissoesPorPar']>();
  const contarDicasPorPar = vi.fn<PainelRepository['contarDicasPorPar']>();
  const findParesComDiagrama = vi.fn<PainelRepository['findParesComDiagrama']>();
  const ultimaAtividadePorExercicio = vi.fn<PainelRepository['ultimaAtividadePorExercicio']>();
  const tentativasAteAcertar = vi.fn<PainelRepository['tentativasAteAcertar']>();
  const exerciciosComUltimoEnvioEmErro = vi.fn<PainelRepository['exerciciosComUltimoEnvioEmErro']>();
  const paresComUltimoEnvioEmErro = vi.fn<PainelRepository['paresComUltimoEnvioEmErro']>();

  const painelRepository: PainelRepository = {
    contarAlunosPorTurma,
    contarAlunosDistintos,
    contarExerciciosPorTurma,
    findResultadosPorExercicios,
    findResultadosDoAluno,
    contarSubmissoesPorPar,
    contarDicasPorPar,
    findParesComDiagrama,
    ultimaAtividadePorExercicio,
    tentativasAteAcertar,
    exerciciosComUltimoEnvioEmErro,
    paresComUltimoEnvioEmErro,
  };

  const turmaRepository = {
    findById: findTurmaById,
    findByProfessorId,
  } as unknown as TurmaRepository;
  const exercicioRepository = { findByTurmaId: findExerciciosByTurmaId } as unknown as ExercicioRepository;
  const matriculaRepository = {
    findByTurmaId: findMatriculasByTurmaId,
    findAlunosDaTurma,
    findByAlunoId,
    findByAlunoETurma,
  } as unknown as MatriculaRepository;

  const service = new PainelService(painelRepository, turmaRepository, exercicioRepository, matriculaRepository);

  beforeEach(() => {
    vi.clearAllMocks();
    contarAlunosPorTurma.mockResolvedValue([]);
    contarAlunosDistintos.mockResolvedValue(0);
    contarExerciciosPorTurma.mockResolvedValue([]);
    findResultadosPorExercicios.mockResolvedValue([]);
    findResultadosDoAluno.mockResolvedValue([]);
    contarSubmissoesPorPar.mockResolvedValue([]);
    contarDicasPorPar.mockResolvedValue([]);
    findParesComDiagrama.mockResolvedValue([]);
    ultimaAtividadePorExercicio.mockResolvedValue([]);
    tentativasAteAcertar.mockResolvedValue([]);
    exerciciosComUltimoEnvioEmErro.mockResolvedValue([]);
    paresComUltimoEnvioEmErro.mockResolvedValue([]);
  });

  describe('daTurma', () => {
    it('recusa turma de outro professor', async () => {
      findTurmaById.mockResolvedValue(turma({ professor_id: 'outro' }));

      await expect(service.daTurma(PROFESSOR, TURMA)).rejects.toThrow(/não é o professor/);
      expect(findAlunosDaTurma).not.toHaveBeenCalled();
    });

    it('gera uma célula por par aluno × exercício', async () => {
      findTurmaById.mockResolvedValue(turma());
      findExerciciosByTurmaId.mockResolvedValue([exercicio({ id: 'e1' }), exercicio({ id: 'e2' })]);
      findAlunosDaTurma.mockResolvedValue([aluno('a1', 'Ana'), aluno('a2', 'Bia')]);
      findMatriculasByTurmaId.mockResolvedValue([matricula('a1', null), matricula('a2', null)]);

      const painel = await service.daTurma(PROFESSOR, TURMA);

      expect(painel.celulas).toHaveLength(4);
      expect(painel.celulas.every((celula) => celula.estado === 'nao_iniciou')).toBe(true);
    });

    // Fase 9, D3: sem isto metade da grade seria "não iniciou" falso.
    it('não gera célula de exercício de prova para quem não foi sorteado com ela', async () => {
      findTurmaById.mockResolvedValue(turma());
      findExerciciosByTurmaId.mockResolvedValue([
        exercicio({ id: 'solto', prova_id: null }),
        exercicio({ id: 'da-prova-a', prova_id: 'prova-a' }),
      ]);
      findAlunosDaTurma.mockResolvedValue([aluno('a1', 'Ana'), aluno('a2', 'Bia')]);
      findMatriculasByTurmaId.mockResolvedValue([matricula('a1', 'prova-a'), matricula('a2', 'prova-b')]);

      const painel = await service.daTurma(PROFESSOR, TURMA);

      expect(painel.celulas.filter((celula) => celula.alunoId === 'a1')).toHaveLength(2);
      expect(painel.celulas.filter((celula) => celula.alunoId === 'a2')).toHaveLength(1);
      expect(painel.celulas.find((celula) => celula.alunoId === 'a2')?.exercicioId).toBe('solto');
    });

    it('conta tentativas e dicas por par, e marca atividade só por diagrama salvo', async () => {
      findTurmaById.mockResolvedValue(turma());
      findExerciciosByTurmaId.mockResolvedValue([exercicio({ id: 'e1' })]);
      findAlunosDaTurma.mockResolvedValue([aluno('a1', 'Ana'), aluno('a2', 'Bia')]);
      findMatriculasByTurmaId.mockResolvedValue([matricula('a1', null), matricula('a2', null)]);
      contarSubmissoesPorPar.mockResolvedValue([
        { usuarioId: 'a1', exercicioId: 'e1', total: 3 },
      ]);
      contarDicasPorPar.mockResolvedValue([
        { usuarioId: 'a1', exercicioId: 'e1', total: 2 },
      ]);
      findParesComDiagrama.mockResolvedValue([{ usuarioId: 'a2', exercicioId: 'e1' }]);

      const painel = await service.daTurma(PROFESSOR, TURMA);
      const daAna = painel.celulas.find((celula) => celula.alunoId === 'a1');
      const daBia = painel.celulas.find((celula) => celula.alunoId === 'a2');

      expect(daAna).toMatchObject({ tentativas: 3, dicas: 2, estado: 'em_andamento' });
      expect(daBia).toMatchObject({ tentativas: 0, estado: 'em_andamento' });
    });

    it('calcula a dificuldade só entre quem mexeu no exercício', async () => {
      findTurmaById.mockResolvedValue(turma());
      findExerciciosByTurmaId.mockResolvedValue([exercicio({ id: 'e1' })]);
      findAlunosDaTurma.mockResolvedValue([aluno('a1', 'Ana'), aluno('a2', 'Bia'), aluno('a3', 'Caio')]);
      findMatriculasByTurmaId.mockResolvedValue([
        matricula('a1', null),
        matricula('a2', null),
        matricula('a3', null),
      ]);
      contarSubmissoesPorPar.mockResolvedValue([
        { usuarioId: 'a1', exercicioId: 'e1', total: 1 },
        { usuarioId: 'a2', exercicioId: 'e1', total: 3 },
      ]);
      findResultadosPorExercicios.mockResolvedValue([
        resultado({ usuario_id: 'a1', exercicio_id: 'e1', sql_correto: true }),
        resultado({ usuario_id: 'a2', exercicio_id: 'e1', sql_correto: false }),
      ]);

      const [dificuldade] = (await service.daTurma(PROFESSOR, TURMA)).dificuldade;

      // Caio nem tentou: não entra em nenhuma das duas médias.
      expect(dificuldade?.taxaAcerto).toBe(0.5);
      expect(dificuldade?.mediaTentativas).toBe(2);
    });

    it('deixa a dificuldade nula quando ninguém tentou, em vez de fingir 0%', async () => {
      findTurmaById.mockResolvedValue(turma());
      findExerciciosByTurmaId.mockResolvedValue([exercicio({ id: 'e1' })]);
      findAlunosDaTurma.mockResolvedValue([aluno('a1', 'Ana')]);
      findMatriculasByTurmaId.mockResolvedValue([matricula('a1', null)]);

      const [dificuldade] = (await service.daTurma(PROFESSOR, TURMA)).dificuldade;

      expect(dificuldade?.taxaAcerto).toBeNull();
      expect(dificuldade?.mediaTentativas).toBeNull();
    });
  });

  describe('doProfessor', () => {
    it('conta turmas ativas e encerradas separadamente', async () => {
      findByProfessorId.mockResolvedValue([turma({ id: 't1' }), turma({ id: 't2', encerrada_em: new Date() })]);
      findExerciciosByTurmaId.mockResolvedValue([]);

      const painel = await service.doProfessor(PROFESSOR);

      expect(painel.resumo.turmasAtivas).toBe(1);
      expect(painel.resumo.turmasEncerradas).toBe(1);
    });

    // O mesmo aluno em duas turmas do professor é uma pessoa só no cartão de resumo.
    it('não conta duas vezes o aluno matriculado em duas turmas do professor', async () => {
      findByProfessorId.mockResolvedValue([turma({ id: 't1' }), turma({ id: 't2' })]);
      findExerciciosByTurmaId.mockResolvedValue([]);
      contarAlunosPorTurma.mockResolvedValue([
        { turmaId: 't1', total: 1 },
        { turmaId: 't2', total: 1 },
      ]);
      contarAlunosDistintos.mockResolvedValue(1);

      const painel = await service.doProfessor(PROFESSOR);

      expect(painel.resumo.alunos).toBe(1);
      // Por turma segue sendo a matrícula: cada turma tem mesmo um aluno.
      expect(painel.turmas.map((item) => item.alunos)).toEqual([1, 1]);
    });

    // Fase 9, D4
    it('conta na fila de revisão só o que tem parte manual pendente', async () => {
      findByProfessorId.mockResolvedValue([turma()]);
      findExerciciosByTurmaId.mockResolvedValue([
        exercicio({ id: 'so-sql' }),
        exercicio({ id: 'com-mer', mer_gabarito: {} }),
      ]);
      findResultadosPorExercicios.mockResolvedValue([
        resultado({ exercicio_id: 'so-sql', finalizado_em: new Date() }),
        resultado({ exercicio_id: 'com-mer', finalizado_em: new Date() }),
      ]);

      const painel = await service.doProfessor(PROFESSOR);

      expect(painel.resumo.aguardandoRevisao).toBe(1);
      expect(painel.turmas[0]?.entregas).toBe(2);
    });
  });

  describe('doAluno', () => {
    it('agrupa as turmas por disciplina', async () => {
      findByAlunoId.mockResolvedValue([matricula('a1', null), { ...matricula('a1', null), turma_id: 't2' }]);
      findTurmaById.mockImplementation((id: string) =>
        Promise.resolve(
          id === TURMA ? turma() : turma({ id: 't2', disciplina: 'Engenharia de Software', nome: 'Turma B' }),
        ),
      );
      findExerciciosByTurmaId.mockResolvedValue([]);

      const painel = await service.doAluno('a1');

      expect(painel.disciplinas.map((grupo) => grupo.disciplina)).toEqual([
        'Banco de Dados',
        'Engenharia de Software',
      ]);
    });

    it('separa o que falta fazer do que já foi entregue', async () => {
      findByAlunoId.mockResolvedValue([matricula('a1', null)]);
      findTurmaById.mockResolvedValue(turma());
      findExerciciosByTurmaId.mockResolvedValue([exercicio({ id: 'feito' }), exercicio({ id: 'pendente' })]);
      findResultadosDoAluno.mockResolvedValue([
        resultado({ usuario_id: 'a1', exercicio_id: 'feito', finalizado_em: new Date(), sql_correto: true }),
      ]);

      const painel = await service.doAluno('a1');

      expect(painel.pendencias.map((item) => item.exercicio.id)).toEqual(['pendente']);
      expect(painel.historico.map((item) => item.exercicio.id)).toEqual(['feito']);
      expect(painel.resumo).toMatchObject({ pendentes: 1, entregues: 1, acertos: 1 });
    });
  });
  describe('atividadesDoAluno', () => {
    function turmaDoProfessor(): void {
      findTurmaById.mockResolvedValue(turma());
      findAlunosDaTurma.mockResolvedValue([aluno('a1', 'Ana')]);
    }

    it('recusa turma de outro professor', async () => {
      findTurmaById.mockResolvedValue(turma({ professor_id: 'outro' }));

      await expect(service.atividadesDoAluno(PROFESSOR, TURMA, 'a1')).rejects.toThrow(/não é o professor/);
    });

    it('recusa aluno que não está na turma', async () => {
      turmaDoProfessor();
      findByAlunoETurma.mockResolvedValue(null);
      findExerciciosByTurmaId.mockResolvedValue([]);

      await expect(service.atividadesDoAluno(PROFESSOR, TURMA, 'a1')).rejects.toThrow(/não encontrado/);
    });

    // Fase 10, D4: o professor corrige a pessoa, vendo tudo o que ela tem na turma.
    it('devolve todas as atividades visíveis ao aluno, com nota e estado', async () => {
      turmaDoProfessor();
      findByAlunoETurma.mockResolvedValue(matricula('a1', null));
      findExerciciosByTurmaId.mockResolvedValue([exercicio({ id: 'e1' }), exercicio({ id: 'e2' })]);
      findResultadosDoAluno.mockResolvedValue([
        resultado({ usuario_id: 'a1', exercicio_id: 'e1', sql_correto: true }),
      ]);

      const dados = await service.atividadesDoAluno(PROFESSOR, TURMA, 'a1');

      expect(dados.aluno.nome).toBe('Ana');
      expect(dados.atividades).toHaveLength(2);
      expect(dados.atividades[0]).toMatchObject({ estado: 'correto', sqlCorreto: true });
      expect(dados.atividades[1]).toMatchObject({ estado: 'nao_iniciou' });
    });

    // D3: o que a prova sorteada dele não libera nem aparece pro professor corrigir.
    it('não devolve exercício de prova que não é a do aluno', async () => {
      turmaDoProfessor();
      findByAlunoETurma.mockResolvedValue(matricula('a1', 'prova-a'));
      findExerciciosByTurmaId.mockResolvedValue([
        exercicio({ id: 'da-prova-a', prova_id: 'prova-a' }),
        exercicio({ id: 'da-prova-b', prova_id: 'prova-b' }),
      ]);

      const dados = await service.atividadesDoAluno(PROFESSOR, TURMA, 'a1');

      expect(dados.atividades.map((item) => item.exercicio.id)).toEqual(['da-prova-a']);
    });

    // D10: é o sinal que faz o professor decidir se devolve o envio.
    it('marca a atividade cujo último envio morreu em erro de sintaxe', async () => {
      turmaDoProfessor();
      findByAlunoETurma.mockResolvedValue(matricula('a1', null));
      findExerciciosByTurmaId.mockResolvedValue([exercicio({ id: 'e1' })]);
      exerciciosComUltimoEnvioEmErro.mockResolvedValue(['e1']);

      const dados = await service.atividadesDoAluno(PROFESSOR, TURMA, 'a1');

      expect(dados.atividades[0]?.ultimoEnvioComErro).toBe(true);
    });
  });
});
