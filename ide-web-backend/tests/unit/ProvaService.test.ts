import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Prova, Turma } from '../../src/generated/prisma/client';
import type { ExercicioRepository } from '../../src/repositories/ExercicioRepository';
import type { ProvaRepository } from '../../src/repositories/ProvaRepository';
import type { TurmaRepository } from '../../src/repositories/TurmaRepository';
import type { MatriculaRepository } from '../../src/repositories/MatriculaRepository';
import { ProvaService } from '../../src/services/ProvaService';
import { buildMatricula } from '../apoio/acessoExercicio';

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

function buildProva(overrides: Partial<Prova> = {}): Prova {
  return {
    id: 'prova-1',
    turma_id: 'turma-1',
    titulo: 'Prova A',
    criado_em: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}


describe('ProvaService', () => {
  const findTurmaById = vi.fn<TurmaRepository['findById']>();
  const findMatriculasDaTurma = vi.fn<MatriculaRepository['findByTurmaId']>();
  const findByTurmaId = vi.fn<ProvaRepository['findByTurmaId']>();
  const criarProva = vi.fn<ProvaRepository['create']>();
  const definirProva = vi.fn<MatriculaRepository['definirProva']>();

  const turmaRepository: TurmaRepository = {
    findById: findTurmaById,
    findByCodigo: vi.fn(),
    findByProfessorId: vi.fn(),
    findAll: vi.fn(),
    create: vi.fn(),
    definirEncerramento: vi.fn(),
  };
  const provaRepository: ProvaRepository = {
    findById: vi.fn(),
    findByTurmaId,
    create: criarProva,
  };
  const matriculaRepository: MatriculaRepository = {
    findByAlunoETurma: vi.fn(),
    findByAlunoId: vi.fn(),
    findByTurmaId: findMatriculasDaTurma,
    findAlunosDaTurma: vi.fn(),
    criar: vi.fn(),
    definirProva,
  };
  const findSemProva = vi.fn<ExercicioRepository['findSemProva']>();
  const vincularAProva = vi.fn<ExercicioRepository['vincularAProva']>();
  const exercicioRepository = { findSemProva, vincularAProva } as unknown as ExercicioRepository;

  const service = new ProvaService(provaRepository, turmaRepository, matriculaRepository, exercicioRepository);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('impede que um professor crie prova em turma que não é dele', async () => {
    findTurmaById.mockResolvedValue(buildTurma({ professor_id: 'outro-professor' }));

    await expect(service.criar('professor-1', 'turma-1', 'Prova A')).rejects.toThrow();
    expect(criarProva).not.toHaveBeenCalled();
  });

  it('rejeita sortear sem nenhuma prova cadastrada', async () => {
    findTurmaById.mockResolvedValue(buildTurma());
    findByTurmaId.mockResolvedValue([]);

    await expect(service.sortear('professor-1', 'turma-1')).rejects.toThrow();
    expect(definirProva).not.toHaveBeenCalled();
  });

  it('sorteia uma prova só pra quem ainda não tem uma', async () => {
    findTurmaById.mockResolvedValue(buildTurma());
    findByTurmaId.mockResolvedValue([buildProva({ id: 'prova-1' }), buildProva({ id: 'prova-2' })]);
    findMatriculasDaTurma.mockResolvedValue([
      buildMatricula({ id: 'matricula-1', aluno_id: 'aluno-1', prova_id: null }),
      buildMatricula({ id: 'matricula-2', aluno_id: 'aluno-2', prova_id: 'prova-1' }),
      buildMatricula({ id: 'matricula-3', aluno_id: 'aluno-3', prova_id: null }),
    ]);
    definirProva.mockResolvedValue(buildMatricula());

    const resultado = await service.sortear('professor-1', 'turma-1');

    expect(resultado.alunosSorteados).toBe(2);
    expect(definirProva).toHaveBeenCalledTimes(2);
    expect(definirProva).toHaveBeenCalledWith('matricula-1', expect.stringMatching(/^prova-[12]$/));
    expect(definirProva).toHaveBeenCalledWith('matricula-3', expect.stringMatching(/^prova-[12]$/));
    expect(definirProva).not.toHaveBeenCalledWith('matricula-2', expect.anything());
  });
  // Fase 10, D13: o assistente distribui o acervo, não cria questão do nada.
  describe('assistente de prova', () => {
    it('monta a prova com a quantidade pedida e vincula as questões', async () => {
      findTurmaById.mockResolvedValue(buildTurma());
      findSemProva.mockResolvedValue([
        { id: 'e1' },
        { id: 'e2' },
        { id: 'e3' },
      ] as never);
      criarProva.mockResolvedValue({ id: 'prova-1', turma_id: 'turma-1', titulo: 'P1' } as never);
      vincularAProva.mockResolvedValue(2);

      const resultado = await service.montarComAssistente('professor-1', 'turma-1', {
        titulo: 'P1',
        quantidade: 2,
      });

      expect(vincularAProva).toHaveBeenCalledWith(['e1', 'e2'], 'prova-1', null);
      expect(resultado.questoes).toBe(2);
    });

    it('recusa quando o acervo não dá, em vez de montar prova pela metade', async () => {
      findTurmaById.mockResolvedValue(buildTurma());
      findSemProva.mockResolvedValue([{ id: 'e1' }] as never);

      await expect(
        service.montarComAssistente('professor-1', 'turma-1', { titulo: 'P1', quantidade: 5 }),
      ).rejects.toThrow(/1 exercício\(s\) sem prova, e você pediu 5/);
      expect(criarProva).not.toHaveBeenCalled();
    });

    it('aplica o prazo a todas as questões de uma vez', async () => {
      const prazo = new Date('2026-10-01T23:59:00.000Z');
      findTurmaById.mockResolvedValue(buildTurma());
      findSemProva.mockResolvedValue([{ id: 'e1' }] as never);
      criarProva.mockResolvedValue({ id: 'prova-1' } as never);
      vincularAProva.mockResolvedValue(1);

      await service.montarComAssistente('professor-1', 'turma-1', { titulo: 'P1', quantidade: 1, prazo });

      expect(vincularAProva).toHaveBeenCalledWith(['e1'], 'prova-1', prazo);
    });

    it('conta o acervo disponível por nível', async () => {
      findTurmaById.mockResolvedValue(buildTurma());
      findSemProva.mockResolvedValue([
        { nivel_dificuldade: 'iniciante' },
        { nivel_dificuldade: 'iniciante' },
        { nivel_dificuldade: 'intermediario' },
      ] as never);

      const acervo = await service.acervoDisponivel('professor-1', 'turma-1');

      expect(acervo).toEqual({ total: 3, porNivel: { iniciante: 2, intermediario: 1 } });
    });
  });
});
