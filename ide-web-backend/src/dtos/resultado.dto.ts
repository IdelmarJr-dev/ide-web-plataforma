import { z } from 'zod';
import type { ResultadoExercicio } from '../generated/prisma/client';
import type { RespostasDoAluno } from '../services/ResultadoExercicioService';

// Escala do IFPI: 0,0 a 10,0 (Fase 10, D6). Decimal(5,2) no banco já comportava.
const PONTUACAO_MAXIMA = 10;

export const revisarResultadoBodySchema = z.object({
  sqlCorreto: z.boolean().optional(),
  merAvaliacao: z.number().min(0).max(PONTUACAO_MAXIMA).optional(),
  dissertativaAvaliacao: z.number().min(0).max(PONTUACAO_MAXIMA).optional(),
  acertos: z.number().int().nonnegative().optional(),
  erros: z.number().int().nonnegative().optional(),
  pontuacao: z.number().min(0).max(PONTUACAO_MAXIMA).optional(),
});

export type RevisarResultadoBodyDto = z.infer<typeof revisarResultadoBodySchema>;

export const resultadoResponseSchema = z.object({
  id: z.string(),
  usuarioId: z.string(),
  exercicioId: z.string(),
  sqlCorreto: z.boolean().nullable(),
  merAvaliacao: z.number().nullable(),
  dissertativaAvaliacao: z.number().nullable(),
  acertos: z.number(),
  erros: z.number(),
  pontuacao: z.number().nullable(),
  finalizadoEm: z.string().nullable(),
  revisado: z.boolean(),
  revisadoEm: z.string().nullable(),
  criadoEm: z.string(),
});

export type ResultadoResponseDto = z.infer<typeof resultadoResponseSchema>;

export function toResultadoResponseDto(resultado: ResultadoExercicio): ResultadoResponseDto {
  return {
    id: resultado.id,
    usuarioId: resultado.usuario_id,
    exercicioId: resultado.exercicio_id,
    sqlCorreto: resultado.sql_correto,
    merAvaliacao: resultado.mer_avaliacao?.toNumber() ?? null,
    dissertativaAvaliacao: resultado.dissertativa_avaliacao?.toNumber() ?? null,
    acertos: resultado.acertos,
    erros: resultado.erros,
    pontuacao: resultado.pontuacao?.toNumber() ?? null,
    finalizadoEm: resultado.finalizado_em?.toISOString() ?? null,
    revisado: resultado.revisado,
    revisadoEm: resultado.revisado_em?.toISOString() ?? null,
    criadoEm: resultado.criado_em.toISOString(),
  };
}

export const respostasDoAlunoResponseSchema = z.object({
  ultimaSubmissaoSql: z
    .object({ query: z.string(), correta: z.boolean().nullable(), criadoEm: z.string() })
    .nullable(),
  dissertativa: z.object({ texto: z.string(), atualizadoEm: z.string() }).nullable(),
});

export type RespostasDoAlunoResponseDto = z.infer<typeof respostasDoAlunoResponseSchema>;

export function toRespostasDoAlunoResponseDto(respostas: RespostasDoAluno): RespostasDoAlunoResponseDto {
  return {
    ultimaSubmissaoSql: respostas.ultimaSubmissaoSql
      ? {
          query: respostas.ultimaSubmissaoSql.query,
          correta: respostas.ultimaSubmissaoSql.correta,
          criadoEm: respostas.ultimaSubmissaoSql.criadoEm.toISOString(),
        }
      : null,
    dissertativa: respostas.dissertativa
      ? {
          texto: respostas.dissertativa.texto,
          atualizadoEm: respostas.dissertativa.atualizadoEm.toISOString(),
        }
      : null,
  };
}
