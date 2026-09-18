import type { Prisma, ResultadoStatus, SubmissaoSql } from '../generated/prisma/client';
import { prisma } from '../lib/prisma';

export interface CriarSubmissaoInput {
  exercicio_id: string;
  usuario_id: string;
  query_sql: string;
  resultado_status: ResultadoStatus;
  linhas_retornadas: number | null;
  tempo_execucao_ms: number | null;
  correta: boolean | null;
  tentativa_numero: number;
  explain_json?: Prisma.InputJsonValue;
}

export interface ResumoSubmissao {
  usuario_id: string;
  exercicio_id: string;
  correta: boolean | null;
}

export interface SubmissaoSqlRepository {
  proximoNumeroTentativa(usuarioId: string, exercicioId: string): Promise<number>;
  criarComLog(input: CriarSubmissaoInput): Promise<SubmissaoSql>;
  findUltimaTentativa(usuarioId: string, exercicioId: string): Promise<SubmissaoSql | null>;
  findResumoPorExercicios(exercicioIds: string[]): Promise<ResumoSubmissao[]>;
}

const PRIMEIRA_TENTATIVA = 1;

export class PrismaSubmissaoSqlRepository implements SubmissaoSqlRepository {
  async proximoNumeroTentativa(usuarioId: string, exercicioId: string): Promise<number> {
    const total = await prisma.submissaoSql.count({
      where: { usuario_id: usuarioId, exercicio_id: exercicioId },
    });
    return total + PRIMEIRA_TENTATIVA;
  }

  criarComLog(input: CriarSubmissaoInput): Promise<SubmissaoSql> {
    const { explain_json, ...submissao } = input;

    return prisma.submissaoSql.create({
      data: {
        ...submissao,
        ...(explain_json !== undefined ? { log_execucao_sql: { create: { explain_json } } } : {}),
      },
    });
  }

  findUltimaTentativa(usuarioId: string, exercicioId: string): Promise<SubmissaoSql | null> {
    return prisma.submissaoSql.findFirst({
      where: { usuario_id: usuarioId, exercicio_id: exercicioId },
      orderBy: { tentativa_numero: 'desc' },
    });
  }

  findResumoPorExercicios(exercicioIds: string[]): Promise<ResumoSubmissao[]> {
    return prisma.submissaoSql.findMany({
      where: { exercicio_id: { in: exercicioIds } },
      select: { usuario_id: true, exercicio_id: true, correta: true },
    });
  }
}
