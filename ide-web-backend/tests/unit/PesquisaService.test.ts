import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Exercicio, Usuario } from '../../src/generated/prisma/client';
import type { DicaIaRepository } from '../../src/repositories/DicaIaRepository';
import type { ExercicioRepository } from '../../src/repositories/ExercicioRepository';
import type { SubmissaoSqlRepository } from '../../src/repositories/SubmissaoSqlRepository';
import type { MatriculaRepository } from '../../src/repositories/MatriculaRepository';
import type { UsuarioRepository } from '../../src/repositories/UsuarioRepository';
import { PesquisaService } from '../../src/services/PesquisaService';
import { verifyResearchToken } from '../../src/utils/jwt';
import { buildMatricula } from '../apoio/acessoExercicio';

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
  const findMatriculasDoAluno = vi.fn<MatriculaRepository['findByAlunoId']>();
  const findResumoPorExercicios = vi.fn<SubmissaoSqlRepository['findResumoPorExercicios']>();
  const contarPorExercicios = vi.fn<DicaIaRepository['contarPorExercicios']>();

  const service = new PesquisaService(
    { findById: findUsuarioById } as unknown as UsuarioRepository,
    { findByIds } as unknown as ExercicioRepository,
    { findAlunosDaTurma, findByAlunoId: findMatriculasDoAluno } as unknown as MatriculaRepository,
    { findResumoPorExercicios } as unknown as SubmissaoSqlRepository,
    { contarPorExercicios } as unknown as DicaIaRepository,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    findResumoPorExercicios.mockResolvedValue([]);
    contarPorExercicios.mockResolvedValue([]);
  });

  describe('gerarToken', () => {
    it('rejeita gerar token para usuário inexistente', async () => {
      findUsuarioById.mockResolvedValue(null);

      await expect(service.gerarToken('inexistente')).rejects.toThrow();
    });

    it('gera um token só com as claims mínimas, sem o nome do aluno', async () => {
      findUsuarioById.mockResolvedValue(buildAluno());
      findMatriculasDoAluno.mockResolvedValue([buildMatricula(), buildMatricula({ turma_id: 'turma-2' })]);

      const payload = verifyResearchToken(await service.gerarToken('aluno-1'));

      expect(payload).toMatchObject({
        usuario_id: 'aluno-1',
        papel: 'aluno',
        turma_ids: ['turma-1', 'turma-2'],
      });
      expect(payload).not.toHaveProperty('nome');
      expect(payload).not.toHaveProperty('email');
    });
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
