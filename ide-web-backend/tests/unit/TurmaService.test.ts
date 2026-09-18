import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MatriculaTurma, Turma, Usuario } from '../../src/generated/prisma/client';
import type { MatriculaRepository } from '../../src/repositories/MatriculaRepository';
import type { TurmaRepository } from '../../src/repositories/TurmaRepository';
import { TurmaService } from '../../src/services/TurmaService';

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

function buildAluno(overrides: Partial<Usuario> = {}): Usuario {
  return {
    id: 'aluno-1',
    nome: 'Aluno A',
    email: 'aluno@teste.com',
    senha_hash: 'hash',
    papel: 'aluno',
    matricula: null,
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

describe('TurmaService', () => {
  const findTurmaById = vi.fn<TurmaRepository['findById']>();
  const findTurmaByCodigo = vi.fn<TurmaRepository['findByCodigo']>();
  const findAll = vi.fn<TurmaRepository['findAll']>();
  const definirEncerramento = vi.fn<TurmaRepository['definirEncerramento']>();
  const findAlunosDaTurma = vi.fn<MatriculaRepository['findAlunosDaTurma']>();
  const findByAlunoETurma = vi.fn<MatriculaRepository['findByAlunoETurma']>();
  const findByAlunoId = vi.fn<MatriculaRepository['findByAlunoId']>();
  const criarMatricula = vi.fn<MatriculaRepository['criar']>();

  const turmaRepository: TurmaRepository = {
    findById: findTurmaById,
    findByCodigo: findTurmaByCodigo,
    findByProfessorId: vi.fn(),
    findAll,
    create: vi.fn(),
    definirEncerramento,
  };
  const matriculaRepository: MatriculaRepository = {
    findByAlunoETurma,
    findByAlunoId,
    findByTurmaId: vi.fn(),
    findAlunosDaTurma,
    criar: criarMatricula,
    definirProva: vi.fn(),
  };
  const service = new TurmaService(turmaRepository, matriculaRepository);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lista todas as turmas pro pesquisador (pra escolher onde iniciar a pesquisa)', async () => {
    findAll.mockResolvedValue([buildTurma(), buildTurma({ id: 'turma-2', codigo: 'DEF456' })]);

    const turmas = await service.minhas('pesquisador-1', 'pesquisador');

    expect(turmas).toHaveLength(2);
    expect(findAll).toHaveBeenCalled();
  });

  it('devolve todas as turmas em que o aluno está matriculado', async () => {
    findByAlunoId.mockResolvedValue([buildMatricula(), buildMatricula({ id: 'matricula-2', turma_id: 'turma-2' })]);
    findTurmaById.mockImplementation((id) => Promise.resolve(buildTurma({ id })));

    const turmas = await service.minhas('aluno-1', 'aluno');

    expect(turmas.map((turma) => turma.id)).toEqual(['turma-1', 'turma-2']);
  });

  it('impede que um professor liste alunos de uma turma que não é dele', async () => {
    findTurmaById.mockResolvedValue(buildTurma({ professor_id: 'outro-professor' }));

    await expect(service.listarAlunos('professor-1', 'turma-1')).rejects.toThrow();
    expect(findAlunosDaTurma).not.toHaveBeenCalled();
  });

  it('lista os alunos matriculados na turma do professor', async () => {
    findTurmaById.mockResolvedValue(buildTurma());
    findAlunosDaTurma.mockResolvedValue([buildAluno()]);

    const alunos = await service.listarAlunos('professor-1', 'turma-1');

    expect(alunos).toHaveLength(1);
    expect(findAlunosDaTurma).toHaveBeenCalledWith('turma-1');
  });

  describe('matricular', () => {
    it('rejeita código de turma inexistente', async () => {
      findTurmaByCodigo.mockResolvedValue(null);

      await expect(service.matricular('aluno-1', 'NAOEXISTE')).rejects.toThrow();
      expect(criarMatricula).not.toHaveBeenCalled();
    });

    it('matricula o aluno que já chega logado', async () => {
      findTurmaByCodigo.mockResolvedValue(buildTurma());
      findByAlunoETurma.mockResolvedValue(null);

      const turma = await service.matricular('aluno-1', 'ABC123');

      expect(turma.id).toBe('turma-1');
      expect(criarMatricula).toHaveBeenCalledWith('aluno-1', 'turma-1');
    });

    it('recusa matricular duas vezes na mesma turma', async () => {
      findTurmaByCodigo.mockResolvedValue(buildTurma());
      findByAlunoETurma.mockResolvedValue(buildMatricula());

      await expect(service.matricular('aluno-1', 'ABC123')).rejects.toThrow(/já está/i);
      expect(criarMatricula).not.toHaveBeenCalled();
    });

    it('recusa matricular em turma encerrada', async () => {
      findTurmaByCodigo.mockResolvedValue(buildTurma({ encerrada_em: new Date('2026-09-16T12:00:00.000Z') }));

      await expect(service.matricular('aluno-1', 'ABC123')).rejects.toThrow(/encerrada/i);
      expect(criarMatricula).not.toHaveBeenCalled();
    });
  });

  describe('encerrar', () => {
    it('grava a data de encerramento', async () => {
      findTurmaById.mockResolvedValue(buildTurma());
      definirEncerramento.mockResolvedValue(buildTurma({ encerrada_em: new Date() }));

      await service.encerrar('professor-1', 'turma-1');

      expect(definirEncerramento).toHaveBeenCalledWith('turma-1', expect.any(Date));
    });

    it('não reescreve a data de uma turma já encerrada', async () => {
      const encerradaEm = new Date('2026-09-10T12:00:00.000Z');
      findTurmaById.mockResolvedValue(buildTurma({ encerrada_em: encerradaEm }));

      const turma = await service.encerrar('professor-1', 'turma-1');

      expect(turma.encerrada_em).toBe(encerradaEm);
      expect(definirEncerramento).not.toHaveBeenCalled();
    });

    it('recusa encerrar turma de outro professor', async () => {
      findTurmaById.mockResolvedValue(buildTurma({ professor_id: 'outro-professor' }));

      await expect(service.encerrar('professor-1', 'turma-1')).rejects.toThrow();
      expect(definirEncerramento).not.toHaveBeenCalled();
    });

    it('reabrir limpa a data de encerramento', async () => {
      findTurmaById.mockResolvedValue(buildTurma({ encerrada_em: new Date() }));
      definirEncerramento.mockResolvedValue(buildTurma());

      await service.reabrir('professor-1', 'turma-1');

      expect(definirEncerramento).toHaveBeenCalledWith('turma-1', null);
    });
  });
});
