import { UnauthorizedError } from '../errors';
import type { SessaoAuth } from '../generated/prisma/client';
import type { SessaoAuthRepository } from '../repositories/SessaoAuthRepository';

const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const MS_PER_SECOND = 1000;
const DURACAO_MAXIMA_HORAS = 6;
const INTERVALO_REGISTRO_MINUTOS = 5;

const MINUTE_MS = SECONDS_PER_MINUTE * MS_PER_SECOND;
const HOUR_MS = MINUTES_PER_HOUR * MINUTE_MS;

/** Teto absoluto: mesmo usando sem parar, a sessão morre em 6 horas. */
export const DURACAO_MAXIMA_MS = DURACAO_MAXIMA_HORAS * HOUR_MS;
/** Janela de ociosidade: 1 hora sem nenhuma requisição derruba a sessão. */
export const OCIOSIDADE_MAXIMA_MS = HOUR_MS;
/**
 * Só grava `ultima_atividade_em` quando passaram 5 minutos da última gravação. Uma
 * escrita por clique seria desperdício, e 5 minutos não muda nada numa janela de
 * 1 hora (Fase 10, D3).
 */
export const INTERVALO_REGISTRO_ATIVIDADE_MS = INTERVALO_REGISTRO_MINUTOS * MINUTE_MS;

export type MotivoSessaoInvalida = 'revogada' | 'expirada' | 'ociosa' | 'inexistente';

export class SessaoInvalidaError extends UnauthorizedError {
  readonly motivo: MotivoSessaoInvalida;

  constructor(motivo: MotivoSessaoInvalida) {
    super(MENSAGENS[motivo]);
    this.motivo = motivo;
  }
}

// Mensagens distintas porque "você saiu em outro dispositivo" e "ficou parado tempo
// demais" são coisas diferentes pra quem lê.
const MENSAGENS: Record<MotivoSessaoInvalida, string> = {
  revogada: 'Sua sessão foi encerrada. Entre novamente.',
  expirada: 'Sua sessão passou de 6 horas. Entre novamente.',
  ociosa: 'Sua sessão expirou por inatividade. Entre novamente.',
  inexistente: 'Sessão inválida ou expirada',
};

export class SessaoAuthService {
  constructor(private readonly sessaoRepository: SessaoAuthRepository) {}

  abrir(usuarioId: string): Promise<SessaoAuth> {
    return this.sessaoRepository.criar(usuarioId);
  }

  encerrar(sessaoId: string): Promise<void> {
    return this.sessaoRepository.revogar(sessaoId);
  }

  /**
   * Valida a sessão e registra a atividade. Chamada em toda requisição autenticada —
   * é o preço de o logout revogar de verdade (Fase 10, D1).
   */
  async validar(sessaoId: string, agora = new Date()): Promise<SessaoAuth> {
    const sessao = await this.sessaoRepository.findById(sessaoId);
    if (!sessao) {
      throw new SessaoInvalidaError('inexistente');
    }
    if (sessao.revogada_em !== null) {
      throw new SessaoInvalidaError('revogada');
    }
    if (agora.getTime() - sessao.criada_em.getTime() > DURACAO_MAXIMA_MS) {
      throw new SessaoInvalidaError('expirada');
    }
    if (agora.getTime() - sessao.ultima_atividade_em.getTime() > OCIOSIDADE_MAXIMA_MS) {
      throw new SessaoInvalidaError('ociosa');
    }

    if (agora.getTime() - sessao.ultima_atividade_em.getTime() > INTERVALO_REGISTRO_ATIVIDADE_MS) {
      await this.sessaoRepository.registrarAtividade(sessao.id, agora);
    }

    return sessao;
  }
}
