import type { ResultadoExercicio } from '../generated/prisma/client';
import { prisma } from '../lib/prisma';

export interface RevisarResultadoInput {
  sql_correto?: boolean;
  mer_avaliacao?: number;
  dissertativa_avaliacao?: number;
  acertos?: number;
  erros?: number;
  pontuacao?: number;
}

export interface ResultadoExercicioRepository {
  findByUsuarioEExercicio(usuarioId: string, exercicioId: string): Promise<ResultadoExercicio | null>;
  upsertRevisao(
    usuarioId: string,
    exercicioId: string,
    revisorId: string,
    input: RevisarResultadoInput,
  ): Promise<ResultadoExercicio>;
  upsertAcertoAutomatico(usuarioId: string, exercicioId: string, sqlCorreto: boolean): Promise<void>;
  liberarEnvio(usuarioId: string, exercicioId: string): Promise<void>;
  limparEnvioLiberado(usuarioId: string, exercicioId: string): Promise<void>;
  marcarFinalizado(usuarioId: string, exercicioId: string, finalizadoEm: Date): Promise<ResultadoExercicio>;
}

export class PrismaResultadoExercicioRepository implements ResultadoExercicioRepository {
  findByUsuarioEExercicio(usuarioId: string, exercicioId: string): Promise<ResultadoExercicio | null> {
    return prisma.resultadoExercicio.findUnique({
      where: { usuario_id_exercicio_id: { usuario_id: usuarioId, exercicio_id: exercicioId } },
    });
  }

  /**
   * Leva o acerto calculado pelo sandbox para o resultado do exercício, que é de onde o
   * painel e a tela de revisão leem. A revisão manual do professor congela o valor: o
   * julgamento humano sempre vence o automático (ver Fase 9, D14).
   */
  async upsertAcertoAutomatico(usuarioId: string, exercicioId: string, sqlCorreto: boolean): Promise<void> {
    const chave = { usuario_id_exercicio_id: { usuario_id: usuarioId, exercicio_id: exercicioId } };

    const existente = await prisma.resultadoExercicio.findUnique({ where: chave });
    if (existente?.revisado) {
      return;
    }

    await prisma.resultadoExercicio.upsert({
      where: chave,
      create: { usuario_id: usuarioId, exercicio_id: exercicioId, sql_correto: sqlCorreto },
      update: { sql_correto: sqlCorreto },
    });
  }

  /**
   * Concede UM envio extra, atravessando prazo vencido e envio único de prova
   * (Fase 10, D8). Cria a linha se o aluno nem começou — é o caso do que perdeu o
   * prazo sem ter entregado nada.
   */
  async liberarEnvio(usuarioId: string, exercicioId: string): Promise<void> {
    const chave = { usuario_id_exercicio_id: { usuario_id: usuarioId, exercicio_id: exercicioId } };

    await prisma.resultadoExercicio.upsert({
      where: chave,
      create: { usuario_id: usuarioId, exercicio_id: exercicioId, envio_liberado_em: new Date() },
      update: { envio_liberado_em: new Date() },
    });
  }

  async limparEnvioLiberado(usuarioId: string, exercicioId: string): Promise<void> {
    await prisma.resultadoExercicio.updateMany({
      where: { usuario_id: usuarioId, exercicio_id: exercicioId },
      data: { envio_liberado_em: null },
    });
  }

  marcarFinalizado(usuarioId: string, exercicioId: string, finalizadoEm: Date): Promise<ResultadoExercicio> {
    return prisma.resultadoExercicio.upsert({
      where: { usuario_id_exercicio_id: { usuario_id: usuarioId, exercicio_id: exercicioId } },
      create: { usuario_id: usuarioId, exercicio_id: exercicioId, finalizado_em: finalizadoEm },
      update: { finalizado_em: finalizadoEm },
    });
  }

  upsertRevisao(
    usuarioId: string,
    exercicioId: string,
    revisorId: string,
    input: RevisarResultadoInput,
  ): Promise<ResultadoExercicio> {
    const revisadoEm = new Date();

    return prisma.resultadoExercicio.upsert({
      where: { usuario_id_exercicio_id: { usuario_id: usuarioId, exercicio_id: exercicioId } },
      create: {
        usuario_id: usuarioId,
        exercicio_id: exercicioId,
        revisado: true,
        revisado_em: revisadoEm,
        revisado_por: revisorId,
        ...input,
      },
      update: {
        revisado: true,
        revisado_em: revisadoEm,
        revisado_por: revisorId,
        ...input,
      },
    });
  }
}
