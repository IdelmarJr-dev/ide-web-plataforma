import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Exercicio, RespostaDissertativa } from '../../src/generated/prisma/client';
import type { ExercicioRepository } from '../../src/repositories/ExercicioRepository';
import type { RespostaDissertativaRepository } from '../../src/repositories/RespostaDissertativaRepository';
import { RespostaDissertativaService } from '../../src/services/RespostaDissertativaService';
import { criarAcessoExercicio } from '../apoio/acessoExercicio';

const EXERCICIO_ID = '11111111-1111-1111-1111-111111111111';
const USUARIO_ID = '22222222-2222-2222-2222-222222222222';

function buildExercicio(overrides: Partial<Exercicio> = {}): Exercicio {
  return {
    id: EXERCICIO_ID,
    turma_id: 'turma-1',
    prova_id: null,
    titulo: 'Junções',
    enunciado: 'Explique a diferença entre INNER e LEFT JOIN.',
    nivel_dificuldade: 'iniciante',
    mer_gabarito: null,
    modo_mer: 'conceitual_logico',
    publico: false,
    sql_gabarito: null,
    sql_setup: null,
    gabarito_dissertativo: 'LEFT mantém as linhas da esquerda.',
    gabarito_liberado: false,
    gabarito_liberado_em: null,
    prazo: null,
    ordem: 1,
    criado_em: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function buildResposta(texto: string): RespostaDissertativa {
  return {
    id: 'resposta-1',
    exercicio_id: EXERCICIO_ID,
    usuario_id: USUARIO_ID,
    texto,
    versao: 1,
    criado_em: new Date('2026-01-01T00:00:00.000Z'),
    atualizado_em: new Date('2026-01-01T00:00:00.000Z'),
  };
}

describe('RespostaDissertativaService', () => {
  const salvar = vi.fn<RespostaDissertativaRepository['salvar']>();
  const findByExercicioEUsuario = vi.fn<RespostaDissertativaRepository['findByExercicioEUsuario']>();
  const findById = vi.fn<ExercicioRepository['findById']>();
  const exercicioRepository = { findById } as unknown as ExercicioRepository;
  const { acessoExercicio, darAcesso, negarAcesso, findTurmaById } = criarAcessoExercicio(exercicioRepository);
  const service = new RespostaDissertativaService({ salvar, findByExercicioEUsuario }, acessoExercicio);

  beforeEach(() => {
    vi.clearAllMocks();
    findById.mockResolvedValue(buildExercicio());
  });

  it('grava o texto do aluno matriculado', async () => {
    darAcesso();
    salvar.mockResolvedValue(buildResposta('LEFT JOIN mantém quem não tem pedido.'));

    const resposta = await service.salvar(USUARIO_ID, EXERCICIO_ID, 'LEFT JOIN mantém quem não tem pedido.');

    expect(salvar).toHaveBeenCalledWith(EXERCICIO_ID, USUARIO_ID, 'LEFT JOIN mantém quem não tem pedido.');
    expect(resposta.texto).toBe('LEFT JOIN mantém quem não tem pedido.');
  });

  it('não grava para quem não tem matrícula na turma', async () => {
    negarAcesso();

    await expect(service.salvar(USUARIO_ID, EXERCICIO_ID, 'texto')).rejects.toThrow();
    expect(salvar).not.toHaveBeenCalled();
  });

  it('não grava depois que a turma foi encerrada', async () => {
    darAcesso();
    findTurmaById.mockResolvedValue({
      id: 'turma-1',
      nome: 'Turma A',
      disciplina: 'Banco de Dados',
      semestre: '2026.2',
      turno: null,
      sala: null,
      codigo: 'ABC123',
      professor_id: 'prof-1',
      encerrada_em: new Date('2026-06-01T00:00:00.000Z'),
      criado_em: new Date('2026-01-01T00:00:00.000Z'),
    });

    await expect(service.salvar(USUARIO_ID, EXERCICIO_ID, 'texto')).rejects.toThrow(/encerrada/);
    expect(salvar).not.toHaveBeenCalled();
  });

  it('devolve a resposta salva ao reabrir o exercício', async () => {
    darAcesso();
    findByExercicioEUsuario.mockResolvedValue(buildResposta('rascunho salvo'));

    const resposta = await service.buscar(USUARIO_ID, EXERCICIO_ID);

    expect(resposta?.texto).toBe('rascunho salvo');
  });
});
