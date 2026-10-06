import type { TcleConsentimento } from '../generated/prisma/client';
import { prisma } from '../lib/prisma';

export interface TcleConsentimentoRepository {
  buscarPorPesquisaEUsuario(pesquisaId: string, usuarioId: string): Promise<TcleConsentimento | null>;
  registrar(pesquisaId: string, usuarioId: string, aceito: boolean, versaoTermo: string): Promise<TcleConsentimento>;
  listarPorPesquisa(pesquisaId: string): Promise<TcleConsentimento[]>;
}

export class PrismaTcleConsentimentoRepository implements TcleConsentimentoRepository {
  buscarPorPesquisaEUsuario(pesquisaId: string, usuarioId: string): Promise<TcleConsentimento | null> {
    return prisma.tcleConsentimento.findUnique({
      where: { pesquisa_id_usuario_id: { pesquisa_id: pesquisaId, usuario_id: usuarioId } },
    });
  }

  // Pode ser alterado depois — desistir é direito do participante (TCLE), e quem
  // desiste sai da exportação (o service é quem decide isso, filtrando por `aceito`).
  registrar(pesquisaId: string, usuarioId: string, aceito: boolean, versaoTermo: string): Promise<TcleConsentimento> {
    return prisma.tcleConsentimento.upsert({
      where: { pesquisa_id_usuario_id: { pesquisa_id: pesquisaId, usuario_id: usuarioId } },
      create: { pesquisa_id: pesquisaId, usuario_id: usuarioId, aceito, versao_termo: versaoTermo },
      update: { aceito, versao_termo: versaoTermo, respondido_em: new Date() },
    });
  }

  listarPorPesquisa(pesquisaId: string): Promise<TcleConsentimento[]> {
    return prisma.tcleConsentimento.findMany({ where: { pesquisa_id: pesquisaId } });
  }
}
