import type { RespostaDissertativa } from '../generated/prisma/client';
import { prisma } from '../lib/prisma';

export interface RespostaDissertativaRepository {
  findByExercicioEUsuario(exercicioId: string, usuarioId: string): Promise<RespostaDissertativa | null>;
  salvar(exercicioId: string, usuarioId: string, texto: string): Promise<RespostaDissertativa>;
}

export class PrismaRespostaDissertativaRepository implements RespostaDissertativaRepository {
  // A tabela não tem @@unique([exercicio_id, usuario_id]) (desenho da Fase 2): busca a
  // versão mais recente em vez de findUnique, pra não presumir uma constraint que não existe.
  findByExercicioEUsuario(exercicioId: string, usuarioId: string): Promise<RespostaDissertativa | null> {
    return prisma.respostaDissertativa.findFirst({
      where: { exercicio_id: exercicioId, usuario_id: usuarioId },
      orderBy: { versao: 'desc' },
    });
  }

  /** Atualiza a resposta existente (subindo a versão) ou cria a primeira. Uma linha por aluno e exercício. */
  async salvar(exercicioId: string, usuarioId: string, texto: string): Promise<RespostaDissertativa> {
    const atual = await this.findByExercicioEUsuario(exercicioId, usuarioId);
    if (atual) {
      return prisma.respostaDissertativa.update({
        where: { id: atual.id },
        data: { texto, versao: atual.versao + 1 },
      });
    }
    return prisma.respostaDissertativa.create({
      data: { exercicio_id: exercicioId, usuario_id: usuarioId, texto },
    });
  }
}
