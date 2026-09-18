import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Exercicio } from '../../src/generated/prisma/client';
import type { ExercicioRepository } from '../../src/repositories/ExercicioRepository';
import { buildMatricula, buildTurmaAberta, criarAcessoExercicio } from '../apoio/acessoExercicio';

const EXERCICIO_ID = '11111111-1111-1111-1111-111111111111';
const ALUNO_ID = '22222222-2222-2222-2222-222222222222';

function buildExercicio(overrides: Partial<Exercicio> = {}): Exercicio {
  return {
    id: EXERCICIO_ID,
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

describe('AcessoExercicioService', () => {
  const findExercicioById = vi.fn<ExercicioRepository['findById']>();
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
  const { acessoExercicio, findByAlunoETurma, findTurmaById, findUltimaTentativa, findResultado } =
    criarAcessoExercicio(exercicioRepository);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('recusa exercício inexistente', async () => {
    findExercicioById.mockResolvedValue(null);

    await expect(acessoExercicio.exigirLeitura(ALUNO_ID, EXERCICIO_ID)).rejects.toThrow(/não encontrado/i);
  });

  it('libera leitura pro aluno matriculado na turma do exercício', async () => {
    findExercicioById.mockResolvedValue(buildExercicio());
    findByAlunoETurma.mockResolvedValue(buildMatricula());

    await expect(acessoExercicio.exigirLeitura(ALUNO_ID, EXERCICIO_ID)).resolves.toBeDefined();
    expect(findByAlunoETurma).toHaveBeenCalledWith(ALUNO_ID, 'turma-1');
  });

  it('recusa leitura pra aluno sem matrícula', async () => {
    findExercicioById.mockResolvedValue(buildExercicio());
    findByAlunoETurma.mockResolvedValue(null);

    await expect(acessoExercicio.exigirLeitura(ALUNO_ID, EXERCICIO_ID)).rejects.toThrow(/não pertence/i);
  });

  // A regra antiga comparava `usuario.turma_id === exercicio.turma_id`; com os dois
  // lados nulos ela passaria por coincidência. Aqui o acesso vem de `publico`, e a
  // matrícula nem chega a ser consultada.
  it('libera exercício público sem consultar matrícula nenhuma', async () => {
    findExercicioById.mockResolvedValue(buildExercicio({ publico: true }));

    await expect(acessoExercicio.exigirLeitura(ALUNO_ID, EXERCICIO_ID)).resolves.toBeDefined();
    expect(findByAlunoETurma).not.toHaveBeenCalled();
  });

  describe('entrega', () => {
    it('aceita entrega em turma aberta', async () => {
      findExercicioById.mockResolvedValue(buildExercicio());
      findByAlunoETurma.mockResolvedValue(buildMatricula());
      findTurmaById.mockResolvedValue(buildTurmaAberta());

      await expect(acessoExercicio.exigirEntrega(ALUNO_ID, EXERCICIO_ID)).resolves.toBeDefined();
    });

    it('recusa entrega em turma encerrada, mas a leitura continua valendo', async () => {
      findExercicioById.mockResolvedValue(buildExercicio());
      findByAlunoETurma.mockResolvedValue(buildMatricula());
      findTurmaById.mockResolvedValue(buildTurmaAberta({ encerrada_em: new Date('2026-09-16T12:00:00.000Z') }));

      await expect(acessoExercicio.exigirEntrega(ALUNO_ID, EXERCICIO_ID)).rejects.toThrow(/encerrada/i);
      await expect(acessoExercicio.exigirLeitura(ALUNO_ID, EXERCICIO_ID)).resolves.toBeDefined();
    });

    // Pra quem chega de fora, o exercício público é material de estudo — o ciclo de
    // vida da turma de origem não diz respeito a ele.
    it('exercício público não congela junto com a turma de origem', async () => {
      findExercicioById.mockResolvedValue(buildExercicio({ publico: true }));
      findTurmaById.mockResolvedValue(buildTurmaAberta({ encerrada_em: new Date('2026-09-16T12:00:00.000Z') }));

      await expect(acessoExercicio.exigirEntrega(ALUNO_ID, EXERCICIO_ID)).resolves.toBeDefined();
    });
  });
  // ---- Fase 10: prazo, envio único de prova e liberação do professor ----

  describe('prazo', () => {
    function comAcesso(): void {
      findByAlunoETurma.mockResolvedValue(buildMatricula());
      findTurmaById.mockResolvedValue(buildTurmaAberta());
      findUltimaTentativa.mockResolvedValue(null);
      findResultado.mockResolvedValue(null);
    }

    it('aceita entrega antes do prazo', async () => {
      comAcesso();
      findExercicioById.mockResolvedValue(buildExercicio({ prazo: new Date(Date.now() + 60_000) }));

      await expect(acessoExercicio.exigirEntrega(ALUNO_ID, EXERCICIO_ID)).resolves.toBeDefined();
    });

    it('recusa entrega depois do prazo', async () => {
      comAcesso();
      findExercicioById.mockResolvedValue(buildExercicio({ prazo: new Date(Date.now() - 60_000) }));

      await expect(acessoExercicio.exigirEntrega(ALUNO_ID, EXERCICIO_ID)).rejects.toThrow(/prazo desta atividade/);
    });

    it('sem prazo definido, nunca bloqueia', async () => {
      comAcesso();
      findExercicioById.mockResolvedValue(buildExercicio({ prazo: null }));

      await expect(acessoExercicio.exigirEntrega(ALUNO_ID, EXERCICIO_ID)).resolves.toBeDefined();
    });
  });

  describe('envio único em questão de prova', () => {
    function comAcesso(): void {
      findByAlunoETurma.mockResolvedValue(buildMatricula());
      findTurmaById.mockResolvedValue(buildTurmaAberta());
      findUltimaTentativa.mockResolvedValue(null);
      findResultado.mockResolvedValue(null);
    }

    it('aceita o primeiro envio', async () => {
      comAcesso();
      findExercicioById.mockResolvedValue(buildExercicio({ prova_id: 'prova-1' }));

      await expect(acessoExercicio.exigirEntrega(ALUNO_ID, EXERCICIO_ID)).resolves.toBeDefined();
    });

    it('recusa o segundo envio', async () => {
      comAcesso();
      findExercicioById.mockResolvedValue(buildExercicio({ prova_id: 'prova-1' }));
      findUltimaTentativa.mockResolvedValue({ id: 's1' } as never);

      await expect(acessoExercicio.exigirEntrega(ALUNO_ID, EXERCICIO_ID)).rejects.toThrow(/um envio só/);
    });

    it('exercício fora de prova aceita quantos envios o aluno quiser', async () => {
      comAcesso();
      findExercicioById.mockResolvedValue(buildExercicio({ prova_id: null }));
      findUltimaTentativa.mockResolvedValue({ id: 's1' } as never);

      await expect(acessoExercicio.exigirEntrega(ALUNO_ID, EXERCICIO_ID)).resolves.toBeDefined();
    });

    // D9: testar livremente transformaria a prova num exercício comum.
    it('não permite testar em questão de prova', async () => {
      comAcesso();
      findExercicioById.mockResolvedValue(buildExercicio({ prova_id: 'prova-1' }));

      await expect(acessoExercicio.exigirTeste(ALUNO_ID, EXERCICIO_ID)).rejects.toThrow(/não permite testar/);
    });

    it('permite testar fora de prova', async () => {
      comAcesso();
      findExercicioById.mockResolvedValue(buildExercicio({ prova_id: null }));

      await expect(acessoExercicio.exigirTeste(ALUNO_ID, EXERCICIO_ID)).resolves.toBeDefined();
    });
  });

  // D8: um conceito só destrava o engano na prova E o prazo perdido.
  describe('liberação concedida pelo professor', () => {
    function comLiberacao(): void {
      findByAlunoETurma.mockResolvedValue(buildMatricula());
      findTurmaById.mockResolvedValue(buildTurmaAberta());
      findResultado.mockResolvedValue({ envio_liberado_em: new Date() } as never);
    }

    it('atravessa o prazo vencido', async () => {
      comLiberacao();
      findUltimaTentativa.mockResolvedValue(null);
      findExercicioById.mockResolvedValue(buildExercicio({ prazo: new Date(Date.now() - 60_000) }));

      await expect(acessoExercicio.exigirEntrega(ALUNO_ID, EXERCICIO_ID)).resolves.toBeDefined();
    });

    it('atravessa o envio único já usado', async () => {
      comLiberacao();
      findUltimaTentativa.mockResolvedValue({ id: 's1' } as never);
      findExercicioById.mockResolvedValue(buildExercicio({ prova_id: 'prova-1' }));

      await expect(acessoExercicio.exigirEntrega(ALUNO_ID, EXERCICIO_ID)).resolves.toBeDefined();
    });

    // Turma encerrada é outra coisa: a liberação não ressuscita a turma.
    it('não atravessa turma encerrada', async () => {
      comLiberacao();
      findTurmaById.mockResolvedValue(buildTurmaAberta({ encerrada_em: new Date() }));
      findExercicioById.mockResolvedValue(buildExercicio());

      await expect(acessoExercicio.exigirEntrega(ALUNO_ID, EXERCICIO_ID)).rejects.toThrow(/encerrada/);
    });
  });
});
