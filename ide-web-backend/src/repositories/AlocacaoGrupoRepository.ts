import type { AlocacaoGrupo, Grupo } from '../generated/prisma/client';
import { prisma } from '../lib/prisma';

export interface AlocacaoGrupoRepository {
  buscarPorPesquisaEUsuario(pesquisaId: string, usuarioId: string): Promise<AlocacaoGrupo | null>;
  criar(pesquisaId: string, usuarioId: string, grupo: Grupo): Promise<AlocacaoGrupo>;
  listarPorPesquisa(pesquisaId: string): Promise<AlocacaoGrupo[]>;
}

export class PrismaAlocacaoGrupoRepository implements AlocacaoGrupoRepository {
  buscarPorPesquisaEUsuario(pesquisaId: string, usuarioId: string): Promise<AlocacaoGrupo | null> {
    return prisma.alocacaoGrupo.findUnique({
      where: { pesquisa_id_usuario_id: { pesquisa_id: pesquisaId, usuario_id: usuarioId } },
    });
  }

  criar(pesquisaId: string, usuarioId: string, grupo: Grupo): Promise<AlocacaoGrupo> {
    return prisma.alocacaoGrupo.create({ data: { pesquisa_id: pesquisaId, usuario_id: usuarioId, grupo } });
  }

  listarPorPesquisa(pesquisaId: string): Promise<AlocacaoGrupo[]> {
    return prisma.alocacaoGrupo.findMany({ where: { pesquisa_id: pesquisaId } });
  }
}
