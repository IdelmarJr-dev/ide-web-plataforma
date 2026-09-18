import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DiagramaMer, Exercicio, Turma } from '../../src/generated/prisma/client';
import type { DiagramaMerRepository } from '../../src/repositories/DiagramaMerRepository';
import type { ExercicioRepository } from '../../src/repositories/ExercicioRepository';
import type { TurmaRepository } from '../../src/repositories/TurmaRepository';
import { DiagramaMerService } from '../../src/services/DiagramaMerService';
import { criarAcessoExercicio } from '../apoio/acessoExercicio';

const DOCUMENTO_VAZIO = { versao: 2 as const, conceitual: null, logico: null, conversao: null };

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


function buildDiagrama(overrides: Partial<DiagramaMer> = {}): DiagramaMer {
  return {
    id: 'diagrama-1',
    exercicio_id: 'exercicio-1',
    usuario_id: 'aluno-1',
    conteudo_json: DOCUMENTO_VAZIO,
    versao: 1,
    criado_em: new Date('2026-01-01T00:00:00.000Z'),
    atualizado_em: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('DiagramaMerService', () => {
  const findByExercicioEUsuario = vi.fn<DiagramaMerRepository['findByExercicioEUsuario']>();
  const upsert = vi.fn<DiagramaMerRepository['upsert']>();
  const findExercicioById = vi.fn<ExercicioRepository['findById']>();

  const diagramaMerRepository: DiagramaMerRepository = { findByExercicioEUsuario, upsert };
  const exercicioRepository: ExercicioRepository = {
    findById: findExercicioById,
    findByTurmaId: vi.fn(),
    proximaOrdem: vi.fn(),
    findPublicos: vi.fn(),
    findByIds: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    findSemProva: vi.fn(),
    vincularAProva: vi.fn(),
    definirGabaritoLiberado: vi.fn(),
  };
  const { acessoExercicio, darAcesso, negarAcesso } = criarAcessoExercicio(exercicioRepository);
  const findTurmaById = vi.fn<TurmaRepository['findById']>();
  const turmaRepository = {
    findById: findTurmaById,
    findByCodigo: vi.fn(),
    findByProfessorId: vi.fn(),
    create: vi.fn(),
  } as unknown as TurmaRepository;
  const service = new DiagramaMerService(
    diagramaMerRepository,
    exercicioRepository,
    acessoExercicio,
    turmaRepository,
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('impede que um aluno sem matrícula salve o diagrama', async () => {
    findExercicioById.mockResolvedValue(buildExercicio({ turma_id: 'turma-1' }));
    negarAcesso();

    await expect(service.salvar('aluno-1', 'exercicio-1', DOCUMENTO_VAZIO)).rejects.toThrow();
    expect(upsert).not.toHaveBeenCalled();
  });

  it('salva o diagrama do aluno matriculado na turma do exercício', async () => {
    findExercicioById.mockResolvedValue(buildExercicio());
    darAcesso();
    upsert.mockResolvedValue(buildDiagrama());

    await service.salvar('aluno-1', 'exercicio-1', DOCUMENTO_VAZIO);

    expect(upsert).toHaveBeenCalledWith('exercicio-1', 'aluno-1', DOCUMENTO_VAZIO);
  });

  it('deixa o professor da turma ler o diagrama de um aluno', async () => {
    findExercicioById.mockResolvedValue(buildExercicio());
    findTurmaById.mockResolvedValue({ id: 'turma-1', professor_id: 'professor-1' } as Turma);
    findByExercicioEUsuario.mockResolvedValue(buildDiagrama());

    const diagrama = await service.buscarDoAluno('professor-1', 'exercicio-1', 'aluno-1');

    expect(diagrama?.usuario_id).toBe('aluno-1');
    expect(findByExercicioEUsuario).toHaveBeenCalledWith('exercicio-1', 'aluno-1');
  });

  it('impede que um professor de outra turma leia o diagrama do aluno', async () => {
    findExercicioById.mockResolvedValue(buildExercicio());
    findTurmaById.mockResolvedValue({ id: 'turma-1', professor_id: 'outro-professor' } as Turma);

    await expect(service.buscarDoAluno('professor-1', 'exercicio-1', 'aluno-1')).rejects.toThrow();
    expect(findByExercicioEUsuario).not.toHaveBeenCalled();
  });

  it('retorna null quando o aluno ainda não salvou nenhum diagrama', async () => {
    findExercicioById.mockResolvedValue(buildExercicio());
    darAcesso();
    findByExercicioEUsuario.mockResolvedValue(null);

    const resultado = await service.buscar('aluno-1', 'exercicio-1');

    expect(resultado).toBeNull();
  });
});
