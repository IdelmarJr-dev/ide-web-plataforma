import { vi } from 'vitest';
import type { MatriculaTurma, Turma } from '../../src/generated/prisma/client';
import type { ExercicioRepository } from '../../src/repositories/ExercicioRepository';
import type { MatriculaRepository } from '../../src/repositories/MatriculaRepository';
import type { ResultadoExercicioRepository } from '../../src/repositories/ResultadoExercicioRepository';
import type { SubmissaoSqlRepository } from '../../src/repositories/SubmissaoSqlRepository';
import type { TurmaRepository } from '../../src/repositories/TurmaRepository';
import { AcessoExercicioService } from '../../src/services/AcessoExercicioService';

type BuscaDeMatricula = ReturnType<typeof vi.fn<MatriculaRepository['findByAlunoETurma']>>;

export interface AcessoDeTeste {
  acessoExercicio: AcessoExercicioService;
  findByAlunoETurma: BuscaDeMatricula;
  findTurmaById: ReturnType<typeof vi.fn<TurmaRepository['findById']>>;
  /** Última submissão do aluno — é por ela que o envio único da prova é barrado. */
  findUltimaTentativa: ReturnType<typeof vi.fn<SubmissaoSqlRepository['findUltimaTentativa']>>;
  /** Resultado do aluno — carrega o `envio_liberado_em` concedido pelo professor. */
  findResultado: ReturnType<typeof vi.fn<ResultadoExercicioRepository['findByUsuarioEExercicio']>>;
  /** Matrícula presente + turma aberta: o caso comum de aluno com acesso. */
  darAcesso: () => void;
  /** Sem matrícula na turma do exercício. */
  negarAcesso: () => void;
}

export function buildMatricula(overrides: Partial<MatriculaTurma> = {}): MatriculaTurma {
  return {
    id: 'matricula-1',
    aluno_id: 'aluno-1',
    turma_id: 'turma-1',
    prova_id: null,
    criado_em: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

export function buildTurmaAberta(overrides: Partial<Turma> = {}): Turma {
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

/**
 * Monta o `AcessoExercicioService` de verdade (não um dublê) sobre repositórios
 * falsos, pra que cada serviço que depende dele exercite a regra real de acesso.
 */
export function criarAcessoExercicio(
  exercicioRepository: ExercicioRepository,
  // Quem já tem o próprio dublê de matrícula passa o mesmo aqui, senão os dois
  // ficariam respondendo coisas diferentes pra mesma pergunta.
  buscaDeMatricula?: BuscaDeMatricula,
): AcessoDeTeste {
  const findTurmaById = vi.fn<TurmaRepository['findById']>();
  const findUltimaTentativa = vi.fn<SubmissaoSqlRepository['findUltimaTentativa']>();
  const findResultado = vi.fn<ResultadoExercicioRepository['findByUsuarioEExercicio']>();
  const findByAlunoETurma = buscaDeMatricula ?? vi.fn<MatriculaRepository['findByAlunoETurma']>();

  const matriculaRepository: MatriculaRepository = {
    findByAlunoETurma,
    findByAlunoId: vi.fn(),
    findByTurmaId: vi.fn(),
    findAlunosDaTurma: vi.fn(),
    criar: vi.fn(),
    definirProva: vi.fn(),
  };

  const turmaRepository: TurmaRepository = {
    findById: findTurmaById,
    findByCodigo: vi.fn(),
    findByProfessorId: vi.fn(),
    findAll: vi.fn(),
    create: vi.fn(),
    definirEncerramento: vi.fn(),
  };

  const submissaoRepository = { findUltimaTentativa } as unknown as SubmissaoSqlRepository;
  const resultadoRepository = {
    findByUsuarioEExercicio: findResultado,
    limparEnvioLiberado: vi.fn(),
  } as unknown as ResultadoExercicioRepository;

  return {
    acessoExercicio: new AcessoExercicioService(
      exercicioRepository,
      matriculaRepository,
      turmaRepository,
      submissaoRepository,
      resultadoRepository,
    ),
    findByAlunoETurma,
    findTurmaById,
    findUltimaTentativa,
    findResultado,
    darAcesso: (): void => {
      findByAlunoETurma.mockResolvedValue(buildMatricula());
      findTurmaById.mockResolvedValue(buildTurmaAberta());
      // Sem submissão anterior e sem liberação: o caso comum.
      findUltimaTentativa.mockResolvedValue(null);
      findResultado.mockResolvedValue(null);
    },
    negarAcesso: (): void => {
      findByAlunoETurma.mockResolvedValue(null);
    },
  };
}
