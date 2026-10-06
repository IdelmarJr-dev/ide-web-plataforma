import type { RespostaRtlx } from '../generated/prisma/client';
import { prisma } from '../lib/prisma';

export interface CriarRespostaRtlxInput {
  sessao_id: string;
  usuario_id: string;
  dimensoes: Record<string, number>;
  pontuacao_rtlx: number;
}

export interface RespostaRtlxRepository {
  existePorSessao(sessaoId: string): Promise<boolean>;
  criar(input: CriarRespostaRtlxInput): Promise<RespostaRtlx>;
  listarPorSessaoIds(sessaoIds: string[]): Promise<RespostaRtlx[]>;
}

export class PrismaRespostaRtlxRepository implements RespostaRtlxRepository {
  async existePorSessao(sessaoId: string): Promise<boolean> {
    const resposta = await prisma.respostaRtlx.findUnique({ where: { sessao_id: sessaoId }, select: { id: true } });
    return resposta !== null;
  }

  criar(input: CriarRespostaRtlxInput): Promise<RespostaRtlx> {
    return prisma.respostaRtlx.create({ data: input });
  }

  listarPorSessaoIds(sessaoIds: string[]): Promise<RespostaRtlx[]> {
    if (sessaoIds.length === 0) {
      return Promise.resolve([]);
    }
    return prisma.respostaRtlx.findMany({ where: { sessao_id: { in: sessaoIds } } });
  }
}
