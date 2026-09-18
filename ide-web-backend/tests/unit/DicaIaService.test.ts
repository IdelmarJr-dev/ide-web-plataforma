import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DicaIa, Exercicio, ResultadoExercicio, SubmissaoSql } from '../../src/generated/prisma/client';
import type { LlmClient } from '../../src/repositories/llm/GroqLlmClient';
import type { DicaIaRepository } from '../../src/repositories/DicaIaRepository';
import type { ExercicioRepository } from '../../src/repositories/ExercicioRepository';
import type { ResultadoExercicioRepository } from '../../src/repositories/ResultadoExercicioRepository';
import type { SubmissaoSqlRepository } from '../../src/repositories/SubmissaoSqlRepository';
import { DicaIaService } from '../../src/services/DicaIaService';
import { criarAcessoExercicio } from '../apoio/acessoExercicio';
import type { DocumentoModelagem } from '../../src/dtos/modelagem.schema';

const DIAGRAMA_CLIENTE: DocumentoModelagem = {
  versao: 2,
  conceitual: null,
  conversao: null,
  logico: {
    notas: [],
    tabelas: [
      {
        id: 't1',
        posicao: { x: 0, y: 0 },
        nome: 'Cliente',
        colunas: [
          {
            id: 'c1',
            nome: 'id',
            tipo: 'INTEGER',
            tamanho: null,
            escala: null,
            pk: true,
            notNull: true,
            unique: false,
            autoIncremento: false,
            padrao: '',
            check: '',
            fk: null,
          },
        ],
      },
    ],
  },
};

function buildExercicio(overrides: Partial<Exercicio> = {}): Exercicio {
  return {
    id: 'exercicio-1',
    turma_id: 'turma-1',
    prova_id: null,
    titulo: 'Consulta básica',
    enunciado: 'Escreva uma query que...',
    nivel_dificuldade: 'iniciante',
    publico: false,
    mer_gabarito: DIAGRAMA_CLIENTE,
    modo_mer: 'logico',
    sql_gabarito: 'SELECT * FROM usuarios',
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


function buildDicaIa(overrides: Partial<DicaIa> = {}): DicaIa {
  return {
    id: 'dica-1',
    usuario_id: 'aluno-1',
    exercicio_id: 'exercicio-1',
    contexto: 'sql',
    estado_enviado: 'SELECT * FROM usuarios',
    prompt_montado: 'prompt',
    resposta_ia: 'Revise a cláusula WHERE.',
    modelo_llm: 'llama-3.1-8b-instant',
    tokens_usados: 42,
    criado_em: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('DicaIaService', () => {
  const findExercicioById = vi.fn<ExercicioRepository['findById']>();
  const contarPorContexto = vi.fn<DicaIaRepository['contarPorContexto']>();
  const criarDica = vi.fn<DicaIaRepository['criar']>();
  const findUltimaTentativa = vi.fn<SubmissaoSqlRepository['findUltimaTentativa']>();
  const findResultadoByUsuarioEExercicio = vi.fn<ResultadoExercicioRepository['findByUsuarioEExercicio']>();
  const gerarDica = vi.fn<LlmClient['gerarDica']>();

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
  const dicaIaRepository: DicaIaRepository = {
    contarPorContexto,
    contarPorExercicios: vi.fn(),
    criar: criarDica,
  };
  const submissaoSqlRepository: SubmissaoSqlRepository = {
    proximoNumeroTentativa: vi.fn(),
    criarComLog: vi.fn(),
    findResumoPorExercicios: vi.fn(),
    findUltimaTentativa,
  };
  const resultadoExercicioRepository: ResultadoExercicioRepository = {
    findByUsuarioEExercicio: findResultadoByUsuarioEExercicio,
    upsertAcertoAutomatico: vi.fn(),
    liberarEnvio: vi.fn(),
    limparEnvioLiberado: vi.fn(),
    upsertRevisao: vi.fn(),
    marcarFinalizado: vi.fn(),
  };
  const llmClient: LlmClient = { gerarDica };

  const service = new DicaIaService(
    dicaIaRepository,
    exercicioRepository,
    acessoExercicio,
    submissaoSqlRepository,
    resultadoExercicioRepository,
    llmClient,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    findExercicioById.mockResolvedValue(buildExercicio());
    darAcesso();
    contarPorContexto.mockResolvedValue(0);
    findUltimaTentativa.mockResolvedValue(null);
    findResultadoByUsuarioEExercicio.mockResolvedValue(null);
    gerarDica.mockResolvedValue({ texto: 'Revise a cláusula WHERE.', tokensUsados: 42 });
    criarDica.mockResolvedValue(buildDicaIa());
  });

  it('rejeita aluno sem matrícula na turma do exercício', async () => {
    negarAcesso();

    await expect(service.pedir('aluno-1', 'exercicio-1', { contexto: 'sql', estadoSql: 'SELECT 1' })).rejects.toThrow();

    expect(gerarDica).not.toHaveBeenCalled();
  });

  it('rejeita pedido de dica de SQL num exercício sem parte de SQL', async () => {
    findExercicioById.mockResolvedValue(buildExercicio({ sql_gabarito: null }));

    await expect(service.pedir('aluno-1', 'exercicio-1', { contexto: 'sql', estadoSql: 'SELECT 1' })).rejects.toThrow();
  });

  it('rejeita o 6º pedido de dica no mesmo contexto', async () => {
    contarPorContexto.mockResolvedValue(5);

    await expect(service.pedir('aluno-1', 'exercicio-1', { contexto: 'sql', estadoSql: 'SELECT 1' })).rejects.toThrow();

    expect(gerarDica).not.toHaveBeenCalled();
  });

  it('inclui o status da última submissão no prompt quando ela não teve sucesso', async () => {
    findUltimaTentativa.mockResolvedValue({
      id: 'submissao-1',
      exercicio_id: 'exercicio-1',
      usuario_id: 'aluno-1',
      query_sql: 'SELECT * FORM usuarios',
      resultado_status: 'erro_sintaxe',
      linhas_retornadas: null,
      tempo_execucao_ms: 10,
      correta: null,
      tentativa_numero: 1,
      criado_em: new Date('2026-01-01T00:00:00.000Z'),
    } satisfies SubmissaoSql);

    await service.pedir('aluno-1', 'exercicio-1', { contexto: 'sql', estadoSql: 'SELECT * FORM usuarios' });

    const promptEnviado = gerarDica.mock.calls[0]?.[0] ?? '';
    expect(promptEnviado).toContain('erro sintaxe');
  });

  it('não inclui dado de identificação do aluno no prompt', async () => {
    await service.pedir('aluno-1', 'exercicio-1', { contexto: 'sql', estadoSql: 'SELECT 1' });

    const promptEnviado = gerarDica.mock.calls[0]?.[0] ?? '';
    expect(promptEnviado).not.toContain('aluno@example.com');
    expect(promptEnviado).not.toContain('Aluno');
  });

  it('persiste a dica com o modelo e os tokens usados retornados pelo LLM', async () => {
    await service.pedir('aluno-1', 'exercicio-1', { contexto: 'sql', estadoSql: 'SELECT 1' });

    expect(criarDica).toHaveBeenCalledWith(
      expect.objectContaining({
        usuario_id: 'aluno-1',
        exercicio_id: 'exercicio-1',
        contexto: 'sql',
        resposta_ia: 'Revise a cláusula WHERE.',
        tokens_usados: 42,
      }),
    );
  });

  it('não inclui avaliação MER no prompt quando o exercício ainda não foi revisado', async () => {
    findResultadoByUsuarioEExercicio.mockResolvedValue({
      id: 'resultado-1',
      usuario_id: 'aluno-1',
      exercicio_id: 'exercicio-1',
      sql_correto: null,
      mer_avaliacao: null,
      dissertativa_avaliacao: null,
      acertos: 0,
      erros: 0,
      pontuacao: null,
      revisado: false,
      revisado_em: null,
      revisado_por: null,
      finalizado_em: null,
      envio_liberado_em: null,
      criado_em: new Date('2026-01-01T00:00:00.000Z'),
    } satisfies ResultadoExercicio);

    await service.pedir('aluno-1', 'exercicio-1', { contexto: 'mer', estadoMer: DIAGRAMA_CLIENTE });

    const promptEnviado = gerarDica.mock.calls[0]?.[0] ?? '';
    expect(promptEnviado).not.toContain('Última avaliação');
  });

  it('envia o modelo lógico como SQL e a consulta juntos, pedindo coerência entre eles', async () => {
    await service.pedir('aluno-1', 'exercicio-1', {
      contexto: 'sql',
      estadoSql: 'SELECT nome FROM cliente',
      estadoMer: DIAGRAMA_CLIENTE,
    });

    const promptEnviado = gerarDica.mock.calls[0]?.[0] ?? '';
    expect(promptEnviado).toContain('CREATE TABLE cliente');
    expect(promptEnviado).toContain('SELECT nome FROM cliente');
    expect(promptEnviado).toContain('coerência entre o modelo e a consulta');
    expect(criarDica).toHaveBeenCalledWith(
      expect.objectContaining({ estado_enviado: { mer: DIAGRAMA_CLIENTE, sql: 'SELECT nome FROM cliente' } }),
    );
  });

  it('manda o resumo do conceitual junto com o DDL do lógico', async () => {
    await service.pedir('aluno-1', 'exercicio-1', {
      contexto: 'mer',
      estadoMer: {
        ...DIAGRAMA_CLIENTE,
        conceitual: {
          visaoAtributos: 'circulos',
          elementos: [{ id: 'e1', posicao: { x: 0, y: 0 }, tipo: 'entidade', nome: 'cliente' }],
          ligacoes: [],
        },
      },
    });

    const promptEnviado = gerarDica.mock.calls[0]?.[0] ?? '';
    expect(promptEnviado).toContain('Modelo conceitual atual do aluno');
    expect(promptEnviado).toContain('Entidade cliente');
    expect(promptEnviado).toContain('CREATE TABLE cliente');
  });

  it('não manda DDL vazio quando o aluno só tem modelo conceitual', async () => {
    await service.pedir('aluno-1', 'exercicio-1', {
      contexto: 'mer',
      estadoMer: {
        versao: 2,
        conversao: null,
        logico: null,
        conceitual: {
          visaoAtributos: 'circulos',
          elementos: [{ id: 'e1', posicao: { x: 0, y: 0 }, tipo: 'entidade', nome: 'cliente' }],
          ligacoes: [],
        },
      },
    });

    const promptEnviado = gerarDica.mock.calls[0]?.[0] ?? '';
    expect(promptEnviado).toContain('Entidade cliente');
    expect(promptEnviado).not.toContain('modelo lógico vazio');
  });

  it('não manda o MER quando o exercício não tem parte MER', async () => {
    findExercicioById.mockResolvedValue(buildExercicio({ mer_gabarito: null }));

    await service.pedir('aluno-1', 'exercicio-1', { contexto: 'sql', estadoSql: 'SELECT 1', estadoMer: DIAGRAMA_CLIENTE });

    const promptEnviado = gerarDica.mock.calls[0]?.[0] ?? '';
    expect(promptEnviado).not.toContain('CREATE TABLE');
    expect(promptEnviado).not.toContain('coerência');
  });
});
