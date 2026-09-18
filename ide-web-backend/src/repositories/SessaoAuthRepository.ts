import type { SessaoAuth } from '../generated/prisma/client';
import { prisma } from '../lib/prisma';

export interface SessaoAuthRepository {
  criar(usuarioId: string): Promise<SessaoAuth>;
  findById(id: string): Promise<SessaoAuth | null>;
  registrarAtividade(id: string, em: Date): Promise<void>;
  revogar(id: string): Promise<void>;
  revogarTodasDoUsuario(usuarioId: string): Promise<void>;
}

export class PrismaSessaoAuthRepository implements SessaoAuthRepository {
  criar(usuarioId: string): Promise<SessaoAuth> {
    return prisma.sessaoAuth.create({ data: { usuario_id: usuarioId } });
  }

  findById(id: string): Promise<SessaoAuth | null> {
    return prisma.sessaoAuth.findUnique({ where: { id } });
  }

  async registrarAtividade(id: string, em: Date): Promise<void> {
    await prisma.sessaoAuth.update({ where: { id }, data: { ultima_atividade_em: em } });
  }

  async revogar(id: string): Promise<void> {
    await prisma.sessaoAuth.update({ where: { id }, data: { revogada_em: new Date() } });
  }

  async revogarTodasDoUsuario(usuarioId: string): Promise<void> {
    await prisma.sessaoAuth.updateMany({
      where: { usuario_id: usuarioId, revogada_em: null },
      data: { revogada_em: new Date() },
    });
  }
}
