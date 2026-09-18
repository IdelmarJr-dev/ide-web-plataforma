import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Exercicio, RespostaDissertativa, SubmissaoSql, } from '../../src/generated/prisma/client';
import type { ExercicioRepository } from '../../src/repositories/ExercicioRepository';
import type { RespostaDissertativaRepository } from '../../src/repositories/RespostaDissertativaRepository';
import type { SandboxProvisioningRepository } from '../../src/repositories/sandbox/SandboxProvisioningRepository';
import type { SubmissaoSqlRepository } from '../../src/repositories/SubmissaoSqlRepository';
import type { ResultadoExercicioRepository } from '../../src/repositories/ResultadoExercicioRepository';
import { PacoteService } from '../../src/services/PacoteService';
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


describe('PacoteService', () => {
  const findExercicioById = vi.fn<ExercicioRepository['findById']>();
  const marcarFinalizado = vi.fn<ResultadoExercicioRepository['marcarFinalizado']>();
  const findUltimaTentativa = vi.fn<SubmissaoSqlRepository['findUltimaTentativa']>();
  const findRespostaDissertativa = vi.fn<RespostaDissertativaRepository['findByExercicioEUsuario']>();
  const dropSchema = vi.fn<SandboxProvisioningRepository['dropSchema']>();

  const exercicioRepository: ExercicioRepository = {
    findPublicos: vi.fn(),
    findByIds: vi.fn(),
    findById: findExercicioById,
    findByTurmaId: vi.fn(),
    proximaOrdem: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    findSemProva: vi.fn(),
    vincularAProva: vi.fn(),
    definirGabaritoLiberado: vi.fn(),
  };
  const submissaoRepository: SubmissaoSqlRepository = {
    proximoNumeroTentativa: vi.fn(),
    criarComLog: vi.fn(),
    findResumoPorExercicios: vi.fn(),
    findUltimaTentativa,
  };
  const respostaDissertativaRepository: RespostaDissertativaRepository = {
    findByExercicioEUsuario: findRespostaDissertativa,
  };
  const provisioningRepository: SandboxProvisioningRepository = {
    garantirSchema: vi.fn(),
    garantirSchemaLivre: vi.fn(),
    dropSchema,
  };
  const resultadoRepository: ResultadoExercicioRepository = {
    findByUsuarioEExercicio: vi.fn(),
    upsertAcertoAutomatico: vi.fn(),
    liberarEnvio: vi.fn(),
    limparEnvioLiberado: vi.fn(),
    upsertRevisao: vi.fn(),
    marcarFinalizado,
  };
  const { acessoExercicio, darAcesso, negarAcesso } = criarAcessoExercicio(exercicioRepository);

  const service = new PacoteService(
    acessoExercicio,
    submissaoRepository,
    respostaDissertativaRepository,
    resultadoRepository,
    provisioningRepository,
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('impede que um aluno sem matrícula gere o pacote do exercício', async () => {
    findExercicioById.mockResolvedValue(buildExercicio());
    negarAcesso();

    await expect(service.gerar(USUARIO_ID, EXERCICIO_ID, { imagensModelos: [], sqlModelo: null })).rejects.toThrow();
    expect(findUltimaTentativa).not.toHaveBeenCalled();
  });

  it('reúne a última submissão SQL e a resposta dissertativa do aluno', async () => {
    findExercicioById.mockResolvedValue(buildExercicio());
    darAcesso();
    findUltimaTentativa.mockResolvedValue({ query_sql: 'SELECT 1' } as SubmissaoSql);
    findRespostaDissertativa.mockResolvedValue({ texto: 'minha resposta' } as RespostaDissertativa);

    const dados = await service.gerar(USUARIO_ID, EXERCICIO_ID, {
      imagensModelos: [
        { rotulo: 'Modelo conceitual', pngBase64: 'png-conceitual' },
        { rotulo: 'Modelo lógico', pngBase64: 'png-logico' },
      ],
      sqlModelo: 'CREATE TABLE aluno ();',
    });

    expect(dados.submissaoSql?.query_sql).toBe('SELECT 1');
    expect(dados.respostaDissertativa?.texto).toBe('minha resposta');
    expect(dados.imagensModelos.map((imagem) => imagem.rotulo)).toEqual(['Modelo conceitual', 'Modelo lógico']);
    expect(dados.sqlModelo).toBe('CREATE TABLE aluno ();');
  });

  it('finalizar marca a data e derruba o schema do sandbox', async () => {
    findExercicioById.mockResolvedValue(buildExercicio());
    darAcesso();

    await service.finalizar(USUARIO_ID, EXERCICIO_ID);

    expect(marcarFinalizado).toHaveBeenCalledWith(USUARIO_ID, EXERCICIO_ID, expect.any(Date));
    expect(dropSchema).toHaveBeenCalledWith(expect.stringContaining('sandbox_'));
  });

  it('baixar o pacote não mexe mais no sandbox — finalizar é ação separada', async () => {
    findExercicioById.mockResolvedValue(buildExercicio());
    darAcesso();

    await service.gerar(USUARIO_ID, EXERCICIO_ID, { imagensModelos: [], sqlModelo: null });

    expect(dropSchema).not.toHaveBeenCalled();
    expect(marcarFinalizado).not.toHaveBeenCalled();
  });
});
