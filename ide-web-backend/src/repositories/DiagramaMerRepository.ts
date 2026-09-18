import type { DiagramaMer, Prisma } from '../generated/prisma/client';
import { prisma } from '../lib/prisma';

export interface DiagramaMerRepository {
  findByExercicioEUsuario(exercicioId: string, usuarioId: string): Promise<DiagramaMer | null>;
  upsert(exercicioId: string, usuarioId: string, conteudoJson: Prisma.InputJsonValue): Promise<DiagramaMer>;
}

export class PrismaDiagramaMerRepository implements DiagramaMerRepository {
  findByExercicioEUsuario(exercicioId: string, usuarioId: string): Promise<DiagramaMer | null> {
    return prisma.diagramaMer.findUnique({
      where: { exercicio_id_usuario_id: { exercicio_id: exercicioId, usuario_id: usuarioId } },
    });
  }

  upsert(exercicioId: string, usuarioId: string, conteudoJson: Prisma.InputJsonValue): Promise<DiagramaMer> {
    return prisma.diagramaMer.upsert({
      where: { exercicio_id_usuario_id: { exercicio_id: exercicioId, usuario_id: usuarioId } },
      create: { exercicio_id: exercicioId, usuario_id: usuarioId, conteudo_json: conteudoJson, versao: 1 },
      update: { conteudo_json: conteudoJson, versao: { increment: 1 } },
    });
  }
}
