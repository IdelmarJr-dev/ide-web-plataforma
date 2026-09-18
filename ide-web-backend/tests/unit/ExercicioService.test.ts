import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Exercicio, Prova, Turma } from '../../src/generated/prisma/client';
import type { ExercicioRepository } from '../../src/repositories/ExercicioRepository';
import type { ProvaRepository } from '../../src/repositories/ProvaRepository';
import type { TurmaRepository } from '../../src/repositories/TurmaRepository';
import type { MatriculaRepository } from '../../src/repositories/MatriculaRepository';
import { ExercicioService } from '../../src/services/ExercicioService';
import { buildMatricula, criarAcessoExercicio } from '../apoio/acessoExercicio';

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

function buildProva(overrides: Partial<Prova> = {}): Prova {
  return {
    id: 'prova-1',
    turma_id: 'turma-1',
    titulo: 'Prova A',
    criado_em: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}


describe('ExercicioService', () => {
  const findTurmaById = vi.fn<TurmaRepository['findById']>();
  const findExercicioById = vi.fn<ExercicioRepository['findById']>();
  const findByTurmaId = vi.fn<ExercicioRepository['findByTurmaId']>();
  const criarExercicio = vi.fn<ExercicioRepository['create']>();
  const findByAlunoETurma = vi.fn<MatriculaRepository['findByAlunoETurma']>();
  const findProvaById = vi.fn<ProvaRepository['findById']>();

  const turmaRepository: TurmaRepository = {
    findById: findTurmaById,
    findByCodigo: vi.fn(),
    findByProfessorId: vi.fn(),
    findAll: vi.fn(),
    create: vi.fn(),
    definirEncerramento: vi.fn(),
  };
  const exercicioRepository: ExercicioRepository = {
    findById: findExercicioById,
    proximaOrdem: vi.fn(),
    findByTurmaId,
    findPublicos: vi.fn(),
    findByIds: vi.fn(),
    create: criarExercicio,
    update: vi.fn(),
    findSemProva: vi.fn(),
    vincularAProva: vi.fn(),
    definirGabaritoLiberado: vi.fn(),
  };
  const matriculaRepository: MatriculaRepository = {
    findByAlunoETurma,
    findByAlunoId: vi.fn(),
    findByTurmaId: vi.fn(),
    findAlunosDaTurma: vi.fn(),
    criar: vi.fn(),
    definirProva: vi.fn(),
  };
  const { acessoExercicio, darAcesso, negarAcesso } = criarAcessoExercicio(exercicioRepository, findByAlunoETurma);
  const provaRepository: ProvaRepository = {
    findById: findProvaById,
    findByTurmaId: vi.fn(),
    create: vi.fn(),
  };
  const service = new ExercicioService(
    exercicioRepository,
    turmaRepository,
    matriculaRepository,
    provaRepository,
    acessoExercicio,
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('impede que um professor crie exercício em turma que não é dele', async () => {
    findTurmaById.mockResolvedValue(buildTurma({ professor_id: 'outro-professor' }));

    await expect(
      service.criar('professor-1', {
        turmaId: 'turma-1',
        titulo: 'X',
        enunciado: 'Y',
        nivelDificuldade: 'iniciante',
        ordem: 1,
      }),
    ).rejects.toThrow();

    expect(criarExercicio).not.toHaveBeenCalled();
  });

  it('rejeita criar exercício vinculado a uma prova de outra turma', async () => {
    findTurmaById.mockResolvedValue(buildTurma());
    findProvaById.mockResolvedValue(buildProva({ turma_id: 'outra-turma' }));

    await expect(
      service.criar('professor-1', {
        turmaId: 'turma-1',
        provaId: 'prova-1',
        titulo: 'X',
        enunciado: 'Y',
        nivelDificuldade: 'iniciante',
        ordem: 1,
      }),
    ).rejects.toThrow();

    expect(criarExercicio).not.toHaveBeenCalled();
  });

  it('permite que um aluno da turma liste os exercícios dela', async () => {
    darAcesso();
    findByTurmaId.mockResolvedValue([buildExercicio({ sql_gabarito: 'SELECT 1' })]);

    const resultado = await service.listarPorTurma('aluno-1', 'aluno', 'turma-1');

    expect(resultado).toHaveLength(1);
    expect(findByTurmaId).toHaveBeenCalledWith('turma-1');
  });

  it('mostra pro aluno só exercícios soltos ou da prova sorteada pra ele', async () => {
    findByAlunoETurma.mockResolvedValue(buildMatricula({ prova_id: 'prova-1' }));
    findByTurmaId.mockResolvedValue([
      buildExercicio({ id: 'ex-solto', prova_id: null }),
      buildExercicio({ id: 'ex-minha-prova', prova_id: 'prova-1' }),
      buildExercicio({ id: 'ex-outra-prova', prova_id: 'prova-2' }),
    ]);

    const resultado = await service.listarPorTurma('aluno-1', 'aluno', 'turma-1');

    expect(resultado.map((exercicio) => exercicio.id)).toEqual(['ex-solto', 'ex-minha-prova']);
  });

  it('não filtra por prova quando quem lista é o professor', async () => {
    findTurmaById.mockResolvedValue(buildTurma());
    findByTurmaId.mockResolvedValue([
      buildExercicio({ id: 'ex-prova-1', prova_id: 'prova-1' }),
      buildExercicio({ id: 'ex-prova-2', prova_id: 'prova-2' }),
    ]);

    const resultado = await service.listarPorTurma('professor-1', 'professor', 'turma-1');

    expect(resultado).toHaveLength(2);
  });

  it('rejeita listagem para aluno sem matrícula na turma', async () => {
    negarAcesso();

    await expect(service.listarPorTurma('aluno-1', 'aluno', 'turma-1')).rejects.toThrow();
  });

  it('permite que o pesquisador liste os exercícios de qualquer turma, sem filtro de prova', async () => {
    findTurmaById.mockResolvedValue(buildTurma());
    findByTurmaId.mockResolvedValue([buildExercicio(), buildExercicio({ id: 'exercicio-2', prova_id: 'prova-1' })]);

    const exercicios = await service.listarPorTurma('pesquisador-1', 'pesquisador', 'turma-1');

    expect(exercicios).toHaveLength(2);
  });

  it('pesquisador recebe 404 para turma inexistente', async () => {
    findTurmaById.mockResolvedValue(null);

    await expect(service.listarPorTurma('pesquisador-1', 'pesquisador', 'turma-x')).rejects.toThrow();
  });

  it('permite que um aluno da turma busque um exercício por id', async () => {
    findExercicioById.mockResolvedValue(buildExercicio());
    darAcesso();

    const exercicio = await service.buscarPorId('aluno-1', 'aluno', 'exercicio-1');

    expect(exercicio.id).toBe('exercicio-1');
  });

  it('rejeita busca por id de aluno sem matrícula na turma do exercício', async () => {
    findExercicioById.mockResolvedValue(buildExercicio());
    negarAcesso();

    await expect(service.buscarPorId('aluno-1', 'aluno', 'exercicio-1')).rejects.toThrow();
  });

  it('libera exercício público pra aluno sem matrícula nenhuma', async () => {
    findExercicioById.mockResolvedValue(buildExercicio({ publico: true }));
    negarAcesso();

    const exercicio = await service.buscarPorId('aluno-solto', 'aluno', 'exercicio-1');

    expect(exercicio.id).toBe('exercicio-1');
  });

  it('exercício público não entra no filtro de prova sorteada', async () => {
    findExercicioById.mockResolvedValue(buildExercicio({ publico: true, prova_id: 'prova-1' }));
    negarAcesso();

    await expect(service.buscarPorId('aluno-solto', 'aluno', 'exercicio-1')).resolves.toBeDefined();
  });

  it('rejeita busca por id de exercício de uma prova que não é a do aluno', async () => {
    findExercicioById.mockResolvedValue(buildExercicio({ prova_id: 'prova-1' }));
    darAcesso();
    findByAlunoETurma.mockResolvedValue(buildMatricula({ prova_id: 'prova-2' }));

    await expect(service.buscarPorId('aluno-1', 'aluno', 'exercicio-1')).rejects.toThrow();
  });
});
