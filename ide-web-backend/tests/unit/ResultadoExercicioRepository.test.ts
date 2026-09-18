import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaResultadoExercicioRepository } from '../../src/repositories/ResultadoExercicioRepository';

// `vi.hoisted` porque a fábrica do mock roda antes das declarações do módulo.
const { findUnique, upsert } = vi.hoisted(() => ({ findUnique: vi.fn(), upsert: vi.fn() }));

// O guard de D14 vive no repositório, que fala direto com o Prisma — e a suíte de
// integração daqui não sobe banco. Simular o client é o único jeito de provar a regra.
vi.mock('../../src/lib/prisma', () => ({
  prisma: { resultadoExercicio: { findUnique, upsert } },
}));

const USUARIO_ID = '22222222-2222-2222-2222-222222222222';
const EXERCICIO_ID = '11111111-1111-1111-1111-111111111111';
const CHAVE = { usuario_id_exercicio_id: { usuario_id: USUARIO_ID, exercicio_id: EXERCICIO_ID } };

describe('PrismaResultadoExercicioRepository.upsertAcertoAutomatico', () => {
  const repository = new PrismaResultadoExercicioRepository();

  beforeEach(() => {
    vi.clearAllMocks();
    upsert.mockResolvedValue({});
  });

  it('cria o resultado quando o aluno ainda não tem nenhum', async () => {
    findUnique.mockResolvedValue(null);

    await repository.upsertAcertoAutomatico(USUARIO_ID, EXERCICIO_ID, true);

    expect(upsert).toHaveBeenCalledWith({
      where: CHAVE,
      create: { usuario_id: USUARIO_ID, exercicio_id: EXERCICIO_ID, sql_correto: true },
      update: { sql_correto: true },
    });
  });

  it('atualiza o resultado existente que ainda não foi revisado', async () => {
    findUnique.mockResolvedValue({ revisado: false, sql_correto: null });

    await repository.upsertAcertoAutomatico(USUARIO_ID, EXERCICIO_ID, false);

    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ update: { sql_correto: false } }));
  });

  // D14: o julgamento do professor sempre vence o automático. Sem isso, um envio posterior
  // do aluno apagaria a correção manual sem ninguém perceber.
  it('não toca no resultado depois que o professor revisou', async () => {
    findUnique.mockResolvedValue({ revisado: true, sql_correto: true });

    await repository.upsertAcertoAutomatico(USUARIO_ID, EXERCICIO_ID, false);

    expect(upsert).not.toHaveBeenCalled();
  });
});
