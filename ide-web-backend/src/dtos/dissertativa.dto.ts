import { z } from 'zod';
import type { RespostaDissertativa } from '../generated/prisma/client';

// Limite folgado para uma resposta de exercício; protege o banco de colagens enormes.
const TAMANHO_MAXIMO_TEXTO = 20_000;

export const salvarDissertativaBodySchema = z.object({
  texto: z.string().max(TAMANHO_MAXIMO_TEXTO, 'A resposta passou de 20 mil caracteres.'),
});

export interface DissertativaResponseDto {
  exercicioId: string;
  texto: string;
  versao: number;
  atualizadoEm: string;
}

export function toDissertativaResponseDto(resposta: RespostaDissertativa): DissertativaResponseDto {
  return {
    exercicioId: resposta.exercicio_id,
    texto: resposta.texto,
    versao: resposta.versao,
    atualizadoEm: resposta.atualizado_em.toISOString(),
  };
}
