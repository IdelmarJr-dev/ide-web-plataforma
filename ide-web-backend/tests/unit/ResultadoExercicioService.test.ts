import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  Exercicio,
  MatriculaTurma,
  RespostaDissertativa,
  ResultadoExercicio,
  SubmissaoSql,
  Turma,
} from '../../src/generated/prisma/client';
import type { ExercicioRepository } from '../../src/repositories/ExercicioRepository';
import type { MatriculaRepository } from '../../src/repositories/MatriculaRepository';
import type { RespostaDissertativaRepository } from '../../src/repositories/RespostaDissertativaRepository';
import type { ResultadoExercicioRepository } from '../../src/repositories/ResultadoExercicioRepository';
import type { SubmissaoSqlRepository } from '../../src/repositories/SubmissaoSqlRepository';
import type { TurmaRepository } from '../../src/repositories/TurmaRepository';
import { ResultadoExercicioService } from '../../src/services/ResultadoExercicioService';

function buildTurma(overrides: Partial<Turma> = {}): Turma {
  return {
    id: 'turma-1',
    nome: 'Turma A',
    disciplina: 'Banco de Dados',
    semestre: '2026.2',
    turno: null,
    sala: null,
    professor_id: 'professor-1',
    codigo: 'ABC123',
    encerrada_em: null,
    criado_em: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function buildExercicio(overrides: Partial<Exercicio> = {}): Exercicio {
  return {
    id: 'exercicio-1',
    turma_id: 'turma-1',
    prova_id: null,
    titulo: 'Consulta básica',
    enunciado: 'Escreva uma query que...',
    nivel_dificuldade: 'iniciante',
    mer_gabarito: null,
    modo_mer: 'conceitual_logico',
    publico: false,
    sql_gabarito: null,
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

function buildResultado(overrides: Partial<ResultadoExercicio> = {}): ResultadoExercicio {
  return {
    id: 'resultado-1',
    usuario_id: 'aluno-1',
    exercicio_id: 'exercicio-1',
    sql_correto: true,
    mer_avaliacao: null,
    dissertativa_avaliacao: null,
    acertos: 1,
    erros: 0,
    pontuacao: null,
    revisado: true,
    finalizado_em: null,
    envio_liberado_em: null,
    revisado_em: new Date('2026-01-02T00:00:00.000Z'),
    revisado_por: 'professor-1',
    criado_em: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function buildMatricula(overrides: Partial<MatriculaTurma> = {}): MatriculaTurma {
  return {
    id: 'matricula-1',
    aluno_id: 'aluno-1',
    turma_id: 'turma-1',
    prova_id: null,
    criado_em: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('ResultadoExercicioService', () => {
  const findExercicioById = vi.fn<ExercicioRepository['findById']>();
  const definirGabaritoLiberado = vi.fn<ExercicioRepository['definirGabaritoLiberado']>();
  const findTurmaById = vi.fn<TurmaRepository['findById']>();
  const findResultado = vi.fn<ResultadoExercicioRepository['findByUsuarioEExercicio']>();
  const upsertRevisao = vi.fn<ResultadoExercicioRepository['upsertRevisao']>();
  const findMatricula = vi.fn<MatriculaRepository['findByAlunoETurma']>();
  const findUltimaTentativa = vi.fn<SubmissaoSqlRepository['findUltimaTentativa']>();
  const findDissertativa = vi.fn<RespostaDissertativaRepository['findByExercicioEUsuario']>();

  const exercicioRepository: ExercicioRepository = {
    findPublicos: vi.fn(),
    findByIds: vi.fn(),
    findById: findExercicioById,
    findByTurmaId: vi.fn(),
    proximaOrdem: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    findSemProva: vi.fn(),
    vincularAProva: vi.fn(),
    definirGabaritoLiberado,
  };
  const turmaRepository: TurmaRepository = {
    findById: findTurmaById,
    findByCodigo: vi.fn(),
    findAll: vi.fn(),
    definirEncerramento: vi.fn(),
    findByProfessorId: vi.fn(),
    create: vi.fn(),
  };
  const resultadoRepository: ResultadoExercicioRepository = {
    findByUsuarioEExercicio: findResultado,
    upsertAcertoAutomatico: vi.fn(),
    liberarEnvio: vi.fn(),
    limparEnvioLiberado: vi.fn(),
    marcarFinalizado: vi.fn(),
    upsertRevisao,
  };
  const matriculaRepository = {
    findByAlunoETurma: findMatricula,
    findByAlunoId: vi.fn(),
    findByTurmaId: vi.fn(),
    findAlunosDaTurma: vi.fn(),
    criar: vi.fn(),
    definirProva: vi.fn(),
  } as unknown as MatriculaRepository;
  const submissaoRepository = { findUltimaTentativa } as unknown as SubmissaoSqlRepository;
  const respostaDissertativaRepository: RespostaDissertativaRepository = {
    findByExercicioEUsuario: findDissertativa,
  };
  const service = new ResultadoExercicioService(
    resultadoRepository,
    exercicioRepository,
    turmaRepository,
    matriculaRepository,
    submissaoRepository,
    respostaDissertativaRepository,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    // O caminho feliz é o aluno matriculado; os testes de D16 sobrescrevem.
    findMatricula.mockResolvedValue(buildMatricula());
  });

  it('não expõe resultado quando o gabarito ainda não foi liberado', async () => {
    findExercicioById.mockResolvedValue(buildExercicio({ gabarito_liberado: false }));

    const resultado = await service.meuResultado('aluno-1', 'exercicio-1');

    expect(resultado).toBeNull();
    expect(findResultado).not.toHaveBeenCalled();
  });

  it('não expõe resultado ainda não revisado, mesmo com gabarito liberado', async () => {
    findExercicioById.mockResolvedValue(buildExercicio({ gabarito_liberado: true }));
    findResultado.mockResolvedValue(buildResultado({ revisado: false }));

    const resultado = await service.meuResultado('aluno-1', 'exercicio-1');

    expect(resultado).toBeNull();
  });

  it('expõe o resultado quando liberado e revisado', async () => {
    findExercicioById.mockResolvedValue(buildExercicio({ gabarito_liberado: true }));
    findResultado.mockResolvedValue(buildResultado());

    const resultado = await service.meuResultado('aluno-1', 'exercicio-1');

    expect(resultado).not.toBeNull();
    expect(resultado?.resultado.id).toBe('resultado-1');
  });

  it('impede que um professor libere o gabarito de exercício de outra turma', async () => {
    findExercicioById.mockResolvedValue(buildExercicio());
    findTurmaById.mockResolvedValue(buildTurma({ professor_id: 'outro-professor' }));

    await expect(service.definirGabaritoLiberado('professor-1', 'exercicio-1', true)).rejects.toThrow();
    expect(definirGabaritoLiberado).not.toHaveBeenCalled();
  });

  it('libera o gabarito com a data e desfaz a liberação limpando a data', async () => {
    findExercicioById.mockResolvedValue(buildExercicio());
    findTurmaById.mockResolvedValue(buildTurma());
    definirGabaritoLiberado.mockResolvedValue(buildExercicio());

    await service.definirGabaritoLiberado('professor-1', 'exercicio-1', true);
    expect(definirGabaritoLiberado).toHaveBeenCalledWith('exercicio-1', expect.any(Date));

    await service.definirGabaritoLiberado('professor-1', 'exercicio-1', false);
    expect(definirGabaritoLiberado).toHaveBeenLastCalledWith('exercicio-1', null);
  });

  it('impede que um professor revise resultado de exercício que não é dele', async () => {
    findExercicioById.mockResolvedValue(buildExercicio());
    findTurmaById.mockResolvedValue(buildTurma({ professor_id: 'outro-professor' }));

    await expect(service.revisar('professor-1', 'exercicio-1', 'aluno-1', { sqlCorreto: true })).rejects.toThrow();
    expect(upsertRevisao).not.toHaveBeenCalled();
  });

  it('impede que um professor veja o resultado de um aluno de exercício que não é dele', async () => {
    findExercicioById.mockResolvedValue(buildExercicio());
    findTurmaById.mockResolvedValue(buildTurma({ professor_id: 'outro-professor' }));

    await expect(service.resultadoDoAluno('professor-1', 'exercicio-1', 'aluno-1')).rejects.toThrow();
    expect(findResultado).not.toHaveBeenCalled();
  });

  it('retorna o resultado de um aluno específico mesmo sem gabarito liberado ou revisão', async () => {
    findExercicioById.mockResolvedValue(buildExercicio({ gabarito_liberado: false }));
    findTurmaById.mockResolvedValue(buildTurma());
    findResultado.mockResolvedValue(buildResultado({ revisado: false }));

    const resultado = await service.resultadoDoAluno('professor-1', 'exercicio-1', 'aluno-1');

    expect(resultado).not.toBeNull();
  });
  // Fase 9, D16: antes disso `revisar` fazia upsert cego e criava o resultado do zero para
  // qualquer UUID — dava pra lançar nota em quem não é da turma.
  it('impede revisar aluno que não está matriculado na turma do exercício', async () => {
    findExercicioById.mockResolvedValue(buildExercicio());
    findTurmaById.mockResolvedValue(buildTurma());
    findMatricula.mockResolvedValue(null);

    await expect(service.revisar('professor-1', 'exercicio-1', 'estranho-1', { sqlCorreto: true })).rejects.toThrow(
      /não está matriculado/,
    );
    expect(upsertRevisao).not.toHaveBeenCalled();
  });

  it('revisa normalmente o aluno matriculado', async () => {
    findExercicioById.mockResolvedValue(buildExercicio());
    findTurmaById.mockResolvedValue(buildTurma());
    upsertRevisao.mockResolvedValue(buildResultado());

    await service.revisar('professor-1', 'exercicio-1', 'aluno-1', { sqlCorreto: true });

    expect(upsertRevisao).toHaveBeenCalledWith('aluno-1', 'exercicio-1', 'professor-1', { sql_correto: true });
  });

  // Fase 9, D17
  it('devolve a última submissão SQL e a dissertativa do aluno', async () => {
    findExercicioById.mockResolvedValue(buildExercicio());
    findTurmaById.mockResolvedValue(buildTurma());
    findUltimaTentativa.mockResolvedValue({
      query_sql: 'SELECT nome FROM clientes',
      correta: false,
      criado_em: new Date('2026-01-03T00:00:00.000Z'),
    } as SubmissaoSql);
    findDissertativa.mockResolvedValue({
      texto: 'Usei LEFT JOIN porque...',
      atualizado_em: new Date('2026-01-03T01:00:00.000Z'),
    } as RespostaDissertativa);

    const respostas = await service.respostasDoAluno('professor-1', 'exercicio-1', 'aluno-1');

    expect(respostas.ultimaSubmissaoSql).toEqual({
      query: 'SELECT nome FROM clientes',
      correta: false,
      criadoEm: new Date('2026-01-03T00:00:00.000Z'),
    });
    expect(respostas.dissertativa?.texto).toBe('Usei LEFT JOIN porque...');
  });

  it('devolve nulos quando o aluno não entregou nada, em vez de falhar', async () => {
    findExercicioById.mockResolvedValue(buildExercicio());
    findTurmaById.mockResolvedValue(buildTurma());
    findUltimaTentativa.mockResolvedValue(null);
    findDissertativa.mockResolvedValue(null);

    const respostas = await service.respostasDoAluno('professor-1', 'exercicio-1', 'aluno-1');

    expect(respostas).toEqual({ ultimaSubmissaoSql: null, dissertativa: null });
  });

  it('impede que um professor veja as respostas de aluno em exercício que não é dele', async () => {
    findExercicioById.mockResolvedValue(buildExercicio());
    findTurmaById.mockResolvedValue(buildTurma({ professor_id: 'outro-professor' }));

    await expect(service.respostasDoAluno('professor-1', 'exercicio-1', 'aluno-1')).rejects.toThrow();
    expect(findUltimaTentativa).not.toHaveBeenCalled();
  });
});
