import type { Ambiente, SessaoUso } from '../generated/prisma/client';
import { prisma } from '../lib/prisma';

export interface SessaoUsoRepository {
  buscarPorId(id: string): Promise<SessaoUso | null>;
  buscarPorPesquisaEUsuario(pesquisaId: string, usuarioId: string): Promise<SessaoUso | null>;
  criar(pesquisaId: string, usuarioId: string, ambiente: Ambiente): Promise<SessaoUso>;
  finalizar(id: string): Promise<SessaoUso>;
  listarPorPesquisa(pesquisaId: string): Promise<SessaoUso[]>;
}

export class PrismaSessaoUsoRepository implements SessaoUsoRepository {
  buscarPorId(id: string): Promise<SessaoUso | null> {
    return prisma.sessaoUso.findUnique({ where: { id } });
  }

  buscarPorPesquisaEUsuario(pesquisaId: string, usuarioId: string): Promise<SessaoUso | null> {
    return prisma.sessaoUso.findUnique({
      where: { pesquisa_id_usuario_id: { pesquisa_id: pesquisaId, usuario_id: usuarioId } },
    });
  }

  criar(pesquisaId: string, usuarioId: string, ambiente: Ambiente): Promise<SessaoUso> {
    return prisma.sessaoUso.create({ data: { pesquisa_id: pesquisaId, usuario_id: usuarioId, ambiente } });
  }

  finalizar(id: string): Promise<SessaoUso> {
    return prisma.sessaoUso.update({ where: { id }, data: { finalizada_em: new Date() } });
  }

  listarPorPesquisa(pesquisaId: string): Promise<SessaoUso[]> {
    return prisma.sessaoUso.findMany({ where: { pesquisa_id: pesquisaId } });
  }
}
