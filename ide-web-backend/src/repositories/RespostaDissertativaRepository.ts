import type { RespostaDissertativa } from '../generated/prisma/client';
import { prisma } from '../lib/prisma';

export interface RespostaDissertativaRepository {
  findByExercicioEUsuario(exercicioId: string, usuarioId: string): Promise<RespostaDissertativa | null>;
}

export class PrismaRespostaDissertativaRepository implements RespostaDissertativaRepository {
  // RespostaDissertativa ainda não tem endpoint de escrita nem @@unique([exercicio_id,
  // usuario_id]) (só o desenho da Fase 2, ver CLAUDE.md) — busca pela versão mais
  // recente em vez de findUnique, pra não presumir uma constraint que não existe.
  findByExercicioEUsuario(exercicioId: string, usuarioId: string): Promise<RespostaDissertativa | null> {
    return prisma.respostaDissertativa.findFirst({
      where: { exercicio_id: exercicioId, usuario_id: usuarioId },
      orderBy: { versao: 'desc' },
    });
  }
}
