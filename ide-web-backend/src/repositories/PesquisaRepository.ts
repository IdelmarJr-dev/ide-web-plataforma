import type { Pesquisa } from '../generated/prisma/client';
import { prisma } from '../lib/prisma';

export interface CreatePesquisaInput {
  turma_id: string;
  exercicio_ids: string[];
  iniciada_por: string;
}

export interface PesquisaRepository {
  criar(input: CreatePesquisaInput): Promise<Pesquisa>;
  buscarPorId(id: string): Promise<Pesquisa | null>;
  buscarAtivaPorTurma(turmaId: string): Promise<Pesquisa | null>;
  buscarAtivaPorTurmaIds(turmaIds: string[]): Promise<Pesquisa | null>;
  listarHistoricoPorTurma(turmaId: string): Promise<Pesquisa[]>;
  marcarGruposSorteados(id: string): Promise<Pesquisa>;
  encerrar(id: string): Promise<Pesquisa>;
}

export class PrismaPesquisaRepository implements PesquisaRepository {
  criar(input: CreatePesquisaInput): Promise<Pesquisa> {
    return prisma.pesquisa.create({ data: input });
  }

  buscarPorId(id: string): Promise<Pesquisa | null> {
    return prisma.pesquisa.findUnique({ where: { id } });
  }

  buscarAtivaPorTurma(turmaId: string): Promise<Pesquisa | null> {
    return prisma.pesquisa.findFirst({ where: { turma_id: turmaId, encerrada_em: null } });
  }

  // O aluno pode estar em várias turmas; a mais recente entre as que têm pesquisa
  // ativa ganha — é a que ele acabou de começar (mirror de pesquisa_ativa_do_aluno).
  buscarAtivaPorTurmaIds(turmaIds: string[]): Promise<Pesquisa | null> {
    if (turmaIds.length === 0) {
      return Promise.resolve(null);
    }
    return prisma.pesquisa.findFirst({
      where: { turma_id: { in: turmaIds }, encerrada_em: null },
      orderBy: { iniciada_em: 'desc' },
    });
  }

  listarHistoricoPorTurma(turmaId: string): Promise<Pesquisa[]> {
    return prisma.pesquisa.findMany({ where: { turma_id: turmaId }, orderBy: { iniciada_em: 'desc' } });
  }

  marcarGruposSorteados(id: string): Promise<Pesquisa> {
    return prisma.pesquisa.update({ where: { id }, data: { grupos_sorteados_em: new Date() } });
  }

  encerrar(id: string): Promise<Pesquisa> {
    return prisma.pesquisa.update({ where: { id }, data: { encerrada_em: new Date() } });
  }
}
