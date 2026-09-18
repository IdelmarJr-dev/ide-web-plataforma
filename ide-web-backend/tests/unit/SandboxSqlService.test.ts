import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Exercicio, SubmissaoSql } from '../../src/generated/prisma/client';
import type { ExercicioRepository } from '../../src/repositories/ExercicioRepository';
import type { ResultadoExercicioRepository } from '../../src/repositories/ResultadoExercicioRepository';
import type { SandboxExecutionRepository } from '../../src/repositories/sandbox/SandboxExecutionRepository';
import type { SandboxProvisioningRepository } from '../../src/repositories/sandbox/SandboxProvisioningRepository';
import type { SubmissaoSqlRepository } from '../../src/repositories/SubmissaoSqlRepository';
import { SandboxSqlService } from '../../src/services/SandboxSqlService';
import { criarAcessoExercicio } from '../apoio/acessoExercicio';

const EXERCICIO_ID = '11111111-1111-1111-1111-111111111111';
const USUARIO_ID = '22222222-2222-2222-2222-222222222222';
const TURMA_ID = 'turma-1';

function buildExercicio(overrides: Partial<Exercicio> = {}): Exercicio {
  return {
    id: EXERCICIO_ID,
    turma_id: TURMA_ID,
    prova_id: null,
    titulo: 'Consulta básica',
    enunciado: 'Escreva uma query que...',
    nivel_dificuldade: 'iniciante',
    mer_gabarito: null,
    modo_mer: 'conceitual_logico',
    publico: false,
    sql_gabarito: 'SELECT id FROM usuarios',
    sql_setup: 'CREATE TABLE usuarios (id INT)',
    gabarito_dissertativo: null,
    gabarito_liberado: false,
    gabarito_liberado_em: null,
    prazo: null,
    ordem: 1,
    criado_em: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}


function buildSubmissao(overrides: Partial<SubmissaoSql> = {}): SubmissaoSql {
  return {
    id: 'submissao-1',
    exercicio_id: EXERCICIO_ID,
    usuario_id: USUARIO_ID,
    query_sql: 'SELECT id FROM usuarios',
    resultado_status: 'sucesso',
    linhas_retornadas: 1,
    tempo_execucao_ms: 5,
    correta: true,
    tentativa_numero: 1,
    criado_em: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('SandboxSqlService', () => {
  const garantirSchema = vi.fn<SandboxProvisioningRepository['garantirSchema']>();
  const dropSchema = vi.fn<SandboxProvisioningRepository['dropSchema']>();
  const executar = vi.fn<SandboxExecutionRepository['executar']>();
  const explain = vi.fn<SandboxExecutionRepository['explain']>();
  const proximoNumeroTentativa = vi.fn<SubmissaoSqlRepository['proximoNumeroTentativa']>();
  const criarComLog = vi.fn<SubmissaoSqlRepository['criarComLog']>();
  const findExercicioById = vi.fn<ExercicioRepository['findById']>();
  const upsertAcertoAutomatico = vi.fn<ResultadoExercicioRepository['upsertAcertoAutomatico']>();

  const provisioningRepository: SandboxProvisioningRepository = {
    garantirSchema,
    garantirSchemaLivre: vi.fn(),
    dropSchema,
  };
  const executionRepository: SandboxExecutionRepository = { executar, explain };
  const submissaoRepository: SubmissaoSqlRepository = {
    proximoNumeroTentativa,
    criarComLog,
    findResumoPorExercicios: vi.fn(),
    findUltimaTentativa: vi.fn(),
  };
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
  const resultadoRepository: ResultadoExercicioRepository = {
    upsertAcertoAutomatico,
    findByUsuarioEExercicio: vi.fn(),
    liberarEnvio: vi.fn(),
    limparEnvioLiberado: vi.fn(),
    upsertRevisao: vi.fn(),
    marcarFinalizado: vi.fn(),
  };
  const { acessoExercicio, darAcesso, negarAcesso } = criarAcessoExercicio(exercicioRepository);

  const service = new SandboxSqlService(
    provisioningRepository,
    executionRepository,
    submissaoRepository,
    acessoExercicio,
    resultadoRepository,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    garantirSchema.mockResolvedValue(undefined);
    proximoNumeroTentativa.mockResolvedValue(1);
    criarComLog.mockResolvedValue(buildSubmissao());
    upsertAcertoAutomatico.mockResolvedValue(undefined);
  });

  it('impede que um aluno sem matrícula na turma use o sandbox', async () => {
    findExercicioById.mockResolvedValue(buildExercicio());
    negarAcesso();

    await expect(service.testar(USUARIO_ID, EXERCICIO_ID, 'SELECT 1')).rejects.toThrow();
    expect(garantirSchema).not.toHaveBeenCalled();
  });

  it('"testar" não grava nenhuma submissão', async () => {
    findExercicioById.mockResolvedValue(buildExercicio());
    darAcesso();
    executar.mockResolvedValue({ status: 'sucesso', rows: [{ id: 1 }] });

    const resultado = await service.testar(USUARIO_ID, EXERCICIO_ID, 'SELECT id FROM usuarios');

    expect(resultado.status).toBe('sucesso');
    expect(criarComLog).not.toHaveBeenCalled();
  });

  it('"enviar" grava a submissão com erro e não calcula correção quando a query do aluno falha', async () => {
    findExercicioById.mockResolvedValue(buildExercicio());
    darAcesso();
    executar.mockResolvedValue({ status: 'erro_sintaxe', message: 'syntax error' });

    const resultado = await service.enviar(USUARIO_ID, EXERCICIO_ID, 'SELECT FROM');

    expect(resultado.correta).toBeNull();
    expect(resultado.plano).toBeNull();
    expect(explain).not.toHaveBeenCalled();
    expect(criarComLog).toHaveBeenCalledWith(
      expect.objectContaining({ resultado_status: 'erro_sintaxe', correta: null }),
    );
    // Query que nem rodou não é evidência de erro na resposta: o resultado fica intocado.
    expect(upsertAcertoAutomatico).not.toHaveBeenCalled();
  });

  it('marca como correta quando o conjunto de linhas do aluno bate com o gabarito, ignorando ordem', async () => {
    findExercicioById.mockResolvedValue(buildExercicio());
    darAcesso();
    // 1ª chamada: query do aluno. 2ª chamada: sql_gabarito — mesmo conjunto de linhas, ordem diferente.
    executar.mockResolvedValueOnce({ status: 'sucesso', rows: [{ id: 1 }, { id: 2 }] });
    executar.mockResolvedValueOnce({ status: 'sucesso', rows: [{ id: 2 }, { id: 1 }] });
    explain.mockResolvedValue({ plan: 'ok' });

    const resultado = await service.enviar(USUARIO_ID, EXERCICIO_ID, 'SELECT id FROM usuarios');

    expect(resultado.correta).toBe(true);
    expect(resultado.plano).toEqual({ plan: 'ok' });
    expect(criarComLog).toHaveBeenCalledWith(expect.objectContaining({ correta: true }));
  });

  // Fase 9, D14: o acerto do sandbox precisa chegar ao ResultadoExercicio — é de lá que o
  // painel e a tela de revisão leem. Antes disso ele morria em SubmissaoSql.
  it('leva o acerto automático para o resultado do exercício', async () => {
    findExercicioById.mockResolvedValue(buildExercicio());
    darAcesso();
    executar.mockResolvedValueOnce({ status: 'sucesso', rows: [{ id: 1 }] });
    executar.mockResolvedValueOnce({ status: 'sucesso', rows: [{ id: 1 }] });
    explain.mockResolvedValue({ plan: 'ok' });

    await service.enviar(USUARIO_ID, EXERCICIO_ID, 'SELECT id FROM usuarios');

    expect(upsertAcertoAutomatico).toHaveBeenCalledWith(USUARIO_ID, EXERCICIO_ID, true);
  });

  it('leva também o erro automático para o resultado do exercício', async () => {
    findExercicioById.mockResolvedValue(buildExercicio());
    darAcesso();
    executar.mockResolvedValueOnce({ status: 'sucesso', rows: [{ id: 1 }] });
    executar.mockResolvedValueOnce({ status: 'sucesso', rows: [{ id: 2 }] });
    explain.mockResolvedValue({ plan: 'ok' });

    await service.enviar(USUARIO_ID, EXERCICIO_ID, 'SELECT id FROM usuarios');

    expect(upsertAcertoAutomatico).toHaveBeenCalledWith(USUARIO_ID, EXERCICIO_ID, false);
  });

  it('marca como incorreta quando o conjunto de linhas diverge do gabarito', async () => {
    findExercicioById.mockResolvedValue(buildExercicio());
    darAcesso();
    executar.mockResolvedValueOnce({ status: 'sucesso', rows: [{ id: 1 }] });
    executar.mockResolvedValueOnce({ status: 'sucesso', rows: [{ id: 1 }, { id: 2 }] });
    explain.mockResolvedValue({ plan: 'ok' });

    const resultado = await service.enviar(USUARIO_ID, EXERCICIO_ID, 'SELECT id FROM usuarios LIMIT 1');

    expect(resultado.correta).toBe(false);
  });

  it('mantém a correção nula quando o exercício não tem gabarito de SQL cadastrado', async () => {
    findExercicioById.mockResolvedValue(buildExercicio({ sql_gabarito: null }));
    darAcesso();
    executar.mockResolvedValue({ status: 'sucesso', rows: [{ id: 1 }] });
    explain.mockResolvedValue({ plan: 'ok' });

    const resultado = await service.enviar(USUARIO_ID, EXERCICIO_ID, 'SELECT id FROM usuarios');

    expect(resultado.correta).toBeNull();
    expect(upsertAcertoAutomatico).not.toHaveBeenCalled();
  });

  it('usa o número de tentativa retornado pelo repositório', async () => {
    findExercicioById.mockResolvedValue(buildExercicio());
    darAcesso();
    executar.mockResolvedValue({ status: 'sucesso', rows: [] });
    explain.mockResolvedValue(null);
    proximoNumeroTentativa.mockResolvedValue(3);

    await service.enviar(USUARIO_ID, EXERCICIO_ID, 'SELECT id FROM usuarios WHERE 1 = 0');

    const chamada = criarComLog.mock.calls[0]?.[0];
    expect(chamada?.tentativa_numero).toBe(3);
  });
});
