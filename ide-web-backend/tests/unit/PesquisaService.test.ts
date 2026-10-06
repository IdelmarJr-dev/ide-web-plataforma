import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Exercicio, Usuario } from '../../src/generated/prisma/client';
import type { AlocacaoGrupoRepository } from '../../src/repositories/AlocacaoGrupoRepository';
import type { DicaIaRepository } from '../../src/repositories/DicaIaRepository';
import type { ExercicioRepository } from '../../src/repositories/ExercicioRepository';
import type { SubmissaoSqlRepository } from '../../src/repositories/SubmissaoSqlRepository';
import type { MatriculaRepository } from '../../src/repositories/MatriculaRepository';
import type { PesquisaRepository } from '../../src/repositories/PesquisaRepository';
import type { RespostaRtlxRepository } from '../../src/repositories/RespostaRtlxRepository';
import type { RespostaSusRepository } from '../../src/repositories/RespostaSusRepository';
import type { SessaoUsoRepository } from '../../src/repositories/SessaoUsoRepository';
import type { TcleConsentimentoRepository } from '../../src/repositories/TcleConsentimentoRepository';
import type { UsuarioRepository } from '../../src/repositories/UsuarioRepository';
import { PesquisaService } from '../../src/services/PesquisaService';

function buildAluno(overrides: Partial<Usuario> = {}): Usuario {
  return {
    id: 'aluno-1',
    nome: 'Aluno A',
    email: null,
    senha_hash: null,
    papel: 'aluno',
    matricula: null,
    criado_em: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function buildExercicio(overrides: Partial<Exercicio> = {}): Exercicio {
  return {
    id: 'ex-1',
    turma_id: 'turma-1',
    prova_id: null,
    titulo: 'Consulta',
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

describe('PesquisaService', () => {
  const findUsuarioById = vi.fn<UsuarioRepository['findById']>();
  const findByIds = vi.fn<ExercicioRepository['findByIds']>();
  const findAlunosDaTurma = vi.fn<MatriculaRepository['findAlunosDaTurma']>();
  const findResumoPorExercicios = vi.fn<SubmissaoSqlRepository['findResumoPorExercicios']>();
  const contarPorExercicios = vi.fn<DicaIaRepository['contarPorExercicios']>();

  const service = new PesquisaService(
    { findById: findUsuarioById } as unknown as UsuarioRepository,
    { findByIds } as unknown as ExercicioRepository,
    { findAlunosDaTurma } as unknown as MatriculaRepository,
    { findResumoPorExercicios } as unknown as SubmissaoSqlRepository,
    { contarPorExercicios } as unknown as DicaIaRepository,
    {} as unknown as PesquisaRepository,
    {} as unknown as TcleConsentimentoRepository,
    {} as unknown as AlocacaoGrupoRepository,
    {} as unknown as SessaoUsoRepository,
    {} as unknown as RespostaSusRepository,
    {} as unknown as RespostaRtlxRepository,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    findResumoPorExercicios.mockResolvedValue([]);
    contarPorExercicios.mockResolvedValue([]);
  });

  describe('acertos', () => {
    it('agrega tentativas, acerto e dicas por aluno e exercício', async () => {
      findByIds.mockResolvedValue([buildExercicio({ id: 'ex-1' }), buildExercicio({ id: 'ex-2' })]);
      findAlunosDaTurma.mockResolvedValue([buildAluno({ id: 'a1' }), buildAluno({ id: 'a2' })]);
      findResumoPorExercicios.mockResolvedValue([
        { usuario_id: 'a1', exercicio_id: 'ex-1', correta: false },
        { usuario_id: 'a1', exercicio_id: 'ex-1', correta: true },
        { usuario_id: 'a1', exercicio_id: 'ex-2', correta: null },
      ]);
      contarPorExercicios.mockResolvedValue([
        { usuario_id: 'a1', exercicio_id: 'ex-1', contexto: 'sql', total: 2 },
        { usuario_id: 'a1', exercicio_id: 'ex-1', contexto: 'mer', total: 1 },
      ]);

      const resultado = await service.acertos(['ex-1', 'ex-2']);

      expect(resultado.turmaId).toBe('turma-1');
      expect(resultado.alunos).toEqual([
        {
          usuarioId: 'a1',
          exercicios: [
            { exercicioId: 'ex-1', tentativas: 2, correta: true, dicasSql: 2, dicasMer: 1 },
            { exercicioId: 'ex-2', tentativas: 1, correta: false, dicasSql: 0, dicasMer: 0 },
          ],
        },
        {
          usuarioId: 'a2',
          exercicios: [
            { exercicioId: 'ex-1', tentativas: 0, correta: null, dicasSql: 0, dicasMer: 0 },
            { exercicioId: 'ex-2', tentativas: 0, correta: null, dicasSql: 0, dicasMer: 0 },
          ],
        },
      ]);
    });

    it('rejeita exercício inexistente', async () => {
      findByIds.mockResolvedValue([buildExercicio({ id: 'ex-1' })]);

      await expect(service.acertos(['ex-1', 'ex-fantasma'])).rejects.toThrow('Exercício');
    });

    it('rejeita exercícios de turmas diferentes', async () => {
      findByIds.mockResolvedValue([buildExercicio({ id: 'ex-1' }), buildExercicio({ id: 'ex-2', turma_id: 'turma-2' })]);

      await expect(service.acertos(['ex-1', 'ex-2'])).rejects.toThrow('mesma turma');
    });
  });
});
