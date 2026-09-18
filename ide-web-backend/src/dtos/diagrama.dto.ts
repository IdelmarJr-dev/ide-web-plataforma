import { z } from 'zod';
import type { DiagramaMer } from '../generated/prisma/client';
import { documentoModelagemSchema } from './modelagem.schema';

export const salvarDiagramaBodySchema = z.object({
  conteudoJson: documentoModelagemSchema,
});

export type SalvarDiagramaBodyDto = z.infer<typeof salvarDiagramaBodySchema>;

export const diagramaResponseSchema = z.object({
  id: z.string(),
  exercicioId: z.string(),
  usuarioId: z.string(),
  conteudoJson: z.unknown(),
  versao: z.number(),
  atualizadoEm: z.string(),
});

export type DiagramaResponseDto = z.infer<typeof diagramaResponseSchema>;

export function toDiagramaResponseDto(diagrama: DiagramaMer): DiagramaResponseDto {
  return {
    id: diagrama.id,
    exercicioId: diagrama.exercicio_id,
    usuarioId: diagrama.usuario_id,
    conteudoJson: diagrama.conteudo_json,
    versao: diagrama.versao,
    atualizadoEm: diagrama.atualizado_em.toISOString(),
  };
}
