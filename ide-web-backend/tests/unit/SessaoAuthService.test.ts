import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessaoAuth } from '../../src/generated/prisma/client';
import type { SessaoAuthRepository } from '../../src/repositories/SessaoAuthRepository';
import {
  DURACAO_MAXIMA_MS,
  INTERVALO_REGISTRO_ATIVIDADE_MS,
  OCIOSIDADE_MAXIMA_MS,
  SessaoAuthService,
} from '../../src/services/SessaoAuthService';

const AGORA = new Date('2026-09-17T12:00:00.000Z');
const SESSAO_ID = '11111111-1111-1111-1111-111111111111';

function sessao(overrides: Partial<SessaoAuth> = {}): SessaoAuth {
  return {
    id: SESSAO_ID,
    usuario_id: '22222222-2222-2222-2222-222222222222',
    criada_em: AGORA,
    ultima_atividade_em: AGORA,
    revogada_em: null,
    ...overrides,
  };
}

function menos(ms: number): Date {
  return new Date(AGORA.getTime() - ms);
}

describe('SessaoAuthService.validar', () => {
  const findById = vi.fn<SessaoAuthRepository['findById']>();
  const registrarAtividade = vi.fn<SessaoAuthRepository['registrarAtividade']>();

  const repository: SessaoAuthRepository = {
    findById,
    registrarAtividade,
    criar: vi.fn(),
    revogar: vi.fn(),
    revogarTodasDoUsuario: vi.fn(),
  };
  const service = new SessaoAuthService(repository);

  beforeEach(() => {
    vi.clearAllMocks();
    registrarAtividade.mockResolvedValue(undefined);
  });

  it('aceita sessão recém-aberta', async () => {
    findById.mockResolvedValue(sessao());

    await expect(service.validar(SESSAO_ID, AGORA)).resolves.toMatchObject({ id: SESSAO_ID });
  });

  it('recusa sessão que não existe', async () => {
    findById.mockResolvedValue(null);

    await expect(service.validar(SESSAO_ID, AGORA)).rejects.toThrow(/inválida ou expirada/);
  });

  // D1: é isto que faz o logout valer alguma coisa.
  it('recusa sessão revogada, mesmo dentro do prazo', async () => {
    findById.mockResolvedValue(sessao({ revogada_em: menos(1000) }));

    await expect(service.validar(SESSAO_ID, AGORA)).rejects.toThrow(/encerrada/);
  });

  it('recusa sessão que passou das 6 horas, mesmo com atividade recente', async () => {
    findById.mockResolvedValue(sessao({ criada_em: menos(DURACAO_MAXIMA_MS + 1000) }));

    await expect(service.validar(SESSAO_ID, AGORA)).rejects.toThrow(/6 horas/);
  });

  it('recusa sessão parada há mais de 1 hora', async () => {
    findById.mockResolvedValue(
      sessao({ criada_em: menos(OCIOSIDADE_MAXIMA_MS * 2), ultima_atividade_em: menos(OCIOSIDADE_MAXIMA_MS + 1000) }),
    );

    await expect(service.validar(SESSAO_ID, AGORA)).rejects.toThrow(/inatividade/);
  });

  // D3: uma escrita por clique seria desperdício.
  it('não regrava a atividade quando a última foi há menos de 5 minutos', async () => {
    findById.mockResolvedValue(sessao({ ultima_atividade_em: menos(INTERVALO_REGISTRO_ATIVIDADE_MS - 1000) }));

    await service.validar(SESSAO_ID, AGORA);

    expect(registrarAtividade).not.toHaveBeenCalled();
  });

  it('regrava a atividade depois de 5 minutos', async () => {
    findById.mockResolvedValue(sessao({ ultima_atividade_em: menos(INTERVALO_REGISTRO_ATIVIDADE_MS + 1000) }));

    await service.validar(SESSAO_ID, AGORA);

    expect(registrarAtividade).toHaveBeenCalledWith(SESSAO_ID, AGORA);
  });
});
