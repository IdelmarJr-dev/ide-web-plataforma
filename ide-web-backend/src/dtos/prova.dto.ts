import { z } from 'zod';
import type { Prova } from '../generated/prisma/client';

export const criarProvaBodySchema = z.object({
  titulo: z.string().min(1),
});

export type CriarProvaBodyDto = z.infer<typeof criarProvaBodySchema>;

export const provaResponseSchema = z.object({
  id: z.string(),
  turmaId: z.string(),
  titulo: z.string(),
  criadoEm: z.string(),
});

export type ProvaResponseDto = z.infer<typeof provaResponseSchema>;

export function toProvaResponseDto(prova: Prova): ProvaResponseDto {
  return {
    id: prova.id,
    turmaId: prova.turma_id,
    titulo: prova.titulo,
    criadoEm: prova.criado_em.toISOString(),
  };
}

export const sortearProvasResponseSchema = z.object({
  alunosSorteados: z.number(),
});

export type SortearProvasResponseDto = z.infer<typeof sortearProvasResponseSchema>;

// Fase 10, D13: o professor diz quantas questões quer; o sistema tira do acervo.
export const QUANTIDADE_MAXIMA_QUESTOES = 50;

export const assistenteProvaBodySchema = z.object({
  titulo: z.string().min(1),
  quantidade: z.number().int().positive().max(QUANTIDADE_MAXIMA_QUESTOES),
  nivel: z.enum(['iniciante', 'intermediario']).optional(),
  prazo: z.coerce.date().optional(),
});

export type AssistenteProvaBodyDto = z.infer<typeof assistenteProvaBodySchema>;
