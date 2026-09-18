import type { ContextoDica, DicaIa, Prisma } from '../generated/prisma/client';
import { prisma } from '../lib/prisma';

export interface CreateDicaIaInput {
  usuario_id: string;
  exercicio_id: string;
  contexto: ContextoDica;
  estado_enviado: Prisma.InputJsonValue;
  prompt_montado: string;
  resposta_ia: string;
  modelo_llm: string;
  tokens_usados: number | null;
}

export interface ContagemDicas {
  usuario_id: string;
  exercicio_id: string;
  contexto: ContextoDica;
  total: number;
}

export interface DicaIaRepository {
  contarPorContexto(usuarioId: string, exercicioId: string, contexto: ContextoDica): Promise<number>;
  criar(input: CreateDicaIaInput): Promise<DicaIa>;
  contarPorExercicios(exercicioIds: string[]): Promise<ContagemDicas[]>;
}

export class PrismaDicaIaRepository implements DicaIaRepository {
  contarPorContexto(usuarioId: string, exercicioId: string, contexto: ContextoDica): Promise<number> {
    return prisma.dicaIa.count({
      where: { usuario_id: usuarioId, exercicio_id: exercicioId, contexto },
    });
  }

  criar(input: CreateDicaIaInput): Promise<DicaIa> {
    return prisma.dicaIa.create({ data: input });
  }

  async contarPorExercicios(exercicioIds: string[]): Promise<ContagemDicas[]> {
    const grupos = await prisma.dicaIa.groupBy({
      by: ['usuario_id', 'exercicio_id', 'contexto'],
      where: { exercicio_id: { in: exercicioIds } },
      _count: { _all: true },
    });
    return grupos.map((grupo) => ({
      usuario_id: grupo.usuario_id,
      exercicio_id: grupo.exercicio_id,
      contexto: grupo.contexto,
      total: grupo._count._all,
    }));
  }
}
