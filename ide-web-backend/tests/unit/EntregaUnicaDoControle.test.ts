import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AlocacaoGrupo, Exercicio, Pesquisa } from '../../src/generated/prisma/client';
import type { AlocacaoGrupoRepository } from '../../src/repositories/AlocacaoGrupoRepository';
import type { ExercicioRepository } from '../../src/repositories/ExercicioRepository';
import type { MatriculaRepository } from '../../src/repositories/MatriculaRepository';
import type { PesquisaRepository } from '../../src/repositories/PesquisaRepository';
import type { ResultadoExercicioRepository } from '../../src/repositories/ResultadoExercicioRepository';
import type { SubmissaoSqlRepository } from '../../src/repositories/SubmissaoSqlRepository';
import type { TurmaRepository } from '../../src/repositories/TurmaRepository';
import { AcessoExercicioService } from '../../src/services/AcessoExercicioService';
import { EntregaUnicaDoControle } from '../../src/services/EntregaUnicaDoControle';
import { buildMatricula, buildTurmaAberta } from '../apoio/acessoExercicio';

const EXERCICIO_ID = '11111111-1111-1111-1111-111111111111';
const ALUNO_ID = '22222222-2222-2222-2222-222222222222';
const PESQUISA_ID = '33333333-3333-3333-3333-333333333333';

const exercicio = { id: EXERCICIO_ID, turma_id: 'turma-1', prova_id: null, publico: false, prazo: null } as Exercicio;
const pesquisa = { id: PESQUISA_ID, turma_id: 'turma-1', exercicio_ids: [EXERCICIO_ID], encerrada_em: null } as Pesquisa;
const alocacao = (grupo: AlocacaoGrupo['grupo']): AlocacaoGrupo => ({ grupo } as AlocacaoGrupo);

// Antes de 16/11/2026 a entrega única do controle ficava só no localStorage: outro
// navegador, ou a API direto, entregava de novo e o CSV contava mais de uma tentativa.
describe('EntregaUnicaDoControle', () => {
  const buscarAtivaPorTurma = vi.fn<PesquisaRepository['buscarAtivaPorTurma']>();
  const buscarAlocacao = vi.fn<AlocacaoGrupoRepository['buscarPorPesquisaEUsuario']>();
  const findUltimaTentativa = vi.fn<SubmissaoSqlRepository['findUltimaTentativa']>();
  const findResultado = vi.fn<ResultadoExercicioRepository['findByUsuarioEExercicio']>();

  const regra = new EntregaUnicaDoControle(
    { buscarAtivaPorTurma } as unknown as PesquisaRepository,
    { buscarPorPesquisaEUsuario: buscarAlocacao } as unknown as AlocacaoGrupoRepository,
  );
  const acesso = new AcessoExercicioService(
    { findById: vi.fn().mockResolvedValue(exercicio) } as unknown as ExercicioRepository,
    { findByAlunoETurma: vi.fn().mockResolvedValue(buildMatricula()) } as unknown as MatriculaRepository,
    { findById: vi.fn().mockResolvedValue(buildTurmaAberta()) } as unknown as TurmaRepository,
    { findUltimaTentativa } as unknown as SubmissaoSqlRepository,
    { findByUsuarioEExercicio: findResultado, limparEnvioLiberado: vi.fn() } as unknown as ResultadoExercicioRepository,
    regra,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    buscarAtivaPorTurma.mockResolvedValue(pesquisa);
    buscarAlocacao.mockResolvedValue(alocacao('controle'));
    findUltimaTentativa.mockResolvedValue(null);
    findResultado.mockResolvedValue(null);
  });

  it('aceita a primeira entrega do grupo controle', async () => {
    await expect(acesso.exigirEntrega(ALUNO_ID, EXERCICIO_ID)).resolves.toBeDefined();
  });

  it('recusa a segunda entrega do grupo controle no exercício da tarefa', async () => {
    findUltimaTentativa.mockResolvedValue({ id: 's1' } as never);

    await expect(acesso.exigirEntrega(ALUNO_ID, EXERCICIO_ID)).rejects.toThrow(/grupo controle entrega a consulta uma vez só/);
  });

  it('o grupo experimental envia quantas vezes quiser', async () => {
    buscarAlocacao.mockResolvedValue(alocacao('experimental'));
    findUltimaTentativa.mockResolvedValue({ id: 's1' } as never);

    await expect(acesso.exigirEntrega(ALUNO_ID, EXERCICIO_ID)).resolves.toBeDefined();
  });

  it('exercício fora da tarefa da pesquisa não muda', async () => {
    buscarAtivaPorTurma.mockResolvedValue({ ...pesquisa, exercicio_ids: ['outro'] });
    findUltimaTentativa.mockResolvedValue({ id: 's1' } as never);

    await expect(acesso.exigirEntrega(ALUNO_ID, EXERCICIO_ID)).resolves.toBeDefined();
  });

  it('sem pesquisa ativa na turma nada muda', async () => {
    buscarAtivaPorTurma.mockResolvedValue(null);
    findUltimaTentativa.mockResolvedValue({ id: 's1' } as never);

    await expect(acesso.exigirEntrega(ALUNO_ID, EXERCICIO_ID)).resolves.toBeDefined();
    expect(buscarAlocacao).not.toHaveBeenCalled();
  });

  it('a liberação do professor atravessa a entrega única, como na prova', async () => {
    findUltimaTentativa.mockResolvedValue({ id: 's1' } as never);
    findResultado.mockResolvedValue({ envio_liberado_em: new Date() } as never);

    await expect(acesso.exigirEntrega(ALUNO_ID, EXERCICIO_ID)).resolves.toBeDefined();
  });

  it('só dá motivo de envio único ao controle', async () => {
    await expect(regra.motivoEnvioUnico(ALUNO_ID, exercicio)).resolves.toMatch(/uma vez só/);

    buscarAlocacao.mockResolvedValue(null);
    await expect(regra.motivoEnvioUnico(ALUNO_ID, exercicio)).resolves.toBeNull();
  });
});
