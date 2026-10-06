import type { RespostaSus } from '../generated/prisma/client';
import { prisma } from '../lib/prisma';

export interface CriarRespostaSusInput {
  sessao_id: string;
  usuario_id: string;
  itens: Record<string, number>;
  pontuacao_sus: number;
}

export interface RespostaSusRepository {
  existePorSessao(sessaoId: string): Promise<boolean>;
  criar(input: CriarRespostaSusInput): Promise<RespostaSus>;
  listarPorSessaoIds(sessaoIds: string[]): Promise<RespostaSus[]>;
}

export class PrismaRespostaSusRepository implements RespostaSusRepository {
  async existePorSessao(sessaoId: string): Promise<boolean> {
    const resposta = await prisma.respostaSus.findUnique({ where: { sessao_id: sessaoId }, select: { id: true } });
    return resposta !== null;
  }

  criar(input: CriarRespostaSusInput): Promise<RespostaSus> {
    return prisma.respostaSus.create({ data: input });
  }

  listarPorSessaoIds(sessaoIds: string[]): Promise<RespostaSus[]> {
    if (sessaoIds.length === 0) {
      return Promise.resolve([]);
    }
    return prisma.respostaSus.findMany({ where: { sessao_id: { in: sessaoIds } } });
  }
}
